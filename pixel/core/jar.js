// Version-specific wall palettes built from Java client JAR assets, in the browser.
// Reads data only; nothing from the JAR is ever executed.
import { isLegacy, legacyBlock } from "./legacy.js";
import { TILE_BYTES, TILE_PX } from "./palette.js";
import { ZipArchive } from "./zip.js";

// The launcher JSON only started exposing ``world_version`` in newer client
// distributions, and a browser cannot see the launcher JSON next to the JAR, so
// keep the values needed for the common legacy client JARs here. Unknown release
// ids use the current export default.
const KNOWN_DATA_VERSIONS = {
  "1.12.2": 1343,
  "1.13": 1519, "1.13.1": 1628, "1.13.2": 1631,
  "1.14": 1952, "1.14.1": 1954, "1.14.2": 1957, "1.14.3": 1963, "1.14.4": 1968,
  "1.15": 2225, "1.15.1": 2227, "1.15.2": 2230,
  "1.16": 2567, "1.16.1": 2567, "1.16.2": 2578, "1.16.3": 2580, "1.16.4": 2586, "1.16.5": 2586,
  "1.17": 2724, "1.17.1": 2730,
  "1.18": 2860, "1.18.1": 2865, "1.18.2": 2975,
  "1.19": 3105, "1.19.1": 3117, "1.19.2": 3120, "1.19.3": 3121, "1.19.4": 3337,
  "1.20": 3463, "1.20.1": 3465, "1.20.2": 3578, "1.20.3": 3692, "1.20.4": 3700,
  "1.20.5": 3837, "1.20.6": 3839,
  "1.21": 3953, "1.21.1": 3955, "1.21.2": 4082, "1.21.3": 4083, "1.21.4": 4189,
  "1.21.5": 4325, "1.21.6": 4439, "1.21.7": 4440, "1.21.8": 4442,
};
const DEFAULT_DATA_VERSION = 4189;
const FACES = ["down", "east", "north", "south", "up", "west"];

function assetPath(resource, kind, extension) {
  const colon = resource.indexOf(":");
  const namespace = colon < 0 ? "minecraft" : resource.slice(0, colon);
  const name = colon < 0 ? resource : resource.slice(colon + 1);
  return `assets/${namespace}/${kind}/${name}.${extension}`;
}

function crop(image, x0, y0, x1, y1) {
  if (x1 < x0 || y1 < y0) throw new Error("Inverted crop box");
  const w = x1 - x0, h = y1 - y0, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x0 + x, sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= image.w || sy >= image.h) continue;
      const s = (sy * image.w + sx) * 4, d = (y * w + x) * 4;
      data[d] = image.data[s]; data[d + 1] = image.data[s + 1];
      data[d + 2] = image.data[s + 2]; data[d + 3] = image.data[s + 3];
    }
  }
  return { data, w, h };
}

function rotateClockwise(image, quarterTurns) {
  let { data, w, h } = image;
  for (let turn = 0; turn < (((quarterTurns % 4) + 4) % 4); turn++) {
    const out = new Uint8ClampedArray(data.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = (y * w + x) * 4, d = (x * h + (h - 1 - y)) * 4;
        out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = data[s + 3];
      }
    }
    data = out; [w, h] = [h, w];
  }
  return { data, w, h };
}

/** Nearest-neighbour resize to a packed RGB 16x16 tile. */
function toTile(image) {
  const tile = new Uint8Array(TILE_BYTES);
  for (let y = 0; y < TILE_PX; y++) {
    const sy = Math.min(image.h - 1, Math.floor((y + 0.5) * image.h / TILE_PX));
    for (let x = 0; x < TILE_PX; x++) {
      const sx = Math.min(image.w - 1, Math.floor((x + 0.5) * image.w / TILE_PX));
      const s = (sy * image.w + sx) * 4, d = (y * TILE_PX + x) * 3;
      tile[d] = image.data[s]; tile[d + 1] = image.data[s + 1]; tile[d + 2] = image.data[s + 2];
    }
  }
  return tile;
}

class JarAssets {
  /** decodePng: async (Uint8Array) -> {data: RGBA bytes, w, h} */
  constructor(archive, decodePng) {
    this.archive = archive;
    this.decodePng = decodePng;
    this.models = new Map();
    this.textures = new Map();
  }

  async model(name, visiting = []) {
    if (visiting.includes(name)) throw new Error("Cyclic model inheritance");
    if (!this.models.has(name)) {
      const candidates = [assetPath(name, "models", "json")];
      // 1.12-era blockstates omit the ``block/`` model namespace.
      if (!name.includes(":") && !name.includes("/")) {
        candidates.push(assetPath(`block/${name}`, "models", "json"));
      }
      const member = candidates.find((c) => this.archive.has(c));
      if (!member) throw new Error(`Missing model: ${candidates[0]}`);
      const data = await this.archive.json(member);
      const parent = "parent" in data ? await this.model(data.parent, [...visiting, name]) : {};
      this.models.set(name, {
        ...parent, ...data,
        textures: { ...(parent.textures || {}), ...(data.textures || {}) },
      });
    }
    return this.models.get(name);
  }

  async texture(reference, textures) {
    const seen = new Set();
    while (reference.startsWith("#")) {
      if (seen.has(reference)) throw new Error("Cyclic texture reference");
      seen.add(reference);
      reference = textures[reference.slice(1)];
    }
    const path = assetPath(reference, "textures", "png");
    if (!this.textures.has(path)) this.textures.set(path, this.loadTexture(path));
    return this.textures.get(path);
  }

  async loadTexture(path) {
    let image = await this.decodePng(await this.archive.read(path));
    // Respect the first displayed animation frame, including horizontal sheets.
    let animation = null;
    if (this.archive.has(`${path}.mcmeta`)) {
      animation = (await this.archive.json(`${path}.mcmeta`)).animation || null;
    }
    if (animation && Object.keys(animation).length) {
      const width = animation.width ?? ("height" in animation ? image.w : Math.min(image.w, image.h));
      const height = animation.height ?? ("width" in animation ? image.h : width);
      const frame = (animation.frames || [0])[0];
      const index = typeof frame === "object" ? frame.index : frame;
      const columns = Math.floor(image.w / width);
      const x = (index % columns) * width, y = Math.floor(index / columns) * height;
      image = crop(image, x, y, x + width, y + height);
    } else if (image.h > image.w) {
      image = crop(image, 0, 0, image.w, image.w);
    }
    return image;
  }

  /** North face of a full, opaque, unrotated cube as a 16x16 tile, else null. */
  async wallTile(entry) {
    // An explicit unrotated state makes the exported north face match the preview.
    if (entry.x || entry.y) return null;
    const model = await this.model(entry.model);
    const elements = model.elements || [];
    if (elements.length !== 1) return null;
    const cube = elements[0];
    const same = (a, b) => Array.isArray(a) && a.length === 3 && a.every((v, i) => v === b[i]);
    if (!same(cube.from, [0, 0, 0]) || !same(cube.to, [16, 16, 16]) || "rotation" in cube) return null;
    const faces = cube.faces || {};
    if (Object.keys(faces).sort().join() !== FACES.join()) return null;
    let north = null;
    for (const [direction, face] of Object.entries(faces)) {
      if ("tintindex" in face) return null;
      const image = await this.texture(face.texture, model.textures || {});
      const uv = face.uv || [0, 0, 16, 16];
      const box = uv.map((v, i) => Math.round(v / 16 * (i % 2 === 0 ? image.w : image.h)));
      const part = crop(image, ...box);
      for (let i = 3; i < part.data.length; i += 4) if (part.data[i] !== 255) return null;
      if (!part.w || !part.h) throw new Error("Empty face");
      if (direction === "north") north = toTile(rotateClockwise(part, (face.rotation || 0) / 90));
    }
    return north;
  }
}

function category(block) {
  for (const suffix of ["glazed_terracotta", "concrete_powder", "terracotta", "concrete", "wool"]) {
    if (block.endsWith(suffix)) return suffix;
  }
  if (["planks", "log", "wood", "stem", "hyphae", "bamboo"].some((part) => block.includes(part))) {
    return "wood";
  }
  return "other";
}

function titleCase(text) {
  return text.replace(/_/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

async function versionMetadata(archive, fileName) {
  let metadata = {};
  if (archive.has("version.json")) {
    try {
      const embedded = await archive.json("version.json");
      if (embedded && typeof embedded === "object") metadata = embedded;
    } catch { /* fall back to the filename */ }
  }
  const stem = fileName.replace(/\.jar$/i, "");
  // Infer a release id for old client JARs without embedded metadata.
  const fromName = stem.match(/(?<!\d)(\d+(?:\.\d+){1,3})(?!\d)/);
  const name = metadata.id || metadata.version || (fromName && fromName[1]) || stem || "imported";
  const dataVersion = metadata.world_version ?? metadata.data_version
    ?? metadata.worldVersion ?? metadata.dataVersion
    ?? KNOWN_DATA_VERSIONS[name] ?? DEFAULT_DATA_VERSION;
  if (typeof name !== "string" || !Number.isInteger(dataVersion)) {
    throw new Error("bad-metadata");
  }
  return { name, dataVersion };
}

/**
 * Build a palette from a client JAR's bytes.
 * Returns {version, dataVersion, blocks, tiles, skipped}; throws Error("no-blocks")
 * when the archive has no supported full blocks.
 */
export async function importJar(buffer, fileName, decodePng, onProgress) {
  const archive = new ZipArchive(buffer);
  const { name, dataVersion } = await versionMetadata(archive, fileName);
  const assets = new JarAssets(archive, decodePng);
  const prefix = "assets/minecraft/blockstates/";
  const states = archive.names().filter((n) => n.startsWith(prefix) && n.endsWith(".json")).sort();
  const blocks = [], tiles = [], skipped = [];
  for (let s = 0; s < states.length; s++) {
    if (onProgress && s % 16 === 0) onProgress(s / states.length);
    const block = states[s].slice(prefix.length, -5);
    let chosen = null;
    try {
      const variants = (await archive.json(states[s])).variants || {};
      search: for (const properties of Object.keys(variants).sort()) {
        const entries = variants[properties];
        for (const entry of Array.isArray(entries) ? entries : [entries]) {
          let tile = null;
          try { tile = await assets.wallTile(entry); } catch { continue; }
          if (tile) { chosen = { properties, tile }; break search; }
        }
      }
    } catch { /* unreadable blockstate: skip */ }
    // Pre-1.13 variants without a known numeric id could not be exported.
    if (chosen && isLegacy(dataVersion) && !legacyBlock(`minecraft:${block}`)) chosen = null;
    if (!chosen) { skipped.push(block); continue; }
    // Legacy blockstates use ``normal`` as a variant selector, not as a real
    // block-state property.
    const properties = chosen.properties === "normal" ? "" : chosen.properties;
    const sum = [0, 0, 0];
    chosen.tile.forEach((v, i) => { sum[i % 3] += v; });
    blocks.push({
      id: `minecraft:${block}` + (properties ? `[${properties}]` : ""),
      name: titleCase(block),
      category: category(block),
      // Round half to even, matching how the bundled palettes were built.
      rgb: sum.map((v) => (v % 256 === 128 ? (v >> 8) + ((v >> 8) & 1) : Math.round(v / 256))),
    });
    tiles.push(chosen.tile);
  }
  if (!blocks.length) throw new Error("no-blocks");
  const packed = new Uint8Array(blocks.length * TILE_BYTES);
  tiles.forEach((tile, i) => packed.set(tile, i * TILE_BYTES));
  return { version: name, dataVersion, blocks, tiles: packed, skipped };
}
