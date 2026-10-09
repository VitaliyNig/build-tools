// Colour matching and gradients over a block palette. No DOM access.
import { rgbToLab } from "../shared/mc/color.js";
import { TILE_PX } from "../shared/mc/palette.js";

// Blocks that fall when unsupported, and blocks that are not ordinary building material.
const FALLING = /(^|_)(sand|gravel|concrete_powder|anvil)$|^suspicious_|^dragon_egg$/;
const TECHNICAL = /command_block|structure_block|jigsaw|bedrock|barrier|spawner|budding_amethyst|reinforced_deepslate|test_block|test_instance|infested_|monster_egg|frosted_ice|^light$/;

const PIXELS = TILE_PX * TILE_PX;

/** Standard deviation of a tile's brightness: 0 for a flat colour, ~40+ for busy textures. */
function noiseOf(tiles, index, channels) {
  let sum = 0, squares = 0, count = 0;
  for (let p = 0; p < PIXELS; p++) {
    const s = (index * PIXELS + p) * channels;
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
 * [{kind: "block" | "deco", index, id, name, rgb, lab, noise, falling, technical}].
 */
export function listEntries(palette) {
  const make = (kind, source, lab, tiles, channels) => source.map((item, index) => {
    const name = shortId(item.id).replace(/\[.*$/, "");
    return {
      kind, index, id: shortId(item.id), name: item.name, rgb: item.rgb,
      lab: [lab[index * 3], lab[index * 3 + 1], lab[index * 3 + 2]],
      noise: noiseOf(tiles, index, channels),
      falling: FALLING.test(name), technical: TECHNICAL.test(name),
    };
  });
  return [
    ...make("block", palette.blocks, palette.lab, palette.tiles, 3),
    ...make("deco", palette.decorations, palette.decoLab, palette.decoTiles, 4),
  ];
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

/** `steps` RGB colours running through the stops (RGB triples), ends included. */
export function gradientColours(stops, steps) {
  if (stops.length === 1 || steps === 1) return Array.from({ length: steps }, () => stops[0]);
  const points = stops.map(rgbToOklab);
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1) * (points.length - 1);
    const from = Math.min(points.length - 2, Math.floor(t)), k = t - from;
    return oklabToRgb(points[from].map((v, c) => v + (points[from + 1][c] - v) * k));
  });
}

/** One entry per gradient step; with `unique`, no entry is used twice. */
export function gradientEntries(entries, stops, steps, { unique = false, smooth = 0 } = {}) {
  const used = new Set();
  return gradientColours(stops, steps).map((rgb) => {
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
