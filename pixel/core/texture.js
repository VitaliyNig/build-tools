// Match source patches against upright block faces, with bounded working memory.
import { rgbToLab } from "./color.js";
import { TILE_BYTES, TILE_PX } from "./palette.js";
import { resize } from "./resample.js";

const PIXELS = TILE_PX * TILE_PX;
const DIMS = 3 + PIXELS * 3;

/**
 * Feature vector of one 16x16 RGB patch: mean Lab colour followed by the scaled
 * per-pixel deviation from it, so squared distance is
 * mean-colour error + strength * mean squared spatial-detail error.
 */
function features(rgb, offset, stride, rowStep, detailScale, out, o) {
  let ml = 0, ma = 0, mb = 0, k = o + 3;
  for (let y = 0; y < TILE_PX; y++) {
    let p = offset + y * rowStep;
    for (let x = 0; x < TILE_PX; x++, p += stride, k += 3) {
      rgbToLab(rgb[p], rgb[p + 1], rgb[p + 2], out, k);
      ml += out[k]; ma += out[k + 1]; mb += out[k + 2];
    }
  }
  ml /= PIXELS; ma /= PIXELS; mb /= PIXELS;
  out[o] = ml; out[o + 1] = ma; out[o + 2] = mb;
  for (k = o + 3; k < o + DIMS; k += 3) {
    out[k] = (out[k] - ml) * detailScale;
    out[k + 1] = (out[k + 1] - ma) * detailScale;
    out[k + 2] = (out[k + 2] - mb) * detailScale;
  }
}

export function matchTextures(src, sw, sh, palette, width, height, strength, dither = 0, onProgress) {
  if (!(strength > 0 && strength <= 1)) throw new Error("Texture strength must be in (0, 1].");
  const size = palette.size, detailScale = Math.sqrt(strength) / 16;
  const candidates = new Float32Array(size * DIMS);
  for (let p = 0; p < size; p++) {
    features(palette.tiles, p * TILE_BYTES, 3, TILE_PX * 3, detailScale, candidates, p * DIMS);
  }

  const idx = new Uint16Array(width * height);
  const errors = new Float32Array((height + 1) * (width + 2) * 3);
  const f = new Float32Array(DIMS), meanDist = new Float32Array(size);
  const stripWidth = width * TILE_PX;

  // Resample one block row at a time instead of allocating a huge mosaic.
  for (let y = 0; y < height; y++) {
    const strip = resize(src, sw, sh, [0, y * sh / height, sw, (y + 1) * sh / height],
      stripWidth, TILE_PX, "box");
    for (let x = 0; x < width; x++) {
      features(strip, x * TILE_PX * 3, 3, stripWidth * 3, detailScale, f, 0);
      const bl = f[0], ba = f[1], bb = f[2];
      const e = (y * (width + 2) + x + 1) * 3;
      f[0] += errors[e] * dither; f[1] += errors[e + 1] * dither; f[2] += errors[e + 2] * dither;

      // The mean-colour term is a lower bound on the full distance, so start
      // from the closest mean and skip every candidate that cannot beat it.
      let first = 0;
      for (let p = 0, q = 0; p < size; p++, q += DIMS) {
        const dl = f[0] - candidates[q], da = f[1] - candidates[q + 1], db = f[2] - candidates[q + 2];
        meanDist[p] = dl * dl + da * da + db * db;
        if (meanDist[p] < meanDist[first]) first = p;
      }
      let chosen = first, best = Infinity;
      for (let n = -1; n < size; n++) {
        const p = n < 0 ? first : n;
        if (n === first || meanDist[p] >= best) continue;
        const q = p * DIMS;
        let d = meanDist[p];
        for (let k = 3; k < DIMS && d < best; k += 48) {
          for (let j = k; j < k + 48; j++) {
            const diff = f[j] - candidates[q + j];
            d += diff * diff;
          }
        }
        if (d < best) { best = d; chosen = p; }
      }
      idx[y * width + x] = chosen;

      if (dither > 0) {
        const q = chosen * DIMS;
        const el = (bl - candidates[q]) * dither;
        const ea = (ba - candidates[q + 1]) * dither;
        const eb = (bb - candidates[q + 2]) * dither;
        const spread = (row, col, k) => {
          const t = (row * (width + 2) + col) * 3;
          errors[t] += el * k; errors[t + 1] += ea * k; errors[t + 2] += eb * k;
        };
        spread(y, x + 2, 7 / 16);
        spread(y + 1, x, 3 / 16);
        spread(y + 1, x + 1, 5 / 16);
        spread(y + 1, x + 2, 1 / 16);
      }
    }
    if (onProgress) onProgress((y + 1) / height);
  }
  return idx;
}
