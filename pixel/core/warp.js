// Perspective correction: map a user-drawn quad to an axis-aligned rectangle.
// Corner order used everywhere: top-left, top-right, bottom-right, bottom-left.

/** Pick a sensible output rectangle size from the quad's edge lengths. */
export function suggestOutputSize(quad, maxSide = 1024) {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let w = Math.max(1, Math.round(Math.max(dist(quad[1], quad[0]), dist(quad[2], quad[3]))));
  let h = Math.max(1, Math.round(Math.max(dist(quad[3], quad[0]), dist(quad[2], quad[1]))));
  const scale = maxSide / Math.max(w, h);
  if (scale < 1) {
    w = Math.max(Math.trunc(w * scale), 1);
    h = Math.max(Math.trunc(h * scale), 1);
  }
  return [w, h];
}

/** Homography taking each from[i] to to[i]; returns [a, b, c, d, e, f, g, h] (i = 1). */
function homography(from, to) {
  const m = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = from[i], [x, y] = to[i];
    m.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    m.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) throw new Error("Degenerate perspective quad.");
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const k = m[row][col] / m[col][col];
      if (k !== 0) for (let j = col; j < 9; j++) m[row][j] -= k * m[col][j];
    }
  }
  return m.map((row, i) => row[8] / row[i]);
}

/** src: RGBA. Returns the quad's content as an outW x outH RGBA buffer (bilinear). */
export function warpQuadToRect(src, sw, sh, quad, outW, outH) {
  const rect = [[0, 0], [outW - 1, 0], [outW - 1, outH - 1], [0, outH - 1]];
  const [a, b, c, d, e, f, g, h] = homography(rect, quad);
  const out = new Uint8ClampedArray(outW * outH * 4);
  const maxX = sw - 1, maxY = sh - 1;
  for (let v = 0; v < outH; v++) {
    for (let u = 0; u < outW; u++) {
      const den = g * u + h * v + 1;
      // Clamping the sample position replicates the border.
      const x = Math.min(maxX, Math.max(0, (a * u + b * v + c) / den));
      const y = Math.min(maxY, Math.max(0, (d * u + e * v + f) / den));
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const x1 = Math.min(maxX, x0 + 1), y1 = Math.min(maxY, y0 + 1);
      const fx = x - x0, fy = y - y0;
      const p00 = (y0 * sw + x0) * 4, p01 = (y0 * sw + x1) * 4;
      const p10 = (y1 * sw + x0) * 4, p11 = (y1 * sw + x1) * 4;
      const o = (v * outW + u) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = src[p00 + ch] + (src[p01 + ch] - src[p00 + ch]) * fx;
        const bottom = src[p10 + ch] + (src[p11 + ch] - src[p10 + ch]) * fx;
        out[o + ch] = top + (bottom - top) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}
