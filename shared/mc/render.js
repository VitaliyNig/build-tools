// Draws a block model as a small isometric picture, the way the game draws
// block items in the inventory. No DOM access.

const RAD = Math.PI / 180;
const SUPERSAMPLE = 3;
// How much of the picture a full cube fills; it is about 25.2 model units tall on screen.
const VIEW_SPAN = 26;
// The inventory view: tilted 30 degrees down, turned to show the north and east sides.
const VIEW_PITCH = 30, VIEW_YAW = 225;
// Light on each side, as in the inventory.
const SHADE = { up: 1, down: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6 };

function rotate(point, axis, degrees, origin = [0, 0, 0]) {
  if (!degrees) return point;
  const c = Math.cos(degrees * RAD), s = Math.sin(degrees * RAD);
  const [x, y, z] = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
  const turned = axis === "x" ? [x, y * c - z * s, y * s + z * c]
    : axis === "y" ? [x * c + z * s, y, -x * s + z * c]
      : [x * c - y * s, x * s + y * c, z];
  return [turned[0] + origin[0], turned[1] + origin[1], turned[2] + origin[2]];
}

/**
 * Corners of one side of a box (top-left, top-right, bottom-right, bottom-left
 * as seen from outside) and the texture area the game uses for it by default.
 */
function sideOf(direction, [x1, y1, z1], [x2, y2, z2]) {
  switch (direction) {
    case "north": return { corners: [[x2, y2, z1], [x1, y2, z1], [x1, y1, z1], [x2, y1, z1]], uv: [16 - x2, 16 - y2, 16 - x1, 16 - y1] };
    case "south": return { corners: [[x1, y2, z2], [x2, y2, z2], [x2, y1, z2], [x1, y1, z2]], uv: [x1, 16 - y2, x2, 16 - y1] };
    case "west": return { corners: [[x1, y2, z1], [x1, y2, z2], [x1, y1, z2], [x1, y1, z1]], uv: [z1, 16 - y2, z2, 16 - y1] };
    case "east": return { corners: [[x2, y2, z2], [x2, y2, z1], [x2, y1, z1], [x2, y1, z2]], uv: [16 - z2, 16 - y2, 16 - z1, 16 - y1] };
    case "up": return { corners: [[x1, y2, z1], [x2, y2, z1], [x2, y2, z2], [x1, y2, z2]], uv: [x1, z1, x2, z2] };
    default: return { corners: [[x1, y1, z2], [x2, y1, z2], [x2, y1, z1], [x1, y1, z1]], uv: [x1, 16 - z2, x2, 16 - z1] };
  }
}

/**
 * elements: the model's boxes, each face carrying `image` ({data: RGBA, w, h})
 *           and optionally `tint` ([r, g, b]) besides the usual uv / rotation.
 * turn:     {x, y} blockstate rotation in degrees.
 * size:     output width and height in pixels.
 * Returns {tile: RGBA bytes, rgb: average unshaded colour, coverage: 0..1}, or
 * null when nothing is visible.
 */
export function renderModel(elements, turn, size) {
  const big = size * SUPERSAMPLE, scale = big / VIEW_SPAN;
  const colour = new Float32Array(big * big * 4), depth = new Float32Array(big * big).fill(-Infinity);
  const sum = [0, 0, 0];
  const flat = new Float32Array(big * big * 3);   // unshaded colour, for the average

  const place = (point, element) => {
    let p = point;
    const r = element.rotation;
    if (r) p = rotate(p, r.axis, r.angle, r.origin);
    p = [p[0] - 8, p[1] - 8, p[2] - 8];
    p = rotate(p, "x", -(turn.x || 0));
    p = rotate(p, "y", -(turn.y || 0));
    p = rotate(p, "y", VIEW_YAW);
    p = rotate(p, "x", VIEW_PITCH);
    return [big / 2 + p[0] * scale, big / 2 - p[1] * scale, p[2]];
  };

  for (const element of elements) {
    for (const [direction, face] of Object.entries(element.faces || {})) {
      if (!face.image) continue;
      const side = sideOf(direction, element.from, element.to);
      const [u0, v0, u1, v1] = face.uv || side.uv;
      const quarter = Math.round((face.rotation || 0) / 90);
      const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      const points = side.corners.map((corner, i) => {
        const [x, y, z] = place(corner, element), [u, v] = uvs[(i + quarter) % 4];
        return { x, y, z, u, v };
      });
      const shade = SHADE[direction], tint = face.tint || [255, 255, 255], { image } = face;
      for (const [a, b, c] of [[points[0], points[1], points[2]], [points[0], points[2], points[3]]]) {
        const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
        if (Math.abs(area) < 1e-6) continue;
        const left = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), right = Math.min(big - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
        const top = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), bottom = Math.min(big - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
        for (let y = top; y <= bottom; y++) {
          for (let x = left; x <= right; x++) {
            const px = x + 0.5, py = y + 0.5;
            const wa = ((b.x - px) * (c.y - py) - (c.x - px) * (b.y - py)) / area;
            const wb = ((c.x - px) * (a.y - py) - (a.x - px) * (c.y - py)) / area;
            const wc = 1 - wa - wb;
            if (wa < 0 || wb < 0 || wc < 0) continue;
            const z = wa * a.z + wb * b.z + wc * c.z, at = y * big + x;
            if (z <= depth[at]) continue;
            const u = wa * a.u + wb * b.u + wc * c.u, v = wa * a.v + wb * b.v + wc * c.v;
            const tx = Math.min(image.w - 1, Math.max(0, Math.floor(u / 16 * image.w)));
            const ty = Math.min(image.h - 1, Math.max(0, Math.floor(v / 16 * image.h)));
            const s = (ty * image.w + tx) * 4;
            if (image.data[s + 3] < 128) continue;
            depth[at] = z;
            for (let ch = 0; ch < 3; ch++) {
              const value = image.data[s + ch] * tint[ch] / 255;
              flat[at * 3 + ch] = value;
              colour[at * 4 + ch] = value * shade;
            }
            colour[at * 4 + 3] = 255;
          }
        }
      }
    }
  }

  // Average the supersampled picture down to the final size.
  const tile = new Uint8Array(size * size * 4);
  let visible = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, hits = 0;
      for (let dy = 0; dy < SUPERSAMPLE; dy++) {
        for (let dx = 0; dx < SUPERSAMPLE; dx++) {
          const at = (y * SUPERSAMPLE + dy) * big + x * SUPERSAMPLE + dx;
          if (!colour[at * 4 + 3]) continue;
          r += colour[at * 4]; g += colour[at * 4 + 1]; b += colour[at * 4 + 2];
          sum[0] += flat[at * 3]; sum[1] += flat[at * 3 + 1]; sum[2] += flat[at * 3 + 2];
          hits++;
        }
      }
      if (!hits) continue;
      visible += hits;
      const o = (y * size + x) * 4;
      tile[o] = Math.round(r / hits); tile[o + 1] = Math.round(g / hits); tile[o + 2] = Math.round(b / hits);
      tile[o + 3] = Math.round(255 * hits / (SUPERSAMPLE * SUPERSAMPLE));
    }
  }
  if (!visible) return null;
  return { tile, rgb: sum.map((v) => Math.round(v / visible)), coverage: visible / (big * big) };
}
