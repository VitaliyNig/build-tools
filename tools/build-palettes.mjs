// Build the palettes bundled with the site from Minecraft client JARs.
//
//   node tools/build-palettes.mjs <client.jar> [<client.jar> ...]
//
// For each JAR this writes, into shared/mc/palettes/:
//   <version>.json      block and decoration lists (id, name, category, average rgb)
//   <version>.png       atlas of block tiles, 16x16, 32 per row, in list order
//   <version>.faces.png atlas of the other sides of blocks, same layout
//   <version>.deco.png  atlas of decoration tiles (32x32, with transparency), 32 per row
// and adds the version to index.json. It uses the same importer as the site.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { importJar } from "../shared/mc/jar.js";
import { DECO_PX } from "../shared/mc/palette.js";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "shared", "mc", "palettes");
const COLS = 32, TILE = 16;

/** PNG -> {data: RGBA, w, h}; all colour types and bit depths, not interlaced. */
function decodePng(bytes) {
  const b = Buffer.from(bytes);
  let w, h, depth, type, palette, alpha;
  const idat = [];
  for (let p = 8; p < b.length;) {
    const length = b.readUInt32BE(p), kind = b.toString("latin1", p + 4, p + 8), d = b.subarray(p + 8, p + 8 + length);
    if (kind === "IHDR") {
      w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9];
      if (d[12]) throw new Error("Interlaced PNG");
    } else if (kind === "PLTE") palette = d;
    else if (kind === "tRNS") alpha = d;
    else if (kind === "IDAT") idat.push(d);
    p += 12 + length;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const bpp = Math.max(1, channels * depth / 8), stride = Math.ceil(w * channels * depth / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(stride * h);
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
        data[o + 3] = type === 4 ? sample(y, x * 2 + 1) : 255;
      } else {
        data[o] = sample(y, x * channels); data[o + 1] = sample(y, x * channels + 1);
        data[o + 2] = sample(y, x * channels + 2);
        data[o + 3] = channels === 4 ? sample(y, x * 4 + 3) : 255;
      }
    }
  }
  return { data, w, h };
}

/** Pixels (channels = 3 or 4 bytes each) -> PNG file bytes. */
function encodePng(pixels, w, h, channels) {
  const chunk = (kind, body) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0); out.write(kind, 4, "latin1"); body.copy(out, 8);
    out.writeUInt32BE(zlib.crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0); header.writeUInt32BE(h, 4);
  header[8] = 8; header[9] = channels === 4 ? 6 : 2;
  const raw = Buffer.alloc((w * channels + 1) * h);
  for (let y = 0; y < h; y++) {
    Buffer.from(pixels.buffer, pixels.byteOffset + y * w * channels, w * channels).copy(raw, y * (w * channels + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function atlas(tiles, count, channels, px = TILE) {
  const rows = Math.max(1, Math.ceil(count / COLS)), w = COLS * px, out = new Uint8Array(w * rows * px * channels);
  for (let i = 0; i < count; i++) {
    const ox = (i % COLS) * px, oy = Math.floor(i / COLS) * px;
    for (let y = 0; y < px; y++) {
      const from = (i * px + y) * px * channels;
      out.set(tiles.subarray(from, from + px * channels), ((oy + y) * w + ox) * channels);
    }
  }
  return encodePng(out, w, rows * px, channels);
}

const versionKey = (name) => name.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : -1));
const newerFirst = (a, b) => {
  const x = versionKey(a.version), y = versionKey(b.version);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? -1) !== (y[i] ?? -1)) return (y[i] ?? -1) - (x[i] ?? -1);
  }
  return 0;
};

const jars = process.argv.slice(2);
if (!jars.length) {
  console.error("usage: node tools/build-palettes.mjs <client.jar> [<client.jar> ...]");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const indexPath = path.join(OUT, "index.json");
const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : { default: null, palettes: [] };
for (const jar of jars) {
  const file = fs.readFileSync(jar);
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.length);
  const result = await importJar(buffer, path.basename(jar), async (bytes) => decodePng(bytes));
  const { version } = result;
  fs.writeFileSync(path.join(OUT, `${version}.json`), JSON.stringify({
    version, data_version: result.dataVersion, cols: COLS, blocks: result.blocks, faces: result.faces,
    decorations: result.decorations,
  }));
  fs.writeFileSync(path.join(OUT, `${version}.png`), atlas(result.tiles, result.blocks.length, 3));
  fs.writeFileSync(path.join(OUT, `${version}.faces.png`), atlas(result.faceTiles, result.faces.length, 3));
  fs.writeFileSync(path.join(OUT, `${version}.deco.png`), atlas(result.decoTiles, result.decorations.length, 4, DECO_PX));
  index.palettes = index.palettes.filter((entry) => entry.version !== version);
  index.palettes.push({
    version, data_version: result.dataVersion, blocks: result.blocks.length, faces: result.faces.length,
    decorations: result.decorations.length,
  });
  console.log(`${version}: ${result.blocks.length} blocks, ${result.faces.length} other faces, ${result.decorations.length} decorations, ${result.skipped.length} skipped`);
}
index.palettes.sort(newerFirst);
index.default ||= index.palettes[0].version;
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
