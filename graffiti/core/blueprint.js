// Export a block grid as an Axiom blueprint (.bp), for Axiom's blueprint
// browser: the file goes into .minecraft/config/axiom/blueprints.
//
// A blueprint is a magic number and three sections, each after its length as a
// 32-bit integer: a header (plain NBT), a thumbnail (PNG) and the blocks
// (gzip-compressed NBT). Blocks are kept as 16×16×16 sections like those of a
// chunk: a palette of block states and their indices packed into longs, with
// structure void for the cells the blueprint leaves alone.
//
// The layout written here is the first one (Version 1 as a long), which every
// Axiom reads; newer ones write Version 2 with void air for the empty cells.
//
// The grid is written as a vertical wall one block thick, centred on the
// blueprint's origin as Axiom's own blueprints are.
import { NbtWriter, TAG } from "./schematic.js";

const MAGIC = 0x0ae5bb36;
const EMPTY = "minecraft:structure_void";
const SECTION = 16, CELLS = SECTION ** 3;

/** "minecraft:barrel[facing=up,open=false]" -> ["minecraft:barrel", [["facing", "up"], ["open", "false"]]]. */
function parseBlock(id) {
  const match = /^([^[]+)(?:\[(.*)\])?$/.exec(id);
  return [match[1], (match[2] || "").split(",").filter((pair) => pair.includes("=")).map((pair) => pair.split("="))];
}

/** The wall cut into sections: [{x, y, states: [block id], cells: Uint16Array of indices into states}]. */
function sections(idx, width, height, palette) {
  const found = new Map();
  const left = -(width >> 1), bottom = -(height >> 1);
  for (let row = 0; row < height; row++) {
    const y = bottom + height - 1 - row;
    for (let col = 0; col < width; col++) {
      const x = left + col;
      const key = `${x >> 4},${y >> 4}`;
      let section = found.get(key);
      if (!section) {
        section = { x: x >> 4, y: y >> 4, states: [EMPTY], index: new Map([[EMPTY, 0]]), cells: new Uint16Array(CELLS) };
        found.set(key, section);
      }
      const id = palette.blocks[idx[row * width + col]].id;
      let i = section.index.get(id);
      if (i === undefined) { i = section.states.length; section.states.push(id); section.index.set(id, i); }
      // The order of a chunk section: y, then z, then x. The wall stands at z = 0.
      section.cells[((y & 15) << 8) | (x & 15)] = i;
    }
  }
  return [...found.values()];
}

/** Indices packed as Minecraft packs them: as many to a long as fit whole, the first in the lowest bits. */
function pack(cells, states) {
  const bits = Math.max(4, Math.ceil(Math.log2(states)));
  const perLong = Math.floor(64 / bits);
  const longs = new BigUint64Array(Math.ceil(cells.length / perLong));
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]) longs[Math.floor(i / perLong)] |= BigInt(cells[i]) << BigInt((i % perLong) * bits);
  }
  return longs;
}

function header(name, blockCount) {
  const w = new NbtWriter();
  w.compound("", () => {
    w.int("BlockCount", blockCount);
    w.header(TAG.LIST, "Tags"); w.u8(TAG.END); w.i32(0);
    w.byte("LockedThumbnail", 1); // the thumbnail is the picture itself, not a view of the blocks
    w.float("ThumbnailPitch", 30);
    w.string("Name", name);
    w.string("Author", "Graffiti");
    w.float("ThumbnailYaw", 135);
    w.long("Version", 1);
    w.byte("ContainsAir", 0);
  });
  return new Uint8Array(w.bytes);
}

function blockData(idx, width, height, palette) {
  const list = sections(idx, width, height, palette);
  const used = new Set();
  const w = new NbtWriter();
  w.compound("", () => {
    w.emptyList("BlockEntities");
    w.emptyList("Entities");
    w.compoundList("BlockRegion", list.length);
    for (const section of list) {
      w.int("Y", section.y);
      w.compound("BlockStates", () => {
        w.compoundList("palette", section.states.length);
        for (const id of section.states) {
          const [blockName, properties] = parseBlock(id);
          w.string("Name", blockName);
          if (properties.length) w.compound("Properties", () => { for (const [key, value] of properties) w.string(key, value); });
          w.end();
          if (id !== EMPTY) used.add(id);
        }
        w.longArray("data", pack(section.cells, section.states.length));
      });
      w.int("Z", 0);
      w.int("X", section.x);
      w.end();
    }
    w.int("DataVersion", palette.dataVersion);
  });
  return { bytes: new Uint8Array(w.bytes), paletteSize: used.size };
}

/**
 * idx: width*height palette indices (row 0 = top); thumbnail: the bytes of a PNG.
 * Returns {bytes, paletteSize}: the whole file, ready to save.
 */
export async function buildBlueprint(idx, width, height, palette, thumbnail, name = "graffiti") {
  const head = header(name, width * height);
  const { bytes: blocks, paletteSize } = blockData(idx, width, height, palette);
  const gzip = new Blob([blocks]).stream().pipeThrough(new CompressionStream("gzip"));
  const packed = new Uint8Array(await new Response(gzip).arrayBuffer());
  const bytes = new Uint8Array(16 + head.length + thumbnail.length + packed.length);
  const view = new DataView(bytes.buffer);
  let at = 0;
  view.setInt32(at, MAGIC); at += 4;
  for (const part of [head, thumbnail, packed]) {
    view.setInt32(at, part.length); at += 4;
    bytes.set(part, at); at += part.length;
  }
  return { bytes, paletteSize };
}
