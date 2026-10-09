// Export the art as a Minecraft structure (.nbt, not yet gzipped) for a structure block.
//
// Ported from Image2Banners by MARSTeamMC (banners_to_nbt.py), BSD 2-Clause.
// Layout: blocks at z = 1, wall banners (facing north) on their front at z = 0;
// x and y are mirrored so the art reads correctly when viewed from the north.
import { DEFAULT_BLOCK } from "./generate.js";

const TAG = { END: 0, INT: 3, STRING: 8, LIST: 9, COMPOUND: 10 };
const DATA_VERSION = 4440;      // Minecraft 1.21.7
const MAX_DECLARED_SIZE = 32;   // larger sizes are not shown by structure blocks
const encoder = new TextEncoder();

class Writer {
  constructor() { this.bytes = []; }
  u8(v) { this.bytes.push(v & 0xff); }
  i16(v) { this.u8(v >> 8); this.u8(v); }
  i32(v) { this.u8(v >> 24); this.u8(v >> 16); this.u8(v >> 8); this.u8(v); }
  text(value) {
    const utf8 = encoder.encode(value);
    this.i16(utf8.length);
    for (const b of utf8) this.bytes.push(b);
  }
  header(tag, name) { this.u8(tag); this.text(name); }
  int(name, v) { this.header(TAG.INT, name); this.i32(v); }
  string(name, v) { this.header(TAG.STRING, name); this.text(v); }
  list(name, elementTag, length) { this.header(TAG.LIST, name); this.u8(elementTag); this.i32(length); }
  intList(name, values) { this.list(name, TAG.INT, values.length); for (const v of values) this.i32(v); }
  end() { this.u8(TAG.END); }
}

/** Block-state properties that make the texture named "<block>-<face>" face north. */
function faceProperties(block, face) {
  if (block.includes("crafter")) {
    const orientation = { east: "west_up", bottom: "up_south", south: "south_up", top: "down_north", west: "east_up" }[face];
    return orientation ? { orientation } : {};
  }
  return {
    top: { axis: "z" }, side: { facing: "east" }, front: { facing: "north" },
    up: { facing: "up" }, lit: { lit: "true" }, inside: { north: "false" },
  }[face] || {};
}

function blockProperties(block) {
  if (block.includes("trapdoor")) return { facing: "south", open: "true" };
  if (block.includes("shulker")) return { facing: "north" };
  if (block.includes("smooth_stone_slab")) return { type: "double" };
  return {};
}

/** model: see model.js. Returns the uncompressed NBT bytes. */
export function buildStructure(model) {
  const { width, height } = model;
  const cells = model.cells.map((cell) => ({ block: cell.block || DEFAULT_BLOCK, banner: cell.banner }));
  const blocks = [...new Set(cells.map((cell) => cell.block))];
  const banners = [...new Set(cells.filter((cell) => cell.banner).map((cell) => cell.banner[0].replace("#", "_")))];
  const position = (i, z) => [width - (i % width) - 1, height - Math.floor(i / width) - 1, z];

  const w = new Writer();
  w.header(TAG.COMPOUND, "");
  w.intList("size", [Math.min(width, MAX_DECLARED_SIZE), Math.min(height, MAX_DECLARED_SIZE), 2]);
  w.list("entities", TAG.COMPOUND, 0);

  w.list("blocks", TAG.COMPOUND, cells.length * 2);
  cells.forEach((cell, i) => {
    w.intList("pos", position(i, 1));
    w.int("state", 1 + blocks.indexOf(cell.block));
    w.end();
  });
  cells.forEach((cell, i) => {
    if (cell.banner) {
      w.header(TAG.COMPOUND, "nbt");
      w.list("patterns", TAG.COMPOUND, cell.banner.length - 1);
      for (const name of cell.banner.slice(1)) {
        const [colour, pattern] = name.split("#");
        w.string("color", colour);
        w.string("pattern", `minecraft:${pattern}`);
        w.end();
      }
      w.string("id", "minecraft:banner");
      w.end();
    }
    w.intList("pos", position(i, 0));
    // State 0 is air: cells without a banner leave the front layer empty.
    w.int("state", cell.banner ? 1 + blocks.length + banners.indexOf(cell.banner[0].replace("#", "_")) : 0);
    w.end();
  });

  w.list("palette", TAG.COMPOUND, blocks.length + banners.length + 1);
  w.string("Name", "minecraft:air");
  w.end();
  const state = (name, properties) => {
    w.header(TAG.COMPOUND, "Properties");
    for (const [key, value] of Object.entries(properties)) w.string(key, value);
    w.end();
    w.string("Name", `minecraft:${name}`);
    w.end();
  };
  for (const block of blocks) {
    const dash = block.indexOf("-");
    if (dash < 0) state(block, blockProperties(block));
    else state(block.slice(0, dash), faceProperties(block.slice(0, dash), block.slice(dash + 1)));
  }
  for (const banner of banners) state(banner, { facing: "north" });

  w.int("DataVersion", DATA_VERSION);
  w.end();
  return new Uint8Array(w.bytes);
}
