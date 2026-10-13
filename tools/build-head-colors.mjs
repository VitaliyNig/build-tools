// Build heads/colors.bin, the main colours of every head of the catalogue, for
// the colour search of the Heads tool.
//
//   node tools/build-head-colors.mjs
//
// It reads the current catalogue from headsdb.com, with the heads of
// heads/mh-extra.json (tools/build-mh-catalog.mjs), and downloads the skin of
// every head from textures.minecraft.net. Heads already in colors.bin with the
// same texture are kept, so a later run only downloads new and changed heads.
// A skin that fails to download is left out and tried again on the next run.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng } from "../shared/mc/png.js";
import { addExtra, loadCatalog } from "../heads/catalog.js";
import { decodeColours, encodeColours, skinColours, textureCheck } from "../heads/colors.js";
import { normalizeTexture } from "../heads/textures.js";

const HEADS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "heads");
const OUT = path.join(HEADS, "colors.bin"), EXTRA = path.join(HEADS, "mh-extra.json");
const SKINS = "https://textures.minecraft.net/texture/";
const PARALLEL = 24, TRIES = 3;

// The heads of minecraft-heads.com that headsdb.com lacks get colours too.
const catalog = addExtra(await loadCatalog(), fs.existsSync(EXTRA) ? JSON.parse(fs.readFileSync(EXTRA, "utf8")) : null);
console.log(`catalogue revision ${catalog.revision}: ${catalog.heads.length} heads`);

const known = new Map();
if (fs.existsSync(OUT)) {
  for (const record of decodeColours(new Uint8Array(fs.readFileSync(OUT))).records) known.set(record.id, record);
}

const records = [], todo = new Map(); // texture → heads that wear it
for (const head of catalog.heads) {
  const texture = normalizeTexture(head.texture), check = textureCheck(texture);
  const old = known.get(head.id);
  if (old && old.check === check) { records.push(old); continue; }
  if (!todo.has(texture)) todo.set(texture, []);
  todo.get(texture).push({ id: head.id, check });
}
console.log(`kept ${records.length}, skins to download: ${todo.size}`);

async function colours(texture) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(SKINS + texture);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return skinColours(await decodePng(new Uint8Array(await response.arrayBuffer())));
    } catch (error) {
      if (attempt >= TRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

const queue = [...todo.keys()];
let done = 0, failed = 0, missing = 0;
const started = Date.now();
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (queue.length) {
    const texture = queue.pop();
    try {
      const found = await colours(texture);
      if (found) for (const { id, check } of todo.get(texture)) records.push({ id, check, colours: found });
      else missing++;
    } catch {
      failed++;
    }
    if (++done % 2000 === 0) {
      const rate = done / ((Date.now() - started) / 1000);
      console.log(`${done}/${todo.size} skins, ${Math.round(rate)}/s, about ${Math.round((todo.size - done) / rate / 60)} min left`);
    }
  }
}));

fs.writeFileSync(OUT, encodeColours(catalog.revision, records));
console.log(`wrote ${records.length} heads (${fs.statSync(OUT).size} bytes); ${missing} skins gone, ${failed} failed`);
