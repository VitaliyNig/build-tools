// Separable convolution resize (the algorithm PIL uses), RGBA in -> packed RGB out.

const FILTERS = {
  box: { support: 0.5, fn: (x) => (x > -0.5 && x <= 0.5 ? 1 : 0) },
  lanczos: {
    support: 3,
    fn: (x) => {
      if (x < -3 || x >= 3) return 0;
      if (x === 0) return 1;
      const p = Math.PI * x;
      return 3 * Math.sin(p) * Math.sin(p / 3) / (p * p);
    },
  },
};

function coefficients(inSize, in0, in1, outSize, filter) {
  const scale = (in1 - in0) / outSize;
  const filterScale = Math.max(scale, 1);
  const support = filter.support * filterScale;
  const ksize = Math.ceil(support) * 2 + 1;
  const start = new Int32Array(outSize), count = new Int32Array(outSize);
  const weights = new Float64Array(outSize * ksize);
  for (let i = 0; i < outSize; i++) {
    const center = in0 + (i + 0.5) * scale;
    const lo = Math.max(0, Math.trunc(center - support + 0.5));
    const hi = Math.min(inSize, Math.trunc(center + support + 0.5));
    const n = Math.max(0, hi - lo);
    let total = 0;
    for (let k = 0; k < n; k++) {
      const w = filter.fn((k + lo - center + 0.5) / filterScale);
      weights[i * ksize + k] = w;
      total += w;
    }
    if (total !== 0) for (let k = 0; k < n; k++) weights[i * ksize + k] /= total;
    start[i] = lo;
    count[i] = n;
  }
  return { start, count, weights, ksize };
}

/**
 * Resize the region box = [x0, y0, x1, y1] (may be fractional) of an RGBA image
 * to dw x dh. Returns a Uint8Array of dw*dh*3 RGB bytes.
 */
export function resize(src, sw, sh, box, dw, dh, filterName) {
  const filter = FILTERS[filterName];
  const cx = coefficients(sw, box[0], box[2], dw, filter);
  const cy = coefficients(sh, box[1], box[3], dh, filter);

  let yMin = sh, yMax = 0;
  for (let i = 0; i < dh; i++) {
    yMin = Math.min(yMin, cy.start[i]);
    yMax = Math.max(yMax, cy.start[i] + cy.count[i]);
  }
  const rows = Math.max(0, yMax - yMin);

  // Horizontal pass over only the source rows the vertical pass will read.
  const tmp = new Float32Array(rows * dw * 3);
  for (let y = 0; y < rows; y++) {
    const rowBase = (y + yMin) * sw * 4;
    let t = y * dw * 3;
    for (let x = 0; x < dw; x++, t += 3) {
      const n = cx.count[x], wBase = x * cx.ksize;
      let p = rowBase + cx.start[x] * 4, r = 0, g = 0, b = 0;
      for (let k = 0; k < n; k++, p += 4) {
        const w = cx.weights[wBase + k];
        r += src[p] * w; g += src[p + 1] * w; b += src[p + 2] * w;
      }
      tmp[t] = r; tmp[t + 1] = g; tmp[t + 2] = b;
    }
  }

  const out = new Uint8Array(dw * dh * 3);
  for (let y = 0; y < dh; y++) {
    const n = cy.count[y], wBase = y * cy.ksize, first = cy.start[y] - yMin;
    for (let x = 0; x < dw; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < n; k++) {
        const w = cy.weights[wBase + k], t = ((first + k) * dw + x) * 3;
        r += tmp[t] * w; g += tmp[t + 1] * w; b += tmp[t + 2] * w;
      }
      const o = (y * dw + x) * 3;
      out[o] = r < 0 ? 0 : r > 255 ? 255 : r + 0.5;
      out[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g + 0.5;
      out[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b + 0.5;
    }
  }
  return out;
}
