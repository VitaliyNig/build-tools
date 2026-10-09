// Block palette: block list, 16x16 tiles and RGB / CIE-Lab arrays. No DOM access.
import { rgbToLab } from "./color.js";

export const TILE_PX = 16;
export const TILE_BYTES = TILE_PX * TILE_PX * 3;
// Decorations are drawn larger: many are small 3D pictures of whole models.
export const DECO_PX = 32;
export const DECO_BYTES = DECO_PX * DECO_PX * 4;

function labOf(entries) {
  const lab = new Float32Array(entries.length * 3);
  entries.forEach((entry, i) => rgbToLab(entry.rgb[0], entry.rgb[1], entry.rgb[2], lab, i * 3));
  return lab;
}

/**
 * blocks:      [{id, name, category, rgb: [r, g, b]}] - full opaque cubes
 * tiles:       Uint8Array of blocks.length * 768 packed RGB bytes (row-major 16x16)
 * faces:       [{block, face, rgb}] - other sides of the blocks that look
 *              different from the north one; optional
 * faceTiles:   Uint8Array of faces.length * 768 packed RGB bytes
 * decorations: [{id, name, rgb}] - plants, leaves, glass; optional
 * decoTiles:   Uint8Array of decorations.length * 1024 packed RGBA bytes
 */
export function makePalette({
  key, version, dataVersion, blocks, tiles, faces = [], faceTiles = new Uint8Array(0),
  decorations = [], decoTiles = new Uint8Array(0),
}) {
  if (!blocks.length) throw new Error("palette is empty");
  const rgb = new Float32Array(blocks.length * 3);
  blocks.forEach((b, i) => rgb.set(b.rgb, i * 3));
  return {
    key, version, dataVersion, blocks, tiles, rgb, lab: labOf(blocks), size: blocks.length,
    faces, faceTiles, faceLab: labOf(faces),
    decorations, decoTiles, decoLab: labOf(decorations),
  };
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

/** Cut an RGBA atlas (cols square tiles of `px` pixels per row) into packed tiles of 3 (RGB) or 4 (RGBA) channels. */
export function tilesFromAtlas(rgba, atlasWidth, count, cols, channels = 3, px = TILE_PX) {
  const size = px * px * channels, tiles = new Uint8Array(count * size);
  for (let i = 0; i < count; i++) {
    const ox = (i % cols) * px, oy = Math.floor(i / cols) * px;
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const s = ((oy + y) * atlasWidth + ox + x) * 4;
        const d = i * size + (y * px + x) * channels;
        for (let c = 0; c < channels; c++) tiles[d + c] = rgba[s + c];
      }
    }
  }
  return tiles;
}
