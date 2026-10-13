// Build heads/mh-ids.bin: which head ids the catalogue of minecraft-heads.com
// has. The HeadDatabase plugin by Arcaniax gives heads from that catalogue,
// with the same ids as headsdb.com; a head missing from it may be missing on
// a server with that plugin, so the Heads tool marks it.
//
//   node tools/build-hdb-ids.mjs
//
// It reads every category of the site's public API. The file is a bit set:
// "MHI1", the number of bits (uint32), then bit n set when id n is there.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "heads", "mh-ids.bin");
const API = "https://minecraft-heads.com/scripts/api.php";
const CATEGORIES = ["alphabet", "animals", "blocks", "decoration", "food-drinks", "humans", "humanoid", "miscellaneous", "monsters", "plants"];

const ids = [];
for (const category of CATEGORIES) {
  const response = await fetch(`${API}?cat=${category}&ids=true`, { headers: { "user-agent": "build-tools (head catalogue check)" } });
  if (!response.ok) throw new Error(`${category}: HTTP ${response.status}`);
  const heads = await response.json();
  for (const head of heads) if (Number(head.id) > 0) ids.push(Number(head.id));
  console.log(`${category}: ${heads.length}`);
}
const bits = Math.max(...ids) + 1;
const out = new Uint8Array(8 + Math.ceil(bits / 8));
out.set([..."MHI1"].map((c) => c.charCodeAt(0)));
new DataView(out.buffer).setUint32(4, bits, true);
for (const id of ids) out[8 + (id >> 3)] |= 1 << (id & 7);
fs.writeFileSync(OUT, out);
console.log(`wrote ${new Set(ids).size} ids up to ${bits - 1} (${out.length} bytes)`);
