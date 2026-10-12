// Colours of heads, for finding heads by colour. Each head has up to three main
// colours of its visible sides with the share of each. They are worked out once
// from the skins by tools/build-head-colors.mjs and kept in colors.bin, since a
// browser cannot download 116,000 skins. No DOM access.
import { rgbToLab } from "../shared/mc/color.js";

export const MAX_COLOURS = 3;
const MAGIC = "HCL1";

// Sides of the head in a 64-wide skin: [x, y] of each 8×8 square. The hat layer
// is the same 32 pixels to the right. The bottom is left out: a placed head
// seldom shows it.
const SIDES = [[8, 0], [0, 8], [8, 8], [16, 8], [24, 8]];
const HAT = 32;

/**
 * A short check of the texture a head's colours were taken from, to notice a
 * head whose texture changed since: the last 4 hex digits of the hash.
 */
export const textureCheck = (hash) => parseInt(hash.slice(-4), 16) || 0;

/** The pixels of the head's sides as seen in the game: the hat layer over the head. [[r, g, b]] */
function sidePixels({ data, w, h }) {
  const scale = w / 64;
  const at = (x, y) => (Math.floor(y * scale) * w + Math.floor(x * scale)) * 4;
  // Old 64×32 skins have no transparency: there, a hat layer without a single
  // see-through pixel is not drawn at all, as in the game.
  let hat = true;
  if (h * 2 === w) {
    hat = false;
    for (let y = 0; y < 16 && !hat; y++) for (let x = 32; x < 64; x++) if (data[at(x, y) + 3] < 128) { hat = true; break; }
  }
  const out = [];
  for (const [sx, sy] of SIDES) {
    for (let y = sy; y < sy + 8; y++) {
      for (let x = sx; x < sx + 8; x++) {
        let o = at(x, y);
        if (hat) {
          const over = at(x + HAT, y);
          if (data[over + 3] >= 128) o = over;
        }
        out.push([data[o], data[o + 1], data[o + 2]]);
      }
    }
  }
  return out;
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function labOf([r, g, b]) {
  const out = [0, 0, 0];
  rgbToLab(r, g, b, out, 0);
  return out;
}

/**
 * The main colours of a skin (decoded PNG {data, w, h}): up to three
 * [{rgb, weight}], the largest first, weights adding up to 1. Pixels are
 * grouped by k-means in CIE-Lab; groups closer than ΔE 10 are one colour,
 * and colours under 6% of the head are dropped.
 */
export function skinColours(image) {
  const pixels = sidePixels(image);
  const labs = pixels.map(labOf);
  // Start from the average, then from the pixels farthest from the centres so far.
  const mean = [0, 1, 2].map((c) => labs.reduce((sum, lab) => sum + lab[c], 0) / labs.length);
  const centres = [mean];
  while (centres.length < MAX_COLOURS) {
    let far = null, best = -1;
    for (const lab of labs) {
      const d = Math.min(...centres.map((centre) => distance(lab, centre)));
      if (d > best) { best = d; far = lab; }
    }
    if (best < 1) break;
    centres.push([...far]);
  }
  const owner = new Array(labs.length).fill(0);
  for (let round = 0; round < 10; round++) {
    labs.forEach((lab, i) => {
      let best = Infinity;
      centres.forEach((centre, k) => {
        const d = distance(lab, centre);
        if (d < best) { best = d; owner[i] = k; }
      });
    });
    centres.forEach((centre, k) => {
      const mine = labs.filter((_, i) => owner[i] === k);
      if (mine.length) for (let c = 0; c < 3; c++) centre[c] = mine.reduce((sum, lab) => sum + lab[c], 0) / mine.length;
    });
  }
  // Each group's colour is the average of its pixels in sRGB, as a block's colour in the palettes is.
  let groups = centres.map((centre, k) => {
    const members = pixels.filter((_, i) => owner[i] === k);
    return { lab: centre, count: members.length, sum: [0, 1, 2].map((c) => members.reduce((s, p) => s + p[c], 0)) };
  }).filter((group) => group.count);
  // Merge groups that look the same.
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (distance(groups[i].lab, groups[j].lab) >= 10) continue;
        const a = groups[i], b = groups[j], count = a.count + b.count;
        groups[i] = { lab: a.lab.map((v, c) => (v * a.count + b.lab[c] * b.count) / count), count, sum: a.sum.map((v, c) => v + b.sum[c]) };
        groups.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  groups = groups.filter((group) => group.count / pixels.length >= 0.06).sort((a, b) => b.count - a.count);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return groups.map((group) => ({ rgb: group.sum.map((v) => Math.round(v / group.count)), weight: group.count / total }));
}

// ---------- colors.bin ----------
// "HCL1", catalogue revision (uint32), number of heads (uint32), then for each
// head by increasing id: the id less the one before (varint), the texture
// check (uint16), the number of colours (byte) and each colour as r, g, b and
// its share in 255ths.

/** records: [{id, check, colours: [{rgb, weight}]}] → bytes. */
export function encodeColours(revision, records) {
  const sorted = [...records].sort((a, b) => a.id - b.id);
  const out = [...MAGIC].map((c) => c.charCodeAt(0));
  const uint32 = (v) => out.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
  uint32(revision);
  uint32(sorted.length);
  let last = 0;
  for (const { id, check, colours } of sorted) {
    for (let v = id - last; ; v >>>= 7) {
      if (v < 128) { out.push(v); break; }
      out.push((v & 127) | 128);
    }
    last = id;
    out.push(check & 255, check >>> 8, colours.length);
    for (const { rgb, weight } of colours) out.push(...rgb, Math.max(1, Math.round(weight * 255)));
  }
  return new Uint8Array(out);
}

/** Bytes of colors.bin → { revision, records: [{id, check, colours: [{rgb, weight}]}] }. */
export function decodeColours(bytes) {
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== MAGIC) throw new Error("not a head colour file");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const revision = view.getUint32(4, true), count = view.getUint32(8, true);
  const records = [];
  let at = 12, id = 0;
  for (let i = 0; i < count; i++) {
    let delta = 0;
    for (let shift = 0; ; shift += 7) {
      const byte = bytes[at++];
      delta += (byte & 127) * 2 ** shift;
      if (byte < 128) break;
    }
    id += delta;
    const check = bytes[at] | (bytes[at + 1] << 8), n = bytes[at + 2];
    at += 3;
    const colours = [];
    for (let k = 0; k < n; k++, at += 4) colours.push({ rgb: [bytes[at], bytes[at + 1], bytes[at + 2]], weight: bytes[at + 3] / 255 });
    records.push({ id, check, colours });
  }
  return { revision, records };
}

// ---------- matching ----------
/** Colours as the worker keeps them: Lab of each and its share, or null for a head without colours. */
export function prepare(colours) {
  if (!colours?.length) return null;
  const total = colours.reduce((sum, c) => sum + c.weight, 0);
  return colours.map((c) => ({ lab: labOf(c.rgb), weight: c.weight / total }));
}

// A colour must cover this much of a head to count in the "has" mode; a
// smaller share costs up to SHARE_COST of ΔE, so heads with more of it come first.
const MIN_SHARE = 0.15, SHARE_COST = 12;

/**
 * How far a head is from a Lab colour, in ΔE. "has": the closest of its
 * colours that covers a fair part of it, so purple berries with green leaves
 * count as purple; "mostly": the average over the head's pixels, so a head
 * all in that colour comes first.
 */
export function colourDistance(prepared, lab, mode = "has") {
  if (mode === "has") {
    let best = Infinity;
    for (const c of prepared) if (c.weight >= MIN_SHARE) best = Math.min(best, distance(c.lab, lab) + SHARE_COST * (1 - c.weight));
    return best;
  }
  return prepared.reduce((sum, c) => sum + c.weight * distance(c.lab, lab), 0);
}
