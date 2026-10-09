// Map an RGB grid to nearest palette blocks (Lab distance), optional dithering.
import { rgbToLab } from "./color.js";

/** grid: w*h*3 RGB bytes. Returns Uint16Array of palette indices, row-major. */
export function quantize(grid, w, h, palette, dither = 0) {
  return dither > 0 ? floydSteinberg(grid, w, h, palette, dither) : nearest(grid, w, h, palette);
}

function nearest(grid, w, h, palette) {
  const plab = palette.lab, size = palette.size;
  const idx = new Uint16Array(w * h), lab = new Float32Array(3);
  for (let i = 0; i < idx.length; i++) {
    rgbToLab(grid[i * 3], grid[i * 3 + 1], grid[i * 3 + 2], lab, 0);
    let best = Infinity, chosen = 0;
    for (let p = 0, q = 0; p < size; p++, q += 3) {
      const dl = lab[0] - plab[q], da = lab[1] - plab[q + 1], db = lab[2] - plab[q + 2];
      const d = dl * dl + da * da + db * db;
      if (d < best) { best = d; chosen = p; }
    }
    idx[i] = chosen;
  }
  return idx;
}

/** Floyd-Steinberg error diffusion; nearest match in RGB space. */
function floydSteinberg(grid, w, h, palette, strength) {
  const prgb = palette.rgb, size = palette.size;
  const work = Float32Array.from(grid);
  const idx = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      const r = work[o], g = work[o + 1], b = work[o + 2];
      let best = Infinity, chosen = 0;
      for (let p = 0, q = 0; p < size; p++, q += 3) {
        const dr = r - prgb[q], dg = g - prgb[q + 1], db = b - prgb[q + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < best) { best = d; chosen = p; }
      }
      idx[y * w + x] = chosen;
      const er = (r - prgb[chosen * 3]) * strength;
      const eg = (g - prgb[chosen * 3 + 1]) * strength;
      const eb = (b - prgb[chosen * 3 + 2]) * strength;
      const spread = (target, k) => {
        work[target] += er * k; work[target + 1] += eg * k; work[target + 2] += eb * k;
      };
      if (x + 1 < w) spread(o + 3, 7 / 16);
      if (y + 1 < h) {
        const below = o + w * 3;
        if (x > 0) spread(below - 3, 3 / 16);
        spread(below, 5 / 16);
        if (x + 1 < w) spread(below + 3, 1 / 16);
      }
    }
  }
  return idx;
}

/** Return [[paletteIndex, count], ...] sorted by descending count. */
export function materialCounts(idx, paletteSize) {
  const counts = new Uint32Array(paletteSize);
  for (let i = 0; i < idx.length; i++) counts[idx[i]]++;
  const rows = [];
  counts.forEach((c, i) => { if (c) rows.push([i, c]); });
  return rows.sort((a, b) => b[1] - a[1]);
}
