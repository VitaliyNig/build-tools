// Block palette: block list, 16x16 tiles and RGB / CIE-Lab arrays. No DOM access.
import { rgbToLab } from "./color.js";

export const TILE_PX = 16;
export const TILE_BYTES = TILE_PX * TILE_PX * 3;

/**
 * blocks: [{id, name, category, rgb: [r, g, b]}]
 * tiles:  Uint8Array of blocks.length * 768 packed RGB bytes (row-major 16x16).
 */
export function makePalette({ key, version, dataVersion, blocks, tiles }) {
  if (!blocks.length) throw new Error("palette is empty");
  const rgb = new Float32Array(blocks.length * 3);
  const lab = new Float32Array(blocks.length * 3);
  blocks.forEach((b, i) => {
    rgb.set(b.rgb, i * 3);
    rgbToLab(b.rgb[0], b.rgb[1], b.rgb[2], lab, i * 3);
  });
  return { key, version, dataVersion, blocks, tiles, rgb, lab, size: blocks.length };
}

/** New palette keeping only blocks whose id is in enabledIds (a Set). */
export function subset(palette, enabledIds) {
  const kept = [];
  palette.blocks.forEach((b, i) => { if (enabledIds.has(b.id)) kept.push(i); });
  const tiles = new Uint8Array(kept.length * TILE_BYTES);
  kept.forEach((src, dst) => {
    tiles.set(palette.tiles.subarray(src * TILE_BYTES, (src + 1) * TILE_BYTES), dst * TILE_BYTES);
  });
  return makePalette({ ...palette, blocks: kept.map((i) => palette.blocks[i]), tiles });
}

export function categoryMap(palette) {
  const out = new Map();
  for (const b of palette.blocks) {
    const key = b.category || "misc";
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(b);
  }
  return new Map([...out].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Cut an RGBA atlas (cols tiles per row) into packed RGB tiles. */
export function tilesFromAtlas(rgba, atlasWidth, count, cols) {
  const tiles = new Uint8Array(count * TILE_BYTES);
  for (let i = 0; i < count; i++) {
    const ox = (i % cols) * TILE_PX, oy = Math.floor(i / cols) * TILE_PX;
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const s = ((oy + y) * atlasWidth + ox + x) * 4;
        const d = i * TILE_BYTES + (y * TILE_PX + x) * 3;
        tiles[d] = rgba[s]; tiles[d + 1] = rgba[s + 1]; tiles[d + 2] = rgba[s + 2];
      }
    }
  }
  return tiles;
}
