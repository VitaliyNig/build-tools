// Export the art as NBT payloads (not yet gzipped): a Minecraft structure (.nbt)
// for a structure block, a Sponge schematic (.schem) for WorldEdit and the like,
// and for versions before 1.13 an MCEdit .schematic with numeric block ids.
// And as an Axiom blueprint (.bp), a whole file: see shared/mc/blueprint.js.
//
// The structure writer is ported from Image2Banners by MARSTeamMC
// (banners_to_nbt.py), BSD 2-Clause.
// Layout of all: blocks at z = 1, wall banners (facing north) on their front at
// z = 0; x and y are mirrored so the art reads correctly when viewed from the north.
import { buildBlueprint as build } from "../../shared/mc/blueprint.js";
import { legacyBlock } from "../../shared/mc/legacy.js";
import { NbtWriter as Writer, TAG } from "../../shared/mc/nbt.js";
import { commandFormat, legacyLayers } from "./model.js";

const MAX_DECLARED_SIZE = 32;   // larger sizes are not shown by structure blocks

/** "barrel[facing=up,open=false]" -> ["barrel", {facing: "up", open: "false"}]. */
function parseBlock(id) {
  const match = /^([^[]+)(?:\[(.*)\])?$/.exec(id);
  const pairs = (match[2] || "").split(",").filter((pair) => pair.includes("=")).map((pair) => pair.split("="));
  return [match[1], Object.fromEntries(pairs)];
}

/** The patterns of a banner as its block entity stores them in this version. */
function writePatterns(w, banner, modern) {
  if (modern) {
    w.list("patterns", TAG.COMPOUND, banner.length - 1);
    for (const name of banner.slice(1)) {
      const [colour, pattern] = name.split("#");
      w.string("color", colour);
      w.string("pattern", `minecraft:${pattern}`);
      w.end();
    }
  } else {
    // Before 1.20.5: short pattern codes and colour numbers.
    const legacy = legacyLayers(banner);
    w.list("Patterns", TAG.COMPOUND, legacy.length);
    for (const layer of legacy) {
      w.string("Pattern", layer.pattern);
      w.int("Color", layer.colour);
      w.end();
    }
  }
}

// Before 1.13 every wall banner is one block; its colour is in its block entity.
const WALL_BANNER = 177, FACING_NORTH = 2;
const DYES = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"];

/**
 * MCEdit .schematic for Minecraft 1.8 - 1.12, read by WorldEdit 6, Schematica
 * and MCEdit: one numeric id byte and one data byte per block.
 *
 * model: see model.js; its blocks are names of a version before 1.13.
 * Returns the uncompressed NBT bytes.
 */
export function buildLegacySchematic(model, assets) {
  const { width, height } = model;
  const fallback = legacyBlock(assets.defaultBlock) || [1, 0];
  const blocks = new Uint8Array(width * height * 2), data = new Uint8Array(width * height * 2);
  const banners = [];
  // Same order as the Sponge format: (y * Length + z) * Width + x, bottom layer first.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = model.cells[(height - 1 - y) * width + (width - 1 - x)];
      const [id, value] = legacyBlock(cell.block || assets.defaultBlock) || fallback;
      const back = (y * 2 + 1) * width + x, front = y * 2 * width + x;
      blocks[back] = id; data[back] = value;
      if (cell.banner) {
        blocks[front] = WALL_BANNER; data[front] = FACING_NORTH;
        banners.push({ pos: [x, y, 0], banner: cell.banner });
      }
    }
  }

  const w = new Writer();
  w.header(TAG.COMPOUND, "Schematic");
  w.short("Width", width);
  w.short("Height", height);
  w.short("Length", 2);
  w.string("Materials", "Alpha");
  w.byteArray("Blocks", blocks);
  w.byteArray("Data", data);
  w.list("Entities", TAG.COMPOUND, 0);
  w.list("TileEntities", TAG.COMPOUND, banners.length);
  for (const { pos, banner } of banners) {
    // Colours are numbered from black up in these versions.
    const layers = legacyLayers(banner, "old");
    w.string("id", "minecraft:banner");
    w.int("x", pos[0]); w.int("y", pos[1]); w.int("z", pos[2]);
    w.int("Base", 15 - DYES.indexOf(banner[0].split("#")[0]));
    w.list("Patterns", TAG.COMPOUND, layers.length);
    for (const layer of layers) {
      w.string("Pattern", layer.pattern);
      w.int("Color", 15 - layer.colour);
      w.end();
    }
    w.end();
  }
  w.end();
  return new Uint8Array(w.bytes);
}

/**
 * Sponge Schematic version 2 (.schem), read by WorldEdit 7+, FAWE, Litematica
 * and Axiom. Version 2 rather than 3: every reader of 3 also reads 2.
 *
 * model: see model.js; its blocks are ids of a flattened version (1.13+).
 * dataVersion: the Minecraft version the schematic is for.
 * Returns the uncompressed NBT bytes.
 */
export function buildSchem(model, assets, dataVersion) {
  const { width, height } = model;
  const modern = commandFormat(dataVersion) === "modern";
  const states = new Map([["minecraft:air", 0]]);
  const stateOf = (id) => {
    if (!states.has(id)) states.set(id, states.size);
    return states.get(id);
  };
  // Blocks are stored bottom layer first, each layer north to south, west to east:
  // (y * Length + z) * Width + x. The art's row 0 is its top and it is seen from the north.
  const data = [], banners = [];
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < 2; z++) {
      for (let x = 0; x < width; x++) {
        const cell = model.cells[(height - 1 - y) * width + (width - 1 - x)];
        let state = 0;
        if (z === 1) state = stateOf(`minecraft:${cell.block || assets.defaultBlock}`);
        else if (cell.banner) {
          state = stateOf(`minecraft:${cell.banner[0].replace("#", "_")}[facing=north]`);
          banners.push({ pos: [x, y, z], banner: cell.banner });
        }
        // Palette indices are written as varints.
        for (; state > 0x7f; state >>>= 7) data.push((state & 0x7f) | 0x80);
        data.push(state);
      }
    }
  }

  const w = new Writer();
  w.header(TAG.COMPOUND, "Schematic");
  w.int("Version", 2);
  w.int("DataVersion", dataVersion);
  w.short("Width", width);
  w.short("Height", height);
  w.short("Length", 2);
  w.intArray("Offset", [0, 0, 0]);
  w.int("PaletteMax", states.size);
  w.header(TAG.COMPOUND, "Palette");
  for (const [id, index] of states) w.int(id, index);
  w.end();
  w.byteArray("BlockData", data);
  w.list("BlockEntities", TAG.COMPOUND, banners.length);
  for (const { pos, banner } of banners) {
    w.intArray("Pos", pos);
    w.string("Id", "minecraft:banner");
    writePatterns(w, banner, modern);
    w.end();
  }
  w.header(TAG.COMPOUND, "Metadata");
  w.int("WEOffsetX", 0); w.int("WEOffsetY", 0); w.int("WEOffsetZ", 0);
  w.end();
  w.end();
  return new Uint8Array(w.bytes);
}

/**
 * model: see model.js; its blocks are ids of a flattened version (1.13+).
 * dataVersion: the Minecraft version the structure is for.
 * Returns the uncompressed NBT bytes.
 */
export function buildStructure(model, assets, dataVersion) {
  const { width, height } = model;
  const modern = commandFormat(dataVersion) === "modern";
  const cells = model.cells.map((cell) => ({ block: cell.block || assets.defaultBlock, banner: cell.banner }));
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
      writePatterns(w, cell.banner, modern);
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
  for (const block of blocks) state(...parseBlock(block));
  for (const banner of banners) state(banner, { facing: "north" });

  w.int("DataVersion", dataVersion);
  w.end();
  return new Uint8Array(w.bytes);
}

/**
 * Axiom blueprint (.bp), centred on its origin as Axiom's own blueprints are.
 *
 * model: see model.js; its blocks are ids of a flattened version (1.13+).
 * thumbnail: the bytes of a PNG. Returns the bytes of the whole file.
 */
export async function buildBlueprint(model, assets, dataVersion, thumbnail, name) {
  const { width, height } = model;
  const modern = commandFormat(dataVersion) === "modern";
  const left = -(width >> 1), bottom = -(height >> 1);
  const blocks = [], blockEntities = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cell = model.cells[row * width + col];
      const x = left + width - 1 - col, y = bottom + height - 1 - row;
      blocks.push([x, y, 1, `minecraft:${cell.block || assets.defaultBlock}`]);
      if (!cell.banner) continue;
      blocks.push([x, y, 0, `minecraft:${cell.banner[0].replace("#", "_")}[facing=north]`]);
      blockEntities.push({ x, y, z: 0, id: "minecraft:banner", write: (w) => writePatterns(w, cell.banner, modern) });
    }
  }
  return (await build({ blocks, blockEntities, dataVersion, thumbnail, name, author: "Image2Banners" })).bytes;
}
