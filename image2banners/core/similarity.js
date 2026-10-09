// Hybrid image similarity used to rank banner patterns and blocks:
// colour closeness (CIEDE2000 on a 10x20 downsample) blended with structural
// similarity (SSIM, 3x3 windows) of the full-size greyscale images.
import { deltaE2000, rgbToLab } from "./color.js";

const DS_W = 10, DS_H = 20;
const C1 = 0.01 ** 2, C2 = 0.03 ** 2, COV_NORM = 9 / 8;

/** Area-resampling weights (OpenCV INTER_AREA) from `source` to `target` samples. */
function areaTable(source, target) {
  const scale = source / target, table = [];
  for (let d = 0; d < target; d++) {
    const from = d * scale, to = from + scale, cell = Math.min(scale, source - from);
    let first = Math.ceil(from), last = Math.min(Math.floor(to), source - 1);
    first = Math.min(first, last);
    const taps = [];
    if (first - from > 1e-3) taps.push([first - 1, (first - from) / cell]);
    for (let s = first; s < last; s++) taps.push([s, 1 / cell]);
    if (to - last > 1e-3) taps.push([last, Math.min(Math.min(to - last, 1), cell) / cell]);
    table.push(taps);
  }
  return table;
}

const tables = new Map();
function tableFor(source, target) {
  const key = source * 1000 + target;
  if (!tables.has(key)) tables.set(key, areaTable(source, target));
  return tables.get(key);
}

/** Per-size scratch buffers and resampling tables. */
class Workspace {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.columns = tableFor(w, DS_W);
    this.rows = tableFor(h, DS_H);
    this.horizontal = new Float64Array(DS_W * h * 3);
    this.small = new Float64Array(DS_W * DS_H * 3);
  }

  /** lab: w*h*3 -> this.small (10x20x3). */
  downsample(lab) {
    const { w, h, columns, rows, horizontal, small } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < DS_W; x++) {
        let l = 0, a = 0, b = 0;
        for (const [s, weight] of columns[x]) {
          const p = (y * w + s) * 3;
          l += lab[p] * weight; a += lab[p + 1] * weight; b += lab[p + 2] * weight;
        }
        const o = (y * DS_W + x) * 3;
        horizontal[o] = l; horizontal[o + 1] = a; horizontal[o + 2] = b;
      }
    }
    for (let y = 0; y < DS_H; y++) {
      for (let x = 0; x < DS_W; x++) {
        let l = 0, a = 0, b = 0;
        for (const [s, weight] of rows[y]) {
          const p = (s * DS_W + x) * 3;
          l += horizontal[p] * weight; a += horizontal[p + 1] * weight; b += horizontal[p + 2] * weight;
        }
        const o = (y * DS_W + x) * 3;
        small[o] = l; small[o + 1] = a; small[o + 2] = b;
      }
    }
    return small;
  }
}

const workspaces = new Map();
function workspaceFor(w, h) {
  const key = w * 1000 + h;
  if (!workspaces.has(key)) workspaces.set(key, new Workspace(w, h));
  return workspaces.get(key);
}

/** Fill lab (n*3) and grey (n) from RGBA pixels. */
export function describe(rgba, lab, grey) {
  for (let i = 0, p = 0; p < rgba.length; i++, p += 4) {
    rgbToLab(rgba[p], rgba[p + 1], rgba[p + 2], lab, i * 3);
    grey[i] = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) / 255;
  }
}

/** Update lab/grey for one pixel after rgba[i*4..] changed. */
export function describePixel(rgba, i, lab, grey) {
  const p = i * 4;
  rgbToLab(rgba[p], rgba[p + 1], rgba[p + 2], lab, i * 3);
  grey[i] = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) / 255;
}

/** The image every candidate is compared against; its features are computed once. */
export class Target {
  /** rgba: w*h RGBA pixels (alpha ignored). */
  constructor(rgba, w, h) {
    this.w = w; this.h = h;
    this.lab = new Float64Array(w * h * 3);
    this.grey = new Float64Array(w * h);
    describe(rgba, this.lab, this.grey);
    this.small = Float64Array.from(workspaceFor(w, h).downsample(this.lab));
  }

  /**
   * Similarity of a candidate (given as its Lab and grey planes, same size) to
   * this target. deltaWeight is the share of the colour term; the rest is SSIM.
   */
  score(lab, grey, deltaWeight) {
    const { w, h } = this, small = workspaceFor(w, h).downsample(lab), mine = this.small;
    let total = 0;
    for (let p = 0; p < small.length; p += 3) {
      total += deltaE2000(small[p], small[p + 1], small[p + 2], mine[p], mine[p + 1], mine[p + 2]);
    }
    const colour = 1 / (1 + total / (DS_W * DS_H));

    // SSIM with uniform 3x3 windows; border pixels are excluded, as scikit-image does.
    const other = this.grey;
    let ssim = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const row = (y + dy) * w + x;
          for (let dx = -1; dx <= 1; dx++) {
            const a = grey[row + dx], b = other[row + dx];
            sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b;
          }
        }
        const ux = sx / 9, uy = sy / 9;
        const vx = COV_NORM * (sxx / 9 - ux * ux), vy = COV_NORM * (syy / 9 - uy * uy);
        const vxy = COV_NORM * (sxy / 9 - ux * uy);
        ssim += ((2 * ux * uy + C1) * (2 * vxy + C2)) / ((ux * ux + uy * uy + C1) * (vx + vy + C2));
      }
    }
    ssim /= (w - 2) * (h - 2);
    return deltaWeight * colour + (1 - deltaWeight) * ssim;
  }
}
