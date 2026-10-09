// Non-destructive image adjustments on RGBA byte buffers (alpha is ignored).

export const NEUTRAL = Object.freeze({
  brightness: 1, contrast: 1, saturation: 1, temperature: 0, shadows: 0, highlights: 0,
});

export function isNeutral(a) {
  return a.brightness === 1 && a.contrast === 1 && a.saturation === 1
    && a.temperature === 0 && a.shadows === 0 && a.highlights === 0;
}

function luma(r, g, b) {
  // ITU-R 601-2, the weights PIL uses for "L" conversion.
  return (r * 19595 + g * 38470 + b * 7471 + 0x8000) >> 16;
}

/**
 * Return a new adjusted RGBA buffer.
 *
 * Brightness, contrast and saturation are factors where 1.0 is unchanged.
 * Temperature and tonal controls are in the range -1..1.
 */
export function applyAdjustments(src, a) {
  const out = new Uint8ClampedArray(src);
  const n = out.length;

  if (a.temperature !== 0 || a.shadows !== 0 || a.highlights !== 0) {
    // Positive temperature is warmer (more red, less blue).
    const t = Math.max(-1, Math.min(1, a.temperature)) * 0.25;
    const sh = a.shadows * 0.55, hi = a.highlights * 0.55;
    for (let i = 0; i < n; i += 4) {
      let r = out[i] / 255 * (1 + t), g = out[i + 1] / 255, b = out[i + 2] / 255 * (1 - t);
      if (sh !== 0 || hi !== 0) {
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const add = sh * (1 - lum) * (1 - lum) + hi * lum * lum;
        r += add; g += add; b += add;
      }
      out[i] = Math.floor(r * 255);
      out[i + 1] = Math.floor(g * 255);
      out[i + 2] = Math.floor(b * 255);
    }
  }

  if (a.brightness !== 1) {
    const k = a.brightness;
    for (let i = 0; i < n; i += 4) {
      out[i] = Math.floor(out[i] * k);
      out[i + 1] = Math.floor(out[i + 1] * k);
      out[i + 2] = Math.floor(out[i + 2] * k);
    }
  }

  if (a.contrast !== 1) {
    // Blend with the image's mean grey.
    let sum = 0;
    for (let i = 0; i < n; i += 4) sum += luma(out[i], out[i + 1], out[i + 2]);
    const mean = Math.floor(sum / (n / 4) + 0.5), k = a.contrast;
    for (let i = 0; i < n; i += 4) {
      out[i] = Math.floor(mean + (out[i] - mean) * k);
      out[i + 1] = Math.floor(mean + (out[i + 1] - mean) * k);
      out[i + 2] = Math.floor(mean + (out[i + 2] - mean) * k);
    }
  }

  if (a.saturation !== 1) {
    const k = a.saturation;
    for (let i = 0; i < n; i += 4) {
      const grey = luma(out[i], out[i + 1], out[i + 2]);
      out[i] = Math.floor(grey + (out[i] - grey) * k);
      out[i + 1] = Math.floor(grey + (out[i + 1] - grey) * k);
      out[i + 2] = Math.floor(grey + (out[i + 2] - grey) * k);
    }
  }
  return out;
}

export function rotate90(src, w, h, clockwise = true) {
  const out = new Uint8ClampedArray(src.length);
  const s32 = new Uint32Array(src.buffer, src.byteOffset, w * h);
  const o32 = new Uint32Array(out.buffer);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = clockwise ? h - 1 - y : y;
      const ny = clockwise ? x : w - 1 - x;
      o32[ny * h + nx] = s32[y * w + x];
    }
  }
  return { data: out, w: h, h: w };
}
