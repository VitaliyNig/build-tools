// End-to-end: source image + settings -> block grid. UI-independent.
import { applyAdjustments } from "./imageops.js";
import { quantize } from "./quantize.js";
import { resize } from "./resample.js";
import { matchTextures } from "./texture.js";
import { suggestOutputSize, warpQuadToRect } from "./warp.js";

/**
 * source:   {data: RGBA bytes, w, h}
 * settings: {width, height (blocks), brightness, contrast, saturation,
 *            temperature, shadows, highlights, dither (0..1),
 *            textureStrength (0..1), quad: 4 [x, y] in TL,TR,BR,BL or null}
 * Returns Uint16Array of palette indices (row 0 = top).
 */
export function generate(source, settings, palette, onProgress) {
  let { data, w, h } = source;
  data = applyAdjustments(data, settings);
  if (settings.quad) {
    const [ow, oh] = suggestOutputSize(settings.quad);
    data = warpQuadToRect(data, w, h, settings.quad, ow, oh);
    w = ow; h = oh;
  }
  if (settings.textureStrength > 0) {
    return matchTextures(data, w, h, palette, settings.width, settings.height,
      settings.textureStrength, settings.dither, onProgress);
  }
  const grid = resize(data, w, h, [0, 0, w, h], settings.width, settings.height, "lanczos");
  return quantize(grid, settings.width, settings.height, palette, settings.dither);
}
