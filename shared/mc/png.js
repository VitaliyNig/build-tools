// PNG decoder: all colour types and bit depths, not interlaced. No DOM access.
//
// A canvas is not used for this: some browsers and extensions add noise to the
// pixels read back from one (fingerprinting protection), and blocks that look
// the same would then no longer have exactly the same picture.

/** bytes: Uint8Array of a PNG file. Returns {data: RGBA Uint8ClampedArray, w, h}. */
export async function decodePng(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let w = 0, h = 0, depth = 0, type = 0, palette = null, alpha = null;
  const idat = [];
  for (let p = 8; p < bytes.length;) {
    const length = view.getUint32(p), kind = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    const d = bytes.subarray(p + 8, p + 8 + length);
    if (kind === "IHDR") {
      w = view.getUint32(p + 8); h = view.getUint32(p + 12); depth = d[8]; type = d[9];
      if (d[12]) throw new Error("Interlaced PNG");
    } else if (kind === "PLTE") palette = d;
    else if (kind === "tRNS") alpha = d;
    else if (kind === "IDAT") idat.push(d);
    p += 12 + length;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error("Unsupported PNG format.");
  const bpp = Math.max(1, channels * depth / 8), stride = Math.ceil(w * channels * depth / 8);
  const stream = new Blob(idat).stream().pipeThrough(new DecompressionStream("deflate"));
  const raw = new Uint8Array(await new Response(stream).arrayBuffer()), px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, up = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let predicted = 0;
      if (filter === 1) predicted = a;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (a + up) >> 1;
      else if (filter === 4) {
        const q = a + up - c, pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      px[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + predicted) & 255;
    }
  }
  const sample = (y, i) => (depth === 8 ? px[y * stride + i] : depth === 16 ? px[y * stride + i * 2]
    : (px[y * stride + ((i * depth) >> 3)] >> (8 - depth - ((i * depth) & 7))) & ((1 << depth) - 1));
  // Without an alpha channel, tRNS names the one colour that is transparent.
  const full = (y, i) => (depth === 16 ? (px[y * stride + i * 2] << 8) | px[y * stride + i * 2 + 1] : sample(y, i));
  const key = (at) => (alpha[at] << 8) | alpha[at + 1];
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (type === 3) {
        const i = sample(y, x);
        data[o] = palette[i * 3]; data[o + 1] = palette[i * 3 + 1]; data[o + 2] = palette[i * 3 + 2];
        data[o + 3] = alpha && i < alpha.length ? alpha[i] : 255;
      } else if (type === 0 || type === 4) {
        const scale = depth < 8 ? 255 / ((1 << depth) - 1) : 1, step = type === 4 ? 2 : 1;
        data[o] = data[o + 1] = data[o + 2] = sample(y, x * step) * scale;
        data[o + 3] = type === 4 ? sample(y, x * 2 + 1) : alpha && full(y, x) === key(0) ? 0 : 255;
      } else {
        data[o] = sample(y, x * channels); data[o + 1] = sample(y, x * channels + 1);
        data[o + 2] = sample(y, x * channels + 2);
        data[o + 3] = channels === 4 ? sample(y, x * 4 + 3)
          : alpha && full(y, x * 3) === key(0) && full(y, x * 3 + 1) === key(2) && full(y, x * 3 + 2) === key(4) ? 0 : 255;
      }
    }
  }
  return { data, w, h };
}
