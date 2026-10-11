// Heads drawn the way the game shows them in the inventory: a cube seen from
// above, front face on the left, with the hat layer around it. Skins come from
// textures.minecraft.net, which allows cross-origin reads.

const TEXTURE_URL = "https://textures.minecraft.net/texture/";
const C = Math.cos(Math.PI / 6), S = 0.5;

// Faces in the skin: [skin x, skin y] of the 8×8 square, for the head and for the hat.
const FACES = {
  top: { base: [8, 0], hat: [40, 0], shade: 0 },
  front: { base: [8, 8], hat: [40, 8], shade: 0.18 },
  side: { base: [16, 8], hat: [48, 8], shade: 0.34 },
};

const skins = new Map(); // texture hash → Promise<image>
const MAX_SKINS = 800;

/** The skin image of a texture hash; loaded once. */
export function loadSkin(hash) {
  let promise = skins.get(hash);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`no skin ${hash}`));
      image.src = TEXTURE_URL + hash;
    });
    promise.catch(() => skins.delete(hash));
    if (skins.size >= MAX_SKINS) skins.delete(skins.keys().next().value);
    skins.set(hash, promise);
  }
  return promise;
}

let scratch = null;
/** One 8×8 face of the skin, darkened by `shade`. */
function face(image, [x, y], shade) {
  if (!scratch) {
    scratch = document.createElement("canvas");
    scratch.width = scratch.height = 8;
  }
  const context = scratch.getContext("2d");
  context.globalCompositeOperation = "copy";
  context.drawImage(image, x, y, 8, 8, 0, 0, 8, 8);
  if (shade) {
    // Darken only where the face has pixels.
    context.globalCompositeOperation = "source-atop";
    context.fillStyle = `rgba(0, 0, 0, ${shade})`;
    context.fillRect(0, 0, 8, 8);
  }
  return scratch;
}

/** Screen position of a point of the cube: x to the right, y up, z away from the viewer. */
const point = (x, y, z) => [C * (x + z), S * (x - z) - y];

/**
 * Draw the head into the canvas. The head fills the canvas; `canvas.width`
 * sets the resolution.
 */
export function drawHead(canvas, image) {
  const context = canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  // The hat cube spans -0.5…8.5; its outline is 14.7 wide and 18 high in skin pixels.
  const unit = canvas.height / 18.4;
  const left = canvas.width / 2 - C * 8 * unit, top = canvas.height / 2 + 4 * unit;
  const transform = (origin, u, v, k) => {
    const [ox, oy] = point(...origin);
    context.setTransform(u[0] * k * unit, u[1] * k * unit, v[0] * k * unit, v[1] * k * unit, left + ox * unit, top + oy * unit);
  };
  // A cube from `min` to `min + size` on every axis, faces scaled from 8 skin pixels.
  const cube = (layer, min, size) => {
    const k = size / 8, max = min + size;
    transform([min, max, max], [C, S], [-C, S], k);
    context.drawImage(face(image, FACES.top[layer], FACES.top.shade), 0, 0);
    transform([min, max, min], [C, S], [0, 1], k);
    context.drawImage(face(image, FACES.front[layer], FACES.front.shade), 0, 0);
    transform([max, max, min], [C, -S], [0, 1], k);
    context.drawImage(face(image, FACES.side[layer], FACES.side.shade), 0, 0);
  };
  cube("base", 0, 8);
  // The hat layer only exists in skins that are 64 pixels wide.
  if (image.naturalWidth >= 64) cube("hat", -0.5, 9);
  context.setTransform(1, 0, 0, 1, 0, 0);
}
