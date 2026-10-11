// Finding the textures of heads in whatever a player can copy out of the game:
// a block copied with F3+I, a /give or /setblock command, a texture value or
// URL, or a structure file saved with WorldEdit, Litematica or a structure
// block. A head's texture is the same in the world and in the catalogue, so
// it tells which catalogue head a placed head is.

const URL_PATTERN = /textures\.minecraft\.net\/texture\/([0-9a-f]{20,})/gi;
const BASE64_PATTERN = /[A-Za-z0-9+/]{40,}={0,2}/g;
const HASH_PATTERN = /\b[0-9a-f]{50,64}\b/gi;
const HDB_PATTERN = /\/(?:hdb|headdb)\s+(?:give|g|info|i)\s+(\d+)/gi;

/** A texture hash in one spelling: lower case, without leading zeros, which some tools drop. */
export const normalizeTexture = (hash) => hash.toLowerCase().replace(/^0+/, "");

function decodeBase64(text) {
  try {
    const padded = text + "=".repeat((4 - (text.length % 4)) % 4);
    return atob(padded);
  } catch {
    return "";
  }
}

/**
 * The heads a text points at, in the order they appear, each once:
 * { textures: [hash], ids: [HeadDB id] }.
 */
export function findInText(text) {
  // Positions keep the order of the text when the three kinds of mention mix.
  const at = [];
  for (const match of text.matchAll(URL_PATTERN)) at.push([match.index, match[1]]);
  for (const match of text.matchAll(BASE64_PATTERN)) {
    for (const inner of decodeBase64(match[0]).matchAll(URL_PATTERN)) at.push([match.index, inner[1]]);
  }
  for (const match of text.matchAll(HASH_PATTERN)) {
    // A hash that is part of a URL was taken above.
    if (!/texture\/$/i.test(text.slice(Math.max(0, match.index - 8), match.index))) at.push([match.index, match[0]]);
  }
  at.sort((a, b) => a[0] - b[0]);
  const textures = [...new Set(at.map(([, hash]) => normalizeTexture(hash)))];
  const ids = [...new Set([...text.matchAll(HDB_PATTERN)].map((match) => Number(match[1])))];
  return { textures, ids };
}

// ---------- structure files ----------
const isGzip = (bytes, at = 0) => bytes[at] === 0x1f && bytes[at + 1] === 0x8b && bytes[at + 2] === 0x08;

/**
 * Unpack gzip data that starts at the beginning of `bytes`. Whatever follows
 * the compressed data is ignored, as are damaged ends: what was unpacked
 * until then is kept.
 */
async function gunzip(bytes) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const parts = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      size += value.length;
    }
  } catch { /* trailing bytes or a damaged end */ }
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

/**
 * The NBT data in a file. .schem, .schematic, .litematic and .nbt files are
 * gzip-compressed NBT. Others, as Axiom's .bp blueprints, put a header and a
 * picture before compressed block data, each section after its length: every
 * gzip stream in them is read.
 */
async function nbtParts(bytes) {
  if (isGzip(bytes)) return [await gunzip(bytes)];
  // Plain NBT, or a header that only looks like it (Axiom's magic number starts with the same byte).
  const parts = bytes[0] === 10 ? [bytes] : [];
  for (let at = 1; at < bytes.length - 3 && parts.length < 65; at++) {
    if (!isGzip(bytes, at)) continue;
    // Axiom writes the length of each section before it; the stream has to end
    // exactly where the data does, or decompression gives nothing.
    const length = at >= 4 ? new DataView(bytes.buffer, bytes.byteOffset + at - 4, 4).getInt32(0) : 0;
    const end = length > 0 && at + length <= bytes.length ? at + length : bytes.length;
    const part = await gunzip(bytes.subarray(at, end));
    if (part.length) parts.push(part);
  }
  return parts;
}

/**
 * Every string in an NBT file, in file order. Textures sit in different
 * places in each format and version (SkullOwner, profile, Data…), so all
 * strings are read instead of following any one layout.
 */
function nbtStrings(bytes) {
  const strings = [];
  try { readNbt(bytes, strings); } catch { /* cut short: keep the strings read so far */ }
  return strings;
}

function readNbt(bytes, strings) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let at = 0;
  const string = () => {
    const length = view.getUint16(at);
    at += 2;
    const text = decoder.decode(bytes.subarray(at, at + length));
    at += length;
    return text;
  };
  const payload = (type) => {
    switch (type) {
      case 1: at += 1; break;
      case 2: at += 2; break;
      case 3: case 5: at += 4; break;
      case 4: case 6: at += 8; break;
      case 7: at += 4 + view.getInt32(at); break;
      case 8: strings.push(string()); break;
      case 9: {
        const inner = view.getUint8(at);
        const count = view.getInt32(at + 1);
        at += 5;
        for (let i = 0; i < count; i++) payload(inner);
        break;
      }
      case 10:
        for (;;) {
          const inner = view.getUint8(at++);
          if (inner === 0) break;
          string(); // the name
          payload(inner);
        }
        break;
      case 11: at += 4 + 4 * view.getInt32(at); break;
      case 12: at += 4 + 8 * view.getInt32(at); break;
      default: throw new Error(`unknown NBT tag ${type}`);
    }
  };
  const root = view.getUint8(at++);
  if (root !== 10) throw new Error("not an NBT file");
  string();
  payload(10);
}

/** The heads in a structure file: how often each texture occurs, and the textures in order. */
export async function findInFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const strings = [];
  for (const part of await nbtParts(bytes)) strings.push(...nbtStrings(part));
  // Not NBT at all: maybe a text file with commands.
  const text = strings.length ? strings.join("\n") : new TextDecoder().decode(bytes);
  const counts = new Map();
  for (const line of text.split("\n")) {
    for (const hash of findInText(line).textures) counts.set(hash, (counts.get(hash) || 0) + 1);
  }
  return { ...findInText(text), counts };
}
