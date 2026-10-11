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
import { NbtWriter } from "../../shared/mc/nbt.js";

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
