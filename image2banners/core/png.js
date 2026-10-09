// Minimal PNG decoder for the bundled atlases (8-bit RGB / RGBA, not interlaced).
//
// A canvas cannot be used for this: it stores premultiplied pixels, which loses
// the exact colours of semi-transparent banner patterns such as the gradients.

/** bytes: Uint8Array of a PNG file. Returns {data: RGBA Uint8ClampedArray, w, h}. */
export async function decodePng(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let w = 0, h = 0, channels = 0;
  const chunks = [];
  for (let p = 8; p < bytes.length;) {
    const length = view.getUint32(p);
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    if (type === "IHDR") {
      w = view.getUint32(p + 8); h = view.getUint32(p + 12);
      const depth = bytes[p + 16], colour = bytes[p + 17], interlace = bytes[p + 20];
      channels = colour === 6 ? 4 : colour === 2 ? 3 : 0;
      if (depth !== 8 || !channels || interlace) throw new Error("Unsupported PNG format.");
    } else if (type === "IDAT") {
      chunks.push(bytes.subarray(p + 8, p + 8 + length));
    }
    p += 12 + length;
  }
  const stream = new Blob(chunks).stream().pipeThrough(new DecompressionStream("deflate"));
  const raw = new Uint8Array(await new Response(stream).arrayBuffer());

  const stride = w * channels, line = new Uint8Array(stride), previous = new Uint8Array(stride);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)], row = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0, b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;
      let predicted = 0;
      if (filter === 1) predicted = a;
      else if (filter === 2) predicted = b;
      else if (filter === 3) predicted = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = (raw[row + x] + predicted) & 255;
    }
    for (let x = 0; x < w; x++) {
      const s = x * channels, d = (y * w + x) * 4;
      data[d] = line[s]; data[d + 1] = line[s + 1]; data[d + 2] = line[s + 2];
      data[d + 3] = channels === 4 ? line[s + 3] : 255;
    }
    previous.set(line);
  }
  return { data, w, h };
}
