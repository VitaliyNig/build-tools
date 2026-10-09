// The banner art as data: a grid of cells, each with a backing block and
// optionally a banner hanging from it (covering this cell and the one below).
//
// The JSON form is the one Image2Banners by MARSTeamMC reads and writes, so
// files are interchangeable with the desktop app.
import { BANNER_H, BANNER_W, CELL, DEFAULT_BLOCK, patternTile } from "./generate.js";

// Block textures renamed since older Image2Banners versions.
const RENAMED_BLOCKS = {
  dried_kelp: "dried_kelp_block", powder_snow: "snow_block",
  magma: "magma_block", pale_moss_carpet: "pale_moss_block",
};

export function createModel(width, height) {
  return { width, height, cells: Array.from({ length: width * height }, () => ({})) };
}

export function cellAt(model, x, y) {
  return x >= 0 && y >= 0 && x < model.width && y < model.height ? model.cells[y * model.width + x] : null;
}

/** Store the result of processCell for banner slot (column, slotRow). */
export function applyCell(model, column, slotRow, result) {
  const y = slotRow * 2;
  const top = cellAt(model, column, y);
  top.banner = result.banner;
  top.block = result.blockUp;
  const bottom = cellAt(model, column, y + 1);
  if (bottom) bottom.block = result.blockDown;
  if (result.upperBanner) cellAt(model, column, y - 1).banner = result.upperBanner;
}

export function toJson(model) {
  const out = {};
  model.cells.forEach((cell, i) => {
    const entry = {};
    if (cell.banner) entry.banner = cell.banner;
    entry.block = cell.block || DEFAULT_BLOCK;
    out[`(${i % model.width},${Math.floor(i / model.width)})`] = entry;
  });
  out.resolution = [String(model.width), String(model.height)];
  return out;
}

/** Parse an Image2Banners JSON object; unknown blocks and patterns are dropped. */
export function fromJson(data, assets) {
  const [width, height] = (data && data.resolution || []).map(Number);
  if (!(width >= 1 && height >= 1 && width <= 1024 && height <= 1024)) throw new Error("bad-json");
  const model = createModel(width, height);
  for (const [key, entry] of Object.entries(data)) {
    const match = /^\((\d+),(\d+)\)$/.exec(key);
    const cell = match && cellAt(model, Number(match[1]), Number(match[2]));
    if (!cell || !entry || typeof entry !== "object") continue;
    const block = RENAMED_BLOCKS[entry.block] || entry.block;
    cell.block = assets.blockIndex.has(block) ? block : DEFAULT_BLOCK;
    if (Array.isArray(entry.banner) && entry.banner.length) {
      const known = entry.banner.filter((name) => typeof name === "string" && patternTile(assets, name));
      if (known.length && known[0].endsWith("#wall_banner")) cell.banner = known;
    }
  }
  return model;
}

function blend(dst, d, src, s) {
  const a = src[s + 3] / 255;
  dst[d] = src[s] * a + dst[d] * (1 - a);
  dst[d + 1] = src[s + 1] * a + dst[d + 1] * (1 - a);
  dst[d + 2] = src[s + 2] * a + dst[d + 2] * (1 - a);
  dst[d + 3] = 255;
}

/** Pattern list -> array of RGBA 20x39 images, one after each pattern is applied. */
export function bannerSteps(assets, banner) {
  const image = new Uint8ClampedArray(BANNER_W * BANNER_H * 4);
  return banner.map((name) => {
    const tile = patternTile(assets, name);
    for (let p = 0; p < image.length; p += 4) if (tile[p + 3]) blend(image, p, tile, p);
    return Uint8ClampedArray.from(image);
  });
}

/** Draw the whole art: {data: RGBA, w, h} at 22 px per block. */
export function renderModel(model, assets) {
  const w = model.width * CELL, h = model.height * CELL;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let p = 3; p < data.length; p += 4) data[p] = 255;
  model.cells.forEach((cell, i) => {
    const block = assets.blocks[assets.blockIndex.get(cell.block) ?? assets.blockIndex.get(DEFAULT_BLOCK)];
    const ox = (i % model.width) * CELL, oy = Math.floor(i / model.width) * CELL;
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) blend(data, ((oy + y) * w + ox + x) * 4, block, (y * CELL + x) * 4);
    }
  });
  // Bottom rows first, so a banner hanging from above overlaps the one below it.
  for (let i = model.cells.length - 1; i >= 0; i--) {
    const banner = model.cells[i].banner;
    if (!banner) continue;
    const image = bannerSteps(assets, banner).at(-1);
    const ox = (i % model.width) * CELL + 1, oy = Math.floor(i / model.width) * CELL + 2;
    for (let y = 0; y < BANNER_H && oy + y < h; y++) {
      for (let x = 0; x < BANNER_W; x++) blend(data, ((oy + y) * w + ox + x) * 4, image, (y * BANNER_W + x) * 4);
    }
  }
  return { data, w, h };
}

/** /give command for a banner (1.20.5+ item component syntax). */
export function giveCommand(banner) {
  const layers = banner.slice(1).map((name) => {
    const [colour, pattern] = name.split("#");
    return `{color: "${colour}", pattern: "${pattern}"}`;
  });
  const item = banner[0].replace("#wall_banner", "_banner");
  return `/give @p minecraft:${item}[minecraft:banner_patterns=[${layers.join(",")}]]`;
}
