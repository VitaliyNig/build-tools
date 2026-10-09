// Export a block grid as schematic NBT payloads (not yet gzipped).
//
// 1.13 and newer: Sponge Schematic v2 (.schem), readable by WorldEdit 7+
// (`//schem load`), FAWE, Litematica and Axiom. Version 2 is used rather than 3
// because every reader of v3 also reads v2, but not the other way round.
// 1.12 and older: MCEdit .schematic with numeric block ids (WorldEdit 6, Schematica).
//
// The grid is written as a vertical wall: Width = image columns, Height = image
// rows, Length (depth) = 1.
import { isLegacy, legacyBlock } from "../../shared/mc/legacy.js";

const TAG = { END: 0, SHORT: 2, INT: 3, BYTE_ARRAY: 7, STRING: 8, LIST: 9, COMPOUND: 10, INT_ARRAY: 11 };
const encoder = new TextEncoder();

class NbtWriter {
  constructor() { this.bytes = []; }
  u8(v) { this.bytes.push(v & 0xff); }
  i16(v) { this.u8(v >> 8); this.u8(v); }
  i32(v) { this.u8(v >> 24); this.u8(v >> 16); this.u8(v >> 8); this.u8(v); }
  header(tag, name) {
    const utf8 = encoder.encode(name);
    this.u8(tag); this.i16(utf8.length);
    for (const b of utf8) this.bytes.push(b);
  }
  short(name, v) { this.header(TAG.SHORT, name); this.i16(v); }
  int(name, v) { this.header(TAG.INT, name); this.i32(v); }
  intArray(name, values) {
    this.header(TAG.INT_ARRAY, name); this.i32(values.length);
    for (const v of values) this.i32(v);
  }
  byteArray(name, values) {
    this.header(TAG.BYTE_ARRAY, name); this.i32(values.length);
    for (const v of values) this.bytes.push(v);
  }
  string(name, value) {
    const utf8 = encoder.encode(value);
    this.header(TAG.STRING, name); this.i16(utf8.length);
    for (const b of utf8) this.bytes.push(b);
  }
  emptyList(name) { this.header(TAG.LIST, name); this.u8(TAG.COMPOUND); this.i32(0); }
  compound(name, body) { this.header(TAG.COMPOUND, name); body(); this.u8(TAG.END); }
}

/**
 * Build the schematic that the result's Minecraft version can load.
 * Returns {bytes, paletteSize, extension}.
 */
export function buildSchematic(idx, width, height, palette) {
  return isLegacy(palette.dataVersion)
    ? { ...buildLegacySchematic(idx, width, height, palette), extension: "schematic" }
    : { ...buildSchem(idx, width, height, palette), extension: "schem" };
}

/** MCEdit .schematic: one numeric id byte and one data byte per block. */
export function buildLegacySchematic(idx, width, height, palette) {
  const legacy = palette.blocks.map((block) => legacyBlock(block.id));
  const blocks = new Uint8Array(width * height), data = new Uint8Array(width * height);
  const used = new Set();
  // Same order as Sponge: (y*Length + z)*Width + x with y=0 at the bottom.
  for (let y = 0; y < height; y++) {
    const row = (height - 1 - y) * width;
    for (let x = 0; x < width; x++) {
      const p = idx[row + x], block = legacy[p];
      if (!block) throw new Error(`No pre-1.13 id for ${palette.blocks[p].id}`);
      blocks[y * width + x] = block[0];
      data[y * width + x] = block[1];
      used.add(p);
    }
  }
  const w = new NbtWriter();
  w.compound("Schematic", () => {
    w.short("Width", width);
    w.short("Height", height);
    w.short("Length", 1);
    w.string("Materials", "Alpha");
    w.byteArray("Blocks", blocks);
    w.byteArray("Data", data);
    w.emptyList("Entities");
    w.emptyList("TileEntities");
  });
  return { bytes: new Uint8Array(w.bytes), paletteSize: used.size };
}

/** idx: width*height palette indices (row 0 = top). Returns {bytes, paletteSize}. */
export function buildSchem(idx, width, height, palette) {
  const stateIndex = new Map();
  const data = [];
  // Sponge order: (y*Length + z)*Width + x, Length=1. y=0 is the bottom row,
  // so flip vertically relative to the image (row 0 = top).
  for (let y = 0; y < height; y++) {
    const row = (height - 1 - y) * width;
    for (let x = 0; x < width; x++) {
      const id = palette.blocks[idx[row + x]].id;
      let i = stateIndex.get(id);
      if (i === undefined) { i = stateIndex.size; stateIndex.set(id, i); }
      for (; i > 0x7f; i >>>= 7) data.push((i & 0x7f) | 0x80);
      data.push(i);
    }
  }

  const w = new NbtWriter();
  w.compound("Schematic", () => {
    w.int("Version", 2);
    w.int("DataVersion", palette.dataVersion);
    w.short("Width", width);
    w.short("Height", height);
    w.short("Length", 1);
    w.intArray("Offset", [0, 0, 0]);
    w.int("PaletteMax", stateIndex.size);
    w.compound("Palette", () => { for (const [id, i] of stateIndex) w.int(id, i); });
    w.byteArray("BlockData", data);
    w.compound("Metadata", () => {
      w.int("WEOffsetX", 0); w.int("WEOffsetY", 0); w.int("WEOffsetZ", 0);
    });
  });
  return { bytes: new Uint8Array(w.bytes), paletteSize: stateIndex.size };
}
