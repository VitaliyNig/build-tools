// sRGB -> CIE-Lab (D65) and the CIEDE2000 colour difference, matching scikit-image.

const LINEAR = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LINEAR[i] = c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
}

function f(t) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/** Write the Lab triple of an 8-bit RGB colour into out[o..o+2]. */
export function rgbToLab(r, g, b, out, o) {
  const R = LINEAR[r], G = LINEAR[g], B = LINEAR[b];
  const fx = f((0.412453 * R + 0.357580 * G + 0.180423 * B) / 0.95047);
  const fy = f(0.212671 * R + 0.715160 * G + 0.072169 * B);
  const fz = f((0.019334 * R + 0.119193 * G + 0.950227 * B) / 1.08883);
  out[o] = 116 * fy - 16;
  out[o + 1] = 500 * (fx - fy);
  out[o + 2] = 200 * (fy - fz);
}

const POW25_7 = 25 ** 7, TAU = 2 * Math.PI, DEG = Math.PI / 180;

/** CIEDE2000 difference between two Lab colours (kL = kC = kH = 1). */
export function deltaE2000(L1, a1, b1, L2, a2, b2) {
  const cBar = 0.5 * (Math.hypot(a1, b1) + Math.hypot(a2, b2));
  let c7 = cBar ** 7;
  const scale = 1 + 0.5 * (1 - Math.sqrt(c7 / (c7 + POW25_7)));
  a1 *= scale; a2 *= scale;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  let h1 = Math.atan2(b1, a1), h2 = Math.atan2(b2, a2);
  if (h1 < 0) h1 += TAU;
  if (h2 < 0) h2 += TAU;

  const lBar = 0.5 * (L1 + L2), l50 = (lBar - 50) * (lBar - 50);
  const lTerm = (L2 - L1) / (1 + 0.015 * l50 / Math.sqrt(20 + l50));

  const cBar2 = 0.5 * (C1 + C2);
  const cTerm = (C2 - C1) / (1 + 0.045 * cBar2);

  const hDiff = h2 - h1, hSum = h1 + h2, CC = C1 * C2;
  let dH = hDiff;
  if (hDiff > Math.PI) dH -= TAU;
  else if (hDiff < -Math.PI) dH += TAU;
  if (CC === 0) dH = 0;
  let hBar = hSum;
  if (CC !== 0 && Math.abs(hDiff) > Math.PI) hBar += hSum < TAU ? TAU : -TAU;
  if (CC === 0) hBar *= 2;
  hBar *= 0.5;
  const T = 1 - 0.17 * Math.cos(hBar - 30 * DEG) + 0.24 * Math.cos(2 * hBar)
    + 0.32 * Math.cos(3 * hBar + 6 * DEG) - 0.20 * Math.cos(4 * hBar - 63 * DEG);
  const hTerm = 2 * Math.sqrt(CC) * Math.sin(dH / 2) / (1 + 0.015 * cBar2 * T);

  c7 = cBar2 ** 7;
  const rc = 2 * Math.sqrt(c7 / (c7 + POW25_7));
  const turn = (hBar / DEG - 275) / 25;
  const rTerm = -Math.sin(2 * 30 * DEG * Math.exp(-turn * turn)) * rc * cTerm * hTerm;

  return Math.sqrt(Math.max(0, lTerm * lTerm + cTerm * cTerm + hTerm * hTerm + rTerm));
}
