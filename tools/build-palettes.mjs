// Build the palettes bundled with the site from Minecraft client JARs.
//
//   node tools/build-palettes.mjs <client.jar> [<client.jar> ...]
//
// For each JAR this writes, into shared/mc/palettes/:
//   <version>.json      block and decoration lists (id, name, category, average rgb)
//   <version>.png       atlas of block tiles, 16x16, 32 per row, in list order
//   <version>.faces.png atlas of the other sides of blocks, same layout
//   <version>.fronts.png atlas of non-cube blocks that fill the square from the north, same layout
//   <version>.deco.png  atlas of decoration tiles (32x32, with transparency), 32 per row
// and adds the version to index.json. It uses the same importer as the site.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { importJar } from "../shared/mc/jar.js";
import { DECO_PX } from "../shared/mc/palette.js";
import { decodePng } from "../shared/mc/png.js";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "shared", "mc", "palettes");
const COLS = 32, TILE = 16;

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
  const result = await importJar(buffer, path.basename(jar), decodePng);
  const { version } = result;
  fs.writeFileSync(path.join(OUT, `${version}.json`), JSON.stringify({
    version, data_version: result.dataVersion, cols: COLS, blocks: result.blocks, faces: result.faces,
    fronts: result.fronts, decorations: result.decorations,
  }));
  fs.writeFileSync(path.join(OUT, `${version}.png`), atlas(result.tiles, result.blocks.length, 3));
  fs.writeFileSync(path.join(OUT, `${version}.faces.png`), atlas(result.faceTiles, result.faces.length, 3));
  const frontsPath = path.join(OUT, `${version}.fronts.png`);
  if (result.fronts.length) fs.writeFileSync(frontsPath, atlas(result.frontTiles, result.fronts.length, 3));
  else fs.rmSync(frontsPath, { force: true });
  fs.writeFileSync(path.join(OUT, `${version}.deco.png`), atlas(result.decoTiles, result.decorations.length, 4, DECO_PX));
  index.palettes = index.palettes.filter((entry) => entry.version !== version);
  index.palettes.push({
    version, data_version: result.dataVersion, blocks: result.blocks.length, faces: result.faces.length,
    fronts: result.fronts.length, decorations: result.decorations.length,
  });
  console.log(`${version}: ${result.blocks.length} blocks, ${result.faces.length} other faces, ${result.fronts.length} fronts, ${result.decorations.length} decorations, ${result.skipped.length} skipped`);
}
index.palettes.sort(newerFirst);
index.default ||= index.palettes[0].version;
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
