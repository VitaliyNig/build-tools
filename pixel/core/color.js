// sRGB (0..255) -> CIE-Lab (D65, L in 0..100), same constants as OpenCV's float RGB2Lab.

const LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function f(t) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/** Write the Lab triple of an 8-bit RGB colour into out[o..o+2]. */
export function rgbToLab(r, g, b, out, o) {
  const R = LINEAR[r], G = LINEAR[g], B = LINEAR[b];
  const x = (0.412453 * R + 0.357580 * G + 0.180423 * B) / 0.950456;
  const y = 0.212671 * R + 0.715160 * G + 0.072169 * B;
  const z = (0.019334 * R + 0.119193 * G + 0.950227 * B) / 1.088754;
  const fx = f(x), fy = f(y), fz = f(z);
  out[o] = y > 0.008856 ? 116 * fy - 16 : 903.3 * y;
  out[o + 1] = 500 * (fx - fy);
  out[o + 2] = 200 * (fy - fz);
}
