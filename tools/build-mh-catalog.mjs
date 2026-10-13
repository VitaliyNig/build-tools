// Build the files that bring in the catalogue of minecraft-heads.com, which the
// HeadDatabase plugin by Arcaniax gives heads from. Its ids are the same as
// headsdb.com's, so a head is one head in both.
//
//   node tools/build-mh-catalog.mjs
//
// It reads every category of the site's public API and writes into heads/:
//   mh-ids.bin    which ids the catalogue has: "MHI1", the number of bits
//                 (uint32), then bit n set when id n is there
//   mh-extra.json the heads headsdb.com does not have yet, with name,
//                 texture, category and tags, added to the Heads catalogue
// Run tools/build-head-colors.mjs after it, for the colours of new heads.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "../heads/catalog.js";

const HEADS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "heads");
const API = "https://minecraft-heads.com/scripts/api.php";
// The site's categories and the matching ones of headsdb.com.
const CATEGORIES = {
  alphabet: "alphabet", animals: "animals", blocks: "blocks", decoration: "decoration", "food-drinks": "food-and-drinks",
  humans: "humans", humanoid: "humanoid", miscellaneous: "miscellaneous", monsters: "monsters", plants: "plants",
};
const slug = (name) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const textureOf = (value) => /texture\/([0-9a-f]+)/i.exec(Buffer.from(value, "base64").toString("latin1"))?.[1].toLowerCase();

const all = [];
for (const [site, category] of Object.entries(CATEGORIES)) {
  const response = await fetch(`${API}?cat=${site}&ids=true&tags=true`, { headers: { "user-agent": "build-tools (head catalogue)" } });
  if (!response.ok) throw new Error(`${site}: HTTP ${response.status}`);
  const heads = await response.json();
  for (const head of heads) all.push({ ...head, category });
  console.log(`${site}: ${heads.length}`);
}

// mh-ids.bin
const ids = all.map((head) => Number(head.id)).filter((id) => id > 0);
const bits = Math.max(...ids) + 1;
const set = new Uint8Array(8 + Math.ceil(bits / 8));
set.set([..."MHI1"].map((c) => c.charCodeAt(0)));
new DataView(set.buffer).setUint32(4, bits, true);
for (const id of ids) set[8 + (id >> 3)] |= 1 << (id & 7);
fs.writeFileSync(path.join(HEADS, "mh-ids.bin"), set);
console.log(`mh-ids.bin: ${new Set(ids).size} ids up to ${bits - 1}`);

// mh-extra.json: heads headsdb.com lacks, by id. Their tags take the ids of
// headsdb.com's tags of the same name; others are listed in the file.
const catalog = await loadCatalog();
const known = new Set(catalog.heads.map((head) => head.id));
const tagIds = new Map(catalog.tags.map((tag) => [tag.name.toLowerCase(), tag.id]));
const newTags = new Map();
const extra = [];
for (const head of all) {
  const id = Number(head.id), texture = textureOf(head.value || "");
  if (!(id > 0) || known.has(id) || !texture) continue;
  const tags = String(head.tags || "").split(",").map((name) => name.trim()).filter(Boolean).map((name) => {
    const existing = tagIds.get(name.toLowerCase());
    if (existing) return existing;
    const tag = `mh-${slug(name)}`;
    newTags.set(tag, name);
    return tag;
  });
  extra.push({ id, name: head.name, texture, category: head.category, tags: [...new Set(tags)] });
  known.add(id);
}
extra.sort((a, b) => a.id - b.id);
fs.writeFileSync(path.join(HEADS, "mh-extra.json"), JSON.stringify({
  schema: 1, timestamp: new Date().toISOString(), headsdbRevision: catalog.revision,
  tags: [...newTags].map(([id, name]) => ({ id, name })), heads: extra,
}));
console.log(`mh-extra.json: ${extra.length} heads headsdb.com lacks, ${newTags.size} new tags`);
