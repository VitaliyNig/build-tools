// Writer of Axiom blueprints (.bp), for Axiom's blueprint browser: the file
// goes into .minecraft/config/axiom/blueprints.
//
// A blueprint is a magic number and three sections, each after its length as a
// 32-bit integer: a header (plain NBT), a thumbnail (PNG) and the blocks
// (gzip-compressed NBT). Blocks are kept as 16×16×16 sections like those of a
// chunk: a palette of block states and their indices packed into longs, with
// structure void for the cells the blueprint leaves alone. Block entities are
// listed apart, each with its position in the blueprint.
//
// The layout written here is the first one (Version 1 as a long), which every
// Axiom reads; newer ones write Version 2 with void air for the empty cells.
import { NbtWriter, TAG } from "./nbt.js";

const MAGIC = 0x0ae5bb36;
const EMPTY = "minecraft:structure_void";
const CELLS = 16 ** 3;

/** "minecraft:barrel[facing=up,open=false]" -> ["minecraft:barrel", [["facing", "up"], ["open", "false"]]]. */
function parseBlock(id) {
  const match = /^([^[]+)(?:\[(.*)\])?$/.exec(id);
  return [match[1], (match[2] || "").split(",").filter((pair) => pair.includes("=")).map((pair) => pair.split("="))];
}

/** The blocks cut into sections: [{x, y, z, states: [block id], cells: Uint16Array of indices into states}]. */
function sections(blocks) {
  const found = new Map();
  for (const [x, y, z, id] of blocks) {
    const key = `${x >> 4},${y >> 4},${z >> 4}`;
    let section = found.get(key);
    if (!section) {
      section = { x: x >> 4, y: y >> 4, z: z >> 4, states: [EMPTY], index: new Map([[EMPTY, 0]]), cells: new Uint16Array(CELLS) };
      found.set(key, section);
    }
    let i = section.index.get(id);
    if (i === undefined) { i = section.states.length; section.states.push(id); section.index.set(id, i); }
    // The order of a chunk section: y, then z, then x.
    section.cells[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)] = i;
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

function header(name, author, blockCount) {
  const w = new NbtWriter();
  w.compound("", () => {
    w.int("BlockCount", blockCount);
    w.list("Tags", TAG.END, 0);
    w.byte("LockedThumbnail", 1); // the thumbnail is a picture given to us, not a view of the blocks
    w.float("ThumbnailPitch", 30);
    w.string("Name", name);
    w.string("Author", author);
    w.float("ThumbnailYaw", 135);
    w.long("Version", 1);
    w.byte("ContainsAir", 0);
  });
  return new Uint8Array(w.bytes);
}

function blockData(blocks, blockEntities, dataVersion) {
  const list = sections(blocks);
  const used = new Set();
  const w = new NbtWriter();
  w.compound("", () => {
    w.list("BlockEntities", TAG.COMPOUND, blockEntities.length);
    for (const entity of blockEntities) {
      w.int("x", entity.x); w.int("y", entity.y); w.int("z", entity.z);
      w.string("id", entity.id);
      entity.write?.(w);
      w.end();
    }
    w.emptyList("Entities");
    w.list("BlockRegion", TAG.COMPOUND, list.length);
    for (const section of list) {
      w.int("Y", section.y);
      w.compound("BlockStates", () => {
        w.list("palette", TAG.COMPOUND, section.states.length);
        for (const id of section.states) {
          const [blockName, properties] = parseBlock(id);
          w.string("Name", blockName);
          if (properties.length) w.compound("Properties", () => { for (const [key, value] of properties) w.string(key, value); });
          w.end();
          if (id !== EMPTY) used.add(id);
        }
        w.longArray("data", pack(section.cells, section.states.length));
      });
      w.int("Z", section.z);
      w.int("X", section.x);
      w.end();
    }
    w.int("DataVersion", dataVersion);
  });
  return { bytes: new Uint8Array(w.bytes), paletteSize: used.size };
}

/**
 * blocks:        [[x, y, z, id]], ids with their namespace and properties; the
 *                blueprint is placed by its origin, so centre them on it
 * blockEntities: [{x, y, z, id, write(w)}]; write adds the entity's own tags
 * thumbnail:     the bytes of a PNG, 96×96 as Axiom's own
 * Returns {bytes, paletteSize}: the whole file, ready to save.
 */
export async function buildBlueprint({ blocks, blockEntities = [], dataVersion, thumbnail, name, author }) {
  const head = header(name, author, blocks.length);
  const { bytes: data, paletteSize } = blockData(blocks, blockEntities, dataVersion);
  const gzip = new Blob([data]).stream().pipeThrough(new CompressionStream("gzip"));
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
