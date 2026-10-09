// Colour matching and gradients over a block palette. No DOM access.
import { rgbToLab } from "../shared/mc/color.js";
import { DECO_PX, TILE_PX } from "../shared/mc/palette.js";

// Blocks that fall when unsupported, and blocks that are not ordinary building material.
const FALLING = /(^|_)(sand|gravel|concrete_powder|anvil)$|^suspicious_|^dragon_egg$/;
const TECHNICAL = /command_block|structure_block|jigsaw|bedrock|barrier|spawner|budding_amethyst|reinforced_deepslate|test_block|test_instance|infested_|monster_egg|frosted_ice|^light$/;

const PIXELS = TILE_PX * TILE_PX;

/** Standard deviation of a tile's brightness: 0 for a flat colour, ~40+ for busy textures. */
function noiseOf(tiles, index, channels, pixels = PIXELS) {
  let sum = 0, squares = 0, count = 0;
  for (let p = 0; p < pixels; p++) {
    const s = (index * pixels + p) * channels;
    if (channels === 4 && tiles[s + 3] < 128) continue;
    const luma = 0.299 * tiles[s] + 0.587 * tiles[s + 1] + 0.114 * tiles[s + 2];
    sum += luma; squares += luma * luma; count++;
  }
  if (!count) return 0;
  const mean = sum / count;
  return Math.sqrt(Math.max(0, squares / count - mean * mean));
}

/** Short id used in links and storage: no namespace. */
export function shortId(id) {
  return id.replace(/^minecraft:/, "");
}

/**
 * Flatten a palette into matchable entries:
 * [{kind: "block" | "face" | "deco", index, id, name, rgb, lab, noise, sides,
 *   falling, technical, hidden}].
 * "block" is a full cube seen from its north side; "face" is another side of a
 * cube that looks different. `sides` is the set of sides ("top", "bottom",
 * "side") on which the entry's picture is what you see.
 */
export function listEntries(palette) {
  const make = (kind, source, lab, tiles, channels) => source.map((item, index) => {
    const name = shortId(item.id).replace(/\[.*$/, "");
    return {
      kind, index, id: shortId(item.id), name: item.name, rgb: item.rgb,
      lab: [lab[index * 3], lab[index * 3 + 1], lab[index * 3 + 2]],
      noise: noiseOf(tiles, index, channels, channels === 4 ? DECO_PX * DECO_PX : PIXELS),
      falling: FALLING.test(name), technical: TECHNICAL.test(name),
    };
  });
  // A double slab is listed as a block because it fills the whole cube, but it
  // is drawn exactly like the block it is made from, so it would show up as a
  // second "Oak Planks" tile labelled "Oak Slab". Keep only the double slabs
  // that look like nothing else (smooth stone), and say what they are.
  const texture = (index) => palette.tiles.subarray(index * PIXELS * 3, (index + 1) * PIXELS * 3).join();
  const isSlab = (entry) => /slab/.test(entry.id);
  const blocks = make("block", palette.blocks, palette.lab, palette.tiles, 3);
  const fullBlocks = new Set(blocks.filter((entry) => !isSlab(entry)).map((entry) => texture(entry.index)));
  for (const entry of blocks) {
    if (!isSlab(entry)) continue;
    // Hidden entries stay known, so palettes saved earlier still resolve them.
    entry.hidden = fullBlocks.has(texture(entry.index));
    if (!/double/i.test(entry.name)) entry.name = `${entry.name} (double)`;
  }
  // A block's own picture is its side. It is also its top or bottom unless that
  // side has a picture of its own: stone looks the same from above, a log does not.
  for (const entry of blocks) entry.sides = new Set(palette.blocks[entry.index].sides || ["side", "top", "bottom"]);

  // Other sides are entries of their own, named after their block: "Oak Log Top".
  const numbering = new Map();
  const faces = palette.faces.map((face, index) => {
    const block = blocks[face.block], key = `${block.id}#${face.face}`;
    const count = (numbering.get(key) || 0) + 1;
    numbering.set(key, count);
    return {
      kind: "face", index, id: count > 1 ? `${key}${count}` : key,
      name: `${block.name} ${face.face[0].toUpperCase()}${face.face.slice(1)}`,
      rgb: face.rgb, lab: [palette.faceLab[index * 3], palette.faceLab[index * 3 + 1], palette.faceLab[index * 3 + 2]],
      noise: noiseOf(palette.faceTiles, index, 3), sides: new Set(face.sides || [face.face]),
      falling: block.falling, technical: block.technical, hidden: block.hidden,
    };
  });
  return [...blocks, ...faces, ...make("deco", palette.decorations, palette.decoLab, palette.decoTiles, 4)];
}

export function labOf(rgb) {
  const out = [0, 0, 0];
  rgbToLab(rgb[0], rgb[1], rgb[2], out, 0);
  return out;
}

/**
 * Entries sorted by closeness to a Lab colour. smooth (0..1) adds a penalty for
 * busy textures, so flat blocks win over noisy ones of the same average colour.
 */
export function rank(entries, lab, smooth = 0) {
  const score = (entry) => Math.hypot(entry.lab[0] - lab[0], entry.lab[1] - lab[1], entry.lab[2] - lab[2])
    + smooth * 0.6 * entry.noise;
  return entries.map((entry) => [score(entry), entry]).sort((a, b) => a[0] - b[0]).map(([, entry]) => entry);
}

// ---------- OkLab, for perceptually even gradients ----------
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function rgbToOklab([r, g, b]) {
  r = toLinear(r / 255); g = toLinear(g / 255); b = toLinear(b / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const channel = (v) => Math.round(255 * Math.min(1, Math.max(0, toSrgb(v))));
  return [
    channel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    channel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    channel(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}

// ---------- harmonies ----------
// Scheme colours are HSV ({h: degrees, s: 0..1, v: 0..1}), the model of a colour
// wheel: hue is the angle, saturation the distance from the centre.

export function rgbToHsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

export function hsvToRgb({ h, s, v }) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
}

const unit = (x) => Math.min(1, Math.max(0, x));

// Each colour of a rule is [hue offset in degrees, saturation factor, brightness
// factor] relative to the base colour; `base` is the index of the base itself.
export const HARMONY_RULES = {
  analogous: { base: 2, colours: [[-30, 1, 1], [-15, 1, 1], [0, 1, 1], [15, 1, 1], [30, 1, 1]] },
  complementary: { base: 2, colours: [[0, 1, 0.7], [0, 0.6, 1], [0, 1, 1], [180, 1, 1], [180, 1, 0.7]] },
  split: { base: 2, colours: [[150, 1, 1], [150, 1, 0.7], [0, 1, 1], [210, 1, 0.7], [210, 1, 1]] },
  triadic: { base: 2, colours: [[120, 1, 1], [120, 1, 0.7], [0, 1, 1], [240, 1, 0.7], [240, 1, 1]] },
  square: { base: 0, colours: [[0, 1, 1], [90, 1, 1], [180, 1, 1], [270, 1, 1]] },
  // A warm-and-cool mix: the base, a neighbour, and two colours near its opposite.
  compound: { base: 2, colours: [[30, 1, 1], [30, 0.6, 0.8], [0, 1, 1], [150, 0.6, 0.8], [165, 1, 1]] },
  // One hue and saturation, from dark to the base brightness.
  shades: { base: 4, colours: [[0, 1, 0.35], [0, 1, 0.55], [0, 1, 0.75], [0, 1, 0.9], [0, 1, 1]] },
  // One hue with both saturation and brightness varied.
  monochromatic: { base: 2, colours: [[0, 1, 0.55], [0, 0.55, 1], [0, 1, 1], [0, 0.55, 0.75], [0, 0.3, 1]] },
};

/** The HSV colours of a rule built around `base`. */
export function schemeColours(rule, base) {
  return HARMONY_RULES[rule].colours.map(([hue, saturation, brightness]) => ({
    h: (base.h + hue + 360) % 360, s: unit(base.s * saturation), v: unit(base.v * brightness),
  }));
}

/** The base colour that puts colour number `index` of a rule at hue h and saturation s. */
export function baseFromPoint(rule, index, h, s, base) {
  const [hue, saturation] = HARMONY_RULES[rule].colours[index];
  return { h: (h - hue + 360) % 360, s: unit(s / saturation), v: base.v };
}

/**
 * The colour of every block of a gradient.
 *
 * stops:   RGB triples, at least two.
 * lengths: blocks in each segment, one per pair of neighbouring stops. A
 *          segment starts on its first stop; the last one also ends on its stop.
 * oklab:   blend in OkLab (perceptually even) rather than in plain sRGB.
 */
export function gradientColours(stops, lengths, oklab = true) {
  const points = oklab ? stops.map(rgbToOklab) : stops;
  const out = [];
  lengths.forEach((length, segment) => {
    const last = segment === lengths.length - 1;
    for (let i = 0; i < length; i++) {
      const k = last ? (length > 1 ? i / (length - 1) : 0) : i / length;
      const mixed = points[segment].map((v, c) => v + (points[segment + 1][c] - v) * k);
      out.push(oklab ? oklabToRgb(mixed) : mixed.map(Math.round));
    }
  });
  return out;
}

/** One entry per gradient block; with `unique`, no entry is used twice. */
export function gradientEntries(entries, stops, lengths, { unique = false, smooth = 0, oklab = true } = {}) {
  const used = new Set();
  return gradientColours(stops, lengths, oklab).map((rgb) => {
    const ranked = rank(entries, labOf(rgb), smooth);
    const entry = (unique && ranked.find((candidate) => !used.has(candidate))) || ranked[0];
    used.add(entry);
    return { rgb, entry };
  }).filter((step) => step.entry);
}

export function toHex(rgb) {
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function fromHex(text) {
  const match = /^#?([0-9a-f]{6})$/i.exec(text.trim()) || /^#?([0-9a-f]{3})$/i.exec(text.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
