// Loads the bundled banner-pattern textures and joins them with the blocks of a
// Minecraft version (works in pages and workers).
import { prepareAssets } from "./core/generate.js";
import { decodePng } from "./core/png.js";

const BASE = new URL("./assets/", import.meta.url);
// Blocks nobody builds a wall of.
const TECHNICAL = /command_block|structure_block|jigsaw|bedrock|barrier|spawner|budding_amethyst|reinforced_deepslate|test_block|test_instance|infested_|monster_egg|frosted_ice/;

async function png(name) {
  const response = await fetch(new URL(name, BASE));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return decodePng(new Uint8Array(await response.arrayBuffer()));
}

let loading = null;

function loadPatterns() {
  loading ||= Promise.all([
    fetch(new URL("meta.json", BASE)).then((response) => response.json()),
    png("patterns.png"),
  ]);
  return loading;
}

// Blocks that can also face up and down.
const FACES_UP = /dispenser|dropper|piston/;
// A crafter turned so that another of its sides faces north. Sides are listed south, east, west.
const CRAFTER = { top: "down_north", bottom: "up_south", side: ["south_up", "west_up", "east_up"] };

/**
 * The state in which another side of a block faces north, where the viewer of
 * the art stands: a log lying north-south shows its end. null when the block
 * cannot be turned that way (the top of a crafting table).
 *
 * id:   the block in the state its own picture was taken from, which is not turned.
 * face: "top", "bottom" or "side"; nth counts the block's "side" faces.
 */
function turnedTo(id, face, nth) {
  const [, block, list = ""] = /^([^[]+)(?:\[(.*)\])?$/.exec(id);
  const properties = new Map(list.split(",").filter((pair) => pair.includes("=")).map((pair) => pair.split("=")));
  const set = (key, value) => {
    if (!value) return null;
    properties.set(key, value);
    return `${block}[${[...properties].map((pair) => pair.join("=")).join(",")}]`;
  };
  if (properties.has("orientation")) {
    return block === "crafter" ? set("orientation", face === "side" ? CRAFTER.side[nth] : CRAFTER[face]) : null;
  }
  // The ends of a pillar are its top and bottom, or its sides when it is drawn lying down.
  if (properties.has("axis")) return face === (properties.get("axis") === "y" ? "top" : "side") ? set("axis", "z") : null;
  const facing = properties.get("facing");
  if (facing === "up") return set("facing", { top: "north", bottom: "south" }[face]);
  if (facing === "north") {
    // Turned away, the back is in front; on its back, a block shows what was its top.
    if (face === "side") return nth ? null : set("facing", "south");
    if (face === "top" && FACES_UP.test(block)) return set("facing", "up");
  }
  return null;
}

/**
 * The blocks of a palette (shared/mc/palette.js) that can back a banner:
 * {names, labels, tiles}, see prepareAssets. Besides every block seen from the
 * front, its other sides where the block can be turned to show them.
 * Plain data, so it can be sent to a worker.
 */
export function blockSetOf(palette) {
  const bytes = palette.tiles.length / palette.blocks.length;
  const names = [], labels = [], sources = [];
  palette.blocks.forEach((block, i) => {
    if (TECHNICAL.test(block.id)) return;
    names.push(block.id.replace(/^minecraft:/, ""));
    labels.push(block.name);
    sources.push(palette.tiles.subarray(i * bytes, (i + 1) * bytes));
  });
  const sideCount = new Map();
  (palette.faces || []).forEach((face, i) => {
    const block = palette.blocks[face.block];
    const nth = face.face === "side" ? sideCount.get(face.block) || 0 : 0;
    if (face.face === "side") sideCount.set(face.block, nth + 1);
    const name = TECHNICAL.test(block.id) ? null : turnedTo(block.id.replace(/^minecraft:/, ""), face.face, nth);
    if (!name || names.includes(name)) return;
    names.push(name);
    labels.push(`${block.name} (${face.face})`);
    sources.push(palette.faceTiles.subarray(i * bytes, (i + 1) * bytes));
  });
  const tiles = new Uint8Array(names.length * bytes);
  sources.forEach((tile, i) => tiles.set(tile, i * bytes));
  return { names, labels, tiles };
}

/** Everything generation and drawing need, for one set of blocks. */
export async function loadAssets(blockSet) {
  const [meta, patterns] = await loadPatterns();
  return prepareAssets(meta, patterns, blockSet);
}
