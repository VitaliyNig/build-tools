// Export a block grid as an Axiom blueprint (.bp): see shared/mc/blueprint.js.
//
// The grid is written as a vertical wall one block thick, centred on the
// blueprint's origin as Axiom's own blueprints are.
import { buildBlueprint as build } from "../../shared/mc/blueprint.js";

/**
 * idx: width*height palette indices (row 0 = top); thumbnail: the bytes of a PNG.
 * Returns {bytes, paletteSize}: the whole file, ready to save.
 */
export function buildBlueprint(idx, width, height, palette, thumbnail, name = "graffiti") {
  const left = -(width >> 1), bottom = -(height >> 1);
  const blocks = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      blocks.push([left + col, bottom + height - 1 - row, 0, palette.blocks[idx[row * width + col]].id]);
    }
  }
  return build({ blocks, dataVersion: palette.dataVersion, thumbnail, name, author: "Graffiti" });
}
