// Image cell -> banner patterns and backing blocks.
//
// Ported from Image2Banners by MARSTeamMC (image_to_banners.py), BSD 2-Clause.
// One "cell" is a banner slot: one block wide, two blocks tall (22 x 44 px).
import { deltaE2000, rgbToLab } from "./color.js";
import { describe, describePixel, Target } from "./similarity.js";

export const CELL = 22;              // pixels per block in the working image
export const BANNER_W = 20, BANNER_H = 39;
// The block behind a cell that has no better match, by its name in each era of block names.
const DEFAULT_BLOCKS = ["polished_andesite", "smooth_andesite", "stone"];

// Dye colours as CIE-Lab, in the order used to break ties.
export const DYES = {
  white: [77.76, -1.38, -0.48], orange: [51.19, 32.5, 54.3], magenta: [40.72, 49.31, -28.2],
  light_blue: [52.79, -16.86, -23.11], yellow: [67.72, -1.38, 60.65], lime: [56.5, -36.48, 54.94],
  pink: [55.92, 28.75, -0.01], gray: [24.84, -2.02, -2.09], light_gray: [49.52, -0.79, 2.2],
  cyan: [44.78, -26.1, -7.73], purple: [29.9, 46.29, -43.39], blue: [25.29, 23.59, -44.92],
  brown: [30.54, 12.2, 21.97], green: [36.72, -20.65, 38.22], red: [30.11, 41.16, 28.34],
  black: [7.36, 0.78, -2.09],
};
const DYE_NAMES = Object.keys(DYES), DYE_LAB = Object.values(DYES);

/** Patterns that need a banner pattern item in survival. */
const PATTERN_ITEMS = new Set(["creeper", "skull", "flower", "mojang", "globe", "piglin", "flow", "guster"]);
const MAX_LAYERS = 6;        // what a loom allows
const HARD_LAYER_LIMIT = 64; // guard for the "more than 6 patterns" mode

// ---------- small RGBA image helpers ----------
function crop(src, sw, sh, x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0, out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = y0 + y;
    if (sy < 0 || sy >= sh) continue;
    for (let x = 0; x < w; x++) {
      const sx = x0 + x;
      if (sx < 0 || sx >= sw) continue;
      const s = (sy * sw + sx) * 4, d = (y * w + x) * 4;
      out[d] = src[s]; out[d + 1] = src[s + 1]; out[d + 2] = src[s + 2]; out[d + 3] = src[s + 3];
    }
  }
  return out;
}

function paste(dst, dw, src, sw, sh, x0, y0) {
  for (let y = 0; y < sh; y++) {
    dst.set(src.subarray(y * sw * 4, (y + 1) * sw * 4), ((y0 + y) * dw + x0) * 4);
  }
}

/** Opaque black over the inclusive rectangle, as the area a banner will cover. */
function blackout(image, w, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = (y * w + x) * 4;
      image[p] = image[p + 1] = image[p + 2] = 0; image[p + 3] = 255;
    }
  }
}

function maskBlock(image, part) {
  if (part === "up") blackout(image, CELL, 1, 2, 20, CELL - 1);
  else blackout(image, CELL, 1, 0, 20, 18);
}

/** Pillow's integer alpha compositing of one source pixel over dst. */
function over(dst, d, src, s) {
  const sa = src[s + 3];
  if (sa === 0) return false;
  const outA = sa * 255 + dst[d + 3] * (255 - sa);
  const k1 = Math.floor(sa * 255 * 255 * 64 / outA), k2 = 255 * 64 - k1;
  for (let c = 0; c < 3; c++) {
    const v = src[s + c] * k1 + dst[d + c] * k2 + 0x2000;
    dst[d + c] = ((v + (v >> 8)) >> 8) >> 6;
  }
  const a = outA + 0x80;
  dst[d + 3] = (a + (a >> 8)) >> 8;
  return true;
}

// ---------- assets ----------
// Source texel for each of the 22 output pixels, exactly as Pillow's NEAREST picks them.
const NEAREST_16_TO_22 = [0, 1, 1, 2, 3, 4, 4, 5, 6, 6, 7, 8, 9, 9, 10, 11, 11, 12, 13, 14, 14, 15];

/**
 * meta: {colors, patterns}; patternAtlas: decoded PNG of 20x39 tiles, one row
 * per colour and one column per pattern.
 * blockSet: the blocks of one Minecraft version, {names, labels, tiles}: ids
 * without namespace ("acacia_log[axis=y]"), display names, and 16x16 RGB
 * tiles packed one after another.
 */
export function prepareAssets(meta, patternAtlas, blockSet) {
  const patternCount = meta.patterns.length;
  const tiles = [], opaque = [];
  for (let c = 0; c < meta.colors.length; c++) {
    for (let p = 0; p < patternCount; p++) {
      const tile = crop(patternAtlas.data, patternAtlas.w, patternAtlas.h,
        p * BANNER_W, c * BANNER_H, (p + 1) * BANNER_W, (c + 1) * BANNER_H);
      const touched = [];
      for (let i = 0; i < BANNER_W * BANNER_H; i++) if (tile[i * 4 + 3]) touched.push(i);
      tiles.push(tile);
      opaque.push(Int32Array.from(touched));
    }
  }
  // Blocks are compared and drawn at 22 px, nearest-neighbour from 16 px.
  const blocks = blockSet.names.map((_, i) => {
    const out = new Uint8ClampedArray(CELL * CELL * 4);
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const s = (i * 256 + NEAREST_16_TO_22[y] * 16 + NEAREST_16_TO_22[x]) * 3, d = (y * CELL + x) * 4;
        out[d] = blockSet.tiles[s]; out[d + 1] = blockSet.tiles[s + 1];
        out[d + 2] = blockSet.tiles[s + 2]; out[d + 3] = 255;
      }
    }
    return out;
  });
  // A block is a candidate for cells where one of its two main dye colours leads.
  const blocksByColor = Object.fromEntries(DYE_NAMES.map((name) => [name, []]));
  blocks.forEach((image, i) => {
    for (const dye of topDyes(dyeCounts(image), 2)) blocksByColor[DYE_NAMES[dye]].push(i);
  });
  const blockIndex = new Map(blockSet.names.map((name, i) => [name, i]));
  // Names from other versions and from the desktop app: "barrel" for
  // "barrel[facing=up,open=false]", "acacia_log-top" for "acacia_log[axis=y]".
  const bareIndex = new Map();
  blockSet.names.forEach((name, i) => {
    const bare = name.replace(/\[.*$/, "");
    if (!bareIndex.has(bare)) bareIndex.set(bare, i);
  });
  return {
    colors: meta.colors, patterns: meta.patterns, blockNames: blockSet.names, blockLabels: blockSet.labels,
    blocksByColor, tiles, opaque, blocks, blockIndex, bareIndex,
    defaultBlock: blockSet.names[DEFAULT_BLOCKS.map((name) => bareIndex.get(name)).find((i) => i !== undefined) ?? 0],
    patternIndex: new Map(meta.patterns.map((name, i) => [name, i])),
    colorIndex: new Map(meta.colors.map((name, i) => [name, i])),
    // Candidates are tried colour by colour in alphabetical order.
    colorOrder: meta.colors.map((_, i) => i).sort((a, b) => (meta.colors[a] < meta.colors[b] ? -1 : 1)),
  };
}

/** The block of this version that a name stands for; the default block when there is none. */
export function resolveBlock(assets, name) {
  if (assets.blockIndex.has(name)) return name;
  const bare = String(name ?? "").replace(/\[.*$/, "").replace(/-.*$/, "");
  const index = assets.bareIndex.get(bare);
  return index === undefined ? assets.defaultBlock : assets.blockNames[index];
}

/** RGBA tile of "colour#pattern". */
export function patternTile(assets, name) {
  const [colour, pattern] = name.split("#");
  return assets.tiles[assets.colorIndex.get(colour) * assets.patterns.length + assets.patternIndex.get(pattern)];
}

// ---------- colour statistics ----------
const nearestCache = new Map();
const scratch = new Float64Array(3);

function nearestDye(r, g, b, excluded) {
  const key = (r << 16) | (g << 8) | b;
  if (excluded < 0 && nearestCache.has(key)) return nearestCache.get(key);
  rgbToLab(r, g, b, scratch, 0);
  let best = Infinity, chosen = -1;
  for (let i = 0; i < DYE_LAB.length; i++) {
    if (i === excluded) continue;
    const d = deltaE2000(scratch[0], scratch[1], scratch[2], DYE_LAB[i][0], DYE_LAB[i][1], DYE_LAB[i][2]);
    if (d < best) { best = d; chosen = i; }
  }
  if (excluded < 0) nearestCache.set(key, chosen);
  return chosen;
}

function dyeCounts(rgba, excluded = -1) {
  const counts = new Int32Array(DYE_LAB.length);
  for (let p = 0; p < rgba.length; p += 4) counts[nearestDye(rgba[p], rgba[p + 1], rgba[p + 2], excluded)]++;
  return counts;
}

/** Indices of the `count` most frequent dyes, most frequent first. */
function topDyes(counts, count) {
  return [...counts.keys()].sort((a, b) => counts[b] - counts[a]).slice(0, count);
}

/** Dyes covering at least 5 % of the pixels; always at least two. */
function presentDyes(rgba) {
  const counts = dyeCounts(rgba), total = rgba.length / 4;
  const present = [...counts.keys()].filter((i) => counts[i] >= 0.05 * total);
  if (present.length === 1) present.push(topDyes(dyeCounts(rgba, present[0]), 1)[0]);
  return present;
}

// ---------- matching ----------
function generateBanner(rgba, assets, options) {
  const size = BANNER_W * BANNER_H, target = new Target(rgba, BANNER_W, BANNER_H);
  const biggest = topDyes(dyeCounts(rgba), 1)[0];
  const present = new Set(presentDyes(rgba).map((i) => DYE_NAMES[i]));
  const biggestName = DYE_NAMES[biggest];
  const names = [`${biggestName}#wall_banner`];

  const base = Uint8ClampedArray.from(patternTile(assets, names[0]));
  const baseLab = new Float64Array(size * 3), baseGrey = new Float64Array(size);
  describe(base, baseLab, baseGrey);
  const trial = new Uint8ClampedArray(size * 4), trialLab = new Float64Array(size * 3), trialGrey = new Float64Array(size);
  const kept = new Uint8ClampedArray(size * 4), keptLab = new Float64Array(size * 3), keptGrey = new Float64Array(size);

  const patternCount = assets.patterns.length;
  let best = 0;
  for (let layer = 1; layer <= (options.big ? HARD_LAYER_LIMIT : MAX_LAYERS); layer++) {
    let chosen = null;
    for (const c of assets.colorOrder) {
      const colour = assets.colors[c];
      if (!present.has(colour) || (layer === 1 && colour === biggestName)) continue;
      for (let p = 0; p < patternCount; p++) {
        const pattern = assets.patterns[p];
        if (pattern === "wall_banner" || (!options.patternItems && PATTERN_ITEMS.has(pattern))) continue;
        if (options.skip && options.skip.includes(pattern)) continue;
        const tile = assets.tiles[c * patternCount + p];
        trial.set(base); trialLab.set(baseLab); trialGrey.set(baseGrey);
        // Only pixels the pattern touches need new Lab / grey values.
        for (const i of assets.opaque[c * patternCount + p]) {
          over(trial, i * 4, tile, i * 4);
          describePixel(trial, i, trialLab, trialGrey);
        }
        const score = target.score(trialLab, trialGrey, options.compare);
        if (score > best) {
          best = score;
          chosen = `${colour}#${pattern}`;
          kept.set(trial); keptLab.set(trialLab); keptGrey.set(trialGrey);
        }
      }
    }
    // Stop at the first layer that does not improve the match.
    if (!chosen) break;
    names.push(chosen);
    base.set(kept); baseLab.set(keptLab); baseGrey.set(keptGrey);
  }
  return { patterns: names, image: base };
}

function generateBlock(rgba, part, assets, options) {
  const fallback = assets.blocks[assets.blockIndex.get(assets.defaultBlock)];
  if (!rgba) return { name: assets.defaultBlock, image: fallback };
  const target = new Target(rgba, CELL, CELL);
  // The masked area counts as black, so black blocks are always candidates.
  const candidates = new Set();
  for (const dye of topDyes(dyeCounts(rgba), 2)) {
    for (const index of assets.blocksByColor[DYE_NAMES[dye]] || []) candidates.add(index);
  }
  const lab = new Float64Array(CELL * CELL * 3), grey = new Float64Array(CELL * CELL);
  let best = 0, name = assets.defaultBlock, image = Uint8ClampedArray.from(fallback);
  for (const index of candidates) {
    const trial = Uint8ClampedArray.from(assets.blocks[index]);
    maskBlock(trial, part);
    describe(trial, lab, grey);
    const score = target.score(lab, grey, options.compare);
    if (score > best) { best = score; name = assets.blockNames[index]; image = trial; }
  }
  return { name, image };
}

function scoreAgainst(target, rgba, compare) {
  const lab = new Float64Array(target.w * target.h * 3), grey = new Float64Array(target.w * target.h);
  describe(rgba, lab, grey);
  return target.score(lab, grey, compare);
}

/**
 * Process one banner slot.
 *
 * strip:   22 x 66 RGBA: the block above the slot followed by the slot itself.
 * options: {blocks, layering, big, patternItems, compare (0..1), skip}; `layering`
 *          must be false for the top row, which has nothing above it; `skip`
 *          lists patterns the Minecraft version does not have.
 * Returns {preview, banner, blockUp, blockDown, upperBanner}:
 *   preview      22 x 47 RGBA, the slot with 3 px of overhang above it;
 *   banner       pattern list of the slot's banner ("colour#pattern", base first);
 *   blockUp/Down names of the two blocks behind it;
 *   upperBanner  pattern list of a banner one block higher whose lower half
 *                overlaps this slot, or null.
 */
export function processCell(strip, assets, options) {
  const main = crop(strip, CELL, CELL * 3, 0, CELL, CELL, CELL * 3);
  const banner = generateBanner(crop(main, CELL, CELL * 2, 1, 2, 21, 41), assets, options);

  let up = null, down = null;
  if (options.blocks) {
    up = crop(main, CELL, CELL * 2, 0, 0, CELL, CELL);
    maskBlock(up, "up");
    down = crop(main, CELL, CELL * 2, 0, CELL, CELL, CELL * 2);
    maskBlock(down, "down");
  }
  const blockUp = generateBlock(up, "up", assets, options);
  const blockDown = generateBlock(down, "down", assets, options);

  const previewH = CELL * 2 + 3;
  let preview = new Uint8ClampedArray(CELL * previewH * 4);
  paste(preview, CELL, blockUp.image, CELL, CELL, 0, 3);
  paste(preview, CELL, blockDown.image, CELL, CELL, 0, 25);
  paste(preview, CELL, banner.image, BANNER_W, BANNER_H, 1, 5);

  let upperBanner = null;
  if (options.layering) {
    const above = crop(strip, CELL, CELL * 3, 0, 0, CELL, CELL * 2);
    const upper = generateBanner(crop(above, CELL, CELL * 2, 1, 2, 21, 41), assets, options);
    const layered = Uint8ClampedArray.from(preview);
    paste(layered, CELL, crop(upper.image, BANNER_W, BANNER_H, 0, 18, BANNER_W, BANNER_H), BANNER_W, BANNER_H - 18, 1, 0);

    const target = new Target(main, CELL, CELL * 2);
    const visible = (image) => crop(image, CELL, previewH, 0, 3, CELL, previewH);
    if (scoreAgainst(target, visible(layered), options.compare) > scoreAgainst(target, visible(preview), options.compare)) {
      preview = layered;
      upperBanner = upper.patterns;
    }
  }
  return { preview, banner: banner.patterns, blockUp: blockUp.name, blockDown: blockDown.name, upperBanner };
}
