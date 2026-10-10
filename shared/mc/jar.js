// Version-specific block palettes built from Java client JAR assets, in the browser.
// Reads data only; nothing from the JAR is ever executed.
//
// Four lists are produced: "blocks" are full opaque cubes usable in a wall,
// drawn by their north side; "faces" are the other sides of those cubes that
// look different (the top of a log, the bottom of a piston); "decorations"
// are everything else worth showing: plants, see-through or biome-tinted cubes
// (flowers, leaves, glass) drawn flat, and blocks with a shape of their own
// (anvils, hoppers, cauldrons, stairs, slabs) drawn as small 3D pictures; and
// "fronts" are blocks that are not full cubes but fill the whole square when
// looked at from the north (a shulker box on its side, an open trapdoor).
import { isLegacy, legacyBlock } from "./legacy.js";
import { DECO_BYTES, DECO_PX, TILE_BYTES, TILE_PX } from "./palette.js";
import { renderModel } from "./render.js";
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
// The other sides of a cube, in the order they are listed, and what each is called.
const OTHER_FACES = [["up", "top"], ["down", "bottom"], ["south", "side"], ["east", "side"], ["west", "side"]];

// Model families drawn as flat sprites, and the texture variable each one uses.
const SPRITE_PARENTS = {
  cross: "cross", tinted_cross: "cross", tallgrass: "cross", template_seagrass: "texture",
  coral_fan: "fan", crop: "crop",
};
// Biome-dependent colours are fixed to the plains biome.
const TINTS = [
  [/water|bubble/, [0x3f, 0x76, 0xe4]],
  [/birch_leaves/, [0x80, 0xa7, 0x55]], [/spruce_leaves/, [0x61, 0x99, 0x61]],
  [/mangrove_leaves/, [0x92, 0xc6, 0x48]], [/lily_pad|waterlily/, [0x20, 0x80, 0x30]],
  [/leaves|vine/, [0x77, 0xab, 0x2f]], [/./, [0x91, 0xbd, 0x59]],
];
const UNTINTED = /cherry|azalea|pale_oak/;  // greyish leaves that still keep their own colour
// Blocks whose model is not what the block looks like (drawn by code, or only
// meaningful next to a neighbour) or that are not building material at all.
const NO_ICON = /_door$|_bed$|_button$|^lever$|^tripwire_hook$|_sign$|_banner$|_head$|_skull$|piston_head|moving_piston|^(fire|soul_fire|redstone_wire|tripwire|nether_portal|end_portal|end_gateway|water|lava|air|cave_air|void_air|bubble_column|structure_void|barrier|light)$|^potted_|_wall_|wall_torch$|candle_cake$|^attached_/;
const MIN_COVERAGE = 0.08;
const MIN_ICON_COVERAGE = 0.035;  // the same limit for the 3D pictures  // sprites with fewer visible pixels have no useful colour

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

/** The part of a texture a model face shows; a uv box given backwards mirrors it. */
function faceImage(texture, face) {
  const uv = face.uv || [0, 0, 16, 16];
  const [x0, y0, x1, y1] = uv.map((v, i) => Math.round(v / 16 * (i % 2 === 0 ? texture.w : texture.h)));
  const part = crop(texture, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1));
  if (!part.w || !part.h) throw new Error("Empty face");
  const out = new Uint8ClampedArray(part.data.length);
  for (let y = 0; y < part.h; y++) {
    for (let x = 0; x < part.w; x++) {
      const s = ((y1 < y0 ? part.h - 1 - y : y) * part.w + (x1 < x0 ? part.w - 1 - x : x)) * 4;
      out.set(part.data.subarray(s, s + 4), (y * part.w + x) * 4);
    }
  }
  return rotateClockwise({ data: out, w: part.w, h: part.h }, (face.rotation || 0) / 90);
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
        // Own and inherited model names, without namespace and folder.
        lineage: [name.replace(/^minecraft:/, "").replace(/^block\//, ""), ...(parent.lineage || [])],
      });
    }
    return this.models.get(name);
  }

  async texture(reference, textures) {
    const seen = new Set();
    // Newer versions may give a texture as {sprite, ...render flags}.
    const sprite = (value) => (value && typeof value === "object" ? value.sprite : value);
    reference = sprite(reference);
    while (reference.startsWith("#")) {
      if (seen.has(reference)) throw new Error("Cyclic texture reference");
      seen.add(reference);
      reference = sprite(textures[reference.slice(1)]);
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

  /**
   * The six sides of a full, opaque, unrotated cube as 16x16 tiles keyed by
   * direction ({north, up, down, ...}), else null.
   */
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
    const tiles = {};
    for (const [direction, face] of Object.entries(faces)) {
      if ("tintindex" in face) return null;
      const image = await this.texture(face.texture, model.textures || {});
      const uv = face.uv || [0, 0, 16, 16];
      const box = uv.map((v, i) => Math.round(v / 16 * (i % 2 === 0 ? image.w : image.h)));
      const part = crop(image, ...box);
      for (let i = 3; i < part.data.length; i += 4) if (part.data[i] !== 255) return null;
      if (!part.w || !part.h) throw new Error("Empty face");
      tiles[direction] = toTile(rotateClockwise(part, (face.rotation || 0) / 90));
    }
    return tiles;
  }

  /**
   * A flat RGBA picture of a plant sprite or of a see-through / tinted cube,
   * with its average visible colour: {tile, rgb}, else null.
   */
  async decorationTile(entry, block) {
    if (entry.x || entry.y) return null;
    const model = await this.model(entry.model);
    const textures = model.textures || {}, elements = model.elements || [];
    let image = null;
    const family = model.lineage.find((name) => name in SPRITE_PARENTS);
    if (family) {
      image = await this.texture(`#${SPRITE_PARENTS[family]}`, textures);
    } else if (elements.length === 1) {
      const cube = elements[0], north = (cube.faces || {}).north;
      const same = (a, b) => Array.isArray(a) && a.length === 3 && a.every((v, i) => v === b[i]);
      if (!north || !same(cube.from, [0, 0, 0]) || !same(cube.to, [16, 16, 16]) || "rotation" in cube) return null;
      const texture = await this.texture(north.texture, textures);
      const uv = north.uv || [0, 0, 16, 16];
      const box = uv.map((v, i) => Math.round(v / 16 * (i % 2 === 0 ? texture.w : texture.h)));
      image = rotateClockwise(crop(texture, ...box), (north.rotation || 0) / 90);
    }
    if (!image || !image.w || !image.h) return null;

    const tinted = model.lineage.includes("tinted_cross") || model.lineage.includes("leaves")
      || elements.some((element) => Object.values(element.faces || {}).some((face) => "tintindex" in face));
    const tint = tinted && isTinted(image, block) ? TINTS.find(([pattern]) => pattern.test(block))[1] : [255, 255, 255];
    const tile = new Uint8Array(DECO_BYTES), sum = [0, 0, 0];
    let visible = 0;
    for (let y = 0; y < DECO_PX; y++) {
      const sy = Math.min(image.h - 1, Math.floor((y + 0.5) * image.h / DECO_PX));
      for (let x = 0; x < DECO_PX; x++) {
        const sx = Math.min(image.w - 1, Math.floor((x + 0.5) * image.w / DECO_PX));
        const s = (sy * image.w + sx) * 4, d = (y * DECO_PX + x) * 4;
        for (let c = 0; c < 3; c++) tile[d + c] = Math.round(image.data[s + c] * tint[c] / 255);
        tile[d + 3] = image.data[s + 3];
        if (tile[d + 3] >= 128) { visible++; for (let c = 0; c < 3; c++) sum[c] += tile[d + c]; }
      }
    }
    if (visible < MIN_COVERAGE * DECO_PX * DECO_PX) return null;
    // A plain opaque cube that is not a wall block (odd model) is not a decoration either.
    if (!family && !tinted && visible === DECO_PX * DECO_PX && tile.every((v, i) => i % 4 !== 3 || v === 255)) return null;
    return { tile, rgb: sum.map((v) => Math.round(v / visible)) };
  }

  /**
   * The picture of a block that is not a full cube but, in the right state,
   * fills the whole square for someone looking at it from the north:
   * {properties, tile}, else null. Pictures with holes do not count.
   *
   * state: the block's blockstate file.
   */
  async frontTile(block, state) {
    let image = null, properties = "";
    if (/(^|_)shulker_box$/.test(block)) {
      // Drawn by code from the shulker's texture; lying on its side it shows the top of its lid.
      const colour = block.replace(/_?shulker_box$/, "");
      const texture = await this.texture(`minecraft:entity/shulker/shulker${colour ? `_${colour}` : ""}`, {});
      const k = texture.w / 64;
      image = crop(texture, 16 * k, 0, 32 * k, 16 * k);
      properties = "facing=north";
    } else if (/(^|_)trapdoor$/.test(block)) {
      // Open and hinged on the north edge, the door stands flush with the north side.
      properties = "facing=south,half=bottom,open=true";
      const entries = (state.variants || {})[properties];
      const entry = Array.isArray(entries) ? entries[0] : entries;
      if (!entry || entry.x) return null;
      const model = await this.model(entry.model), door = (model.elements || [])[0];
      // The model is turned about the vertical axis: which of its sides ends up facing north.
      const side = { 0: "north", 90: "west", 180: "south", 270: "east" }[entry.y || 0];
      const face = door && (door.faces || {})[side];
      if (!face) return null;
      image = faceImage(await this.texture(face.texture, model.textures || {}), face);
    } else if (block === "composter") {
      const part = (state.multipart || []).find((item) => !item.when);
      if (!part) return null;
      const model = await this.model(part.apply.model);
      image = await this.texture("#side", model.textures || {});
    }
    if (!image || !image.w || !image.h) return null;
    for (let i = 3; i < image.data.length; i += 4) if (image.data[i] !== 255) return null;
    return { properties, tile: toTile(image) };
  }

  /**
   * A small 3D picture of a block with a shape of its own (anvil, hopper,
   * stairs), as the inventory shows it: {tile, rgb}, else null.
   */
  async modelIcon(entry, block) {
    if (NO_ICON.test(block)) return null;
    const model = await this.model(entry.model), textures = model.textures || {};
    const elements = [];
    for (const element of model.elements || []) {
      const faces = {};
      for (const [direction, face] of Object.entries(element.faces || {})) {
        let image;
        try { image = await this.texture(face.texture, textures); } catch { continue; }
        const tint = "tintindex" in face && isTinted(image, block) ? TINTS.find(([pattern]) => pattern.test(block))[1] : null;
        faces[direction] = { ...face, image, tint };
      }
      elements.push({ ...element, faces });
    }
    if (!elements.length) return null;
    const picture = renderModel(elements, { x: entry.x || 0, y: entry.y || 0 }, DECO_PX);
    // Buttons, levers and the like come out as a few pixels: not worth a tile.
    return picture && picture.coverage >= MIN_ICON_COVERAGE ? { tile: picture.tile, rgb: picture.rgb } : null;
  }
}

/**
 * Variant order for decorations: the top of a tall plant, the plain shape of
 * stairs rather than a corner, flat rails rather than sloped ones, then the
 * oldest crop stage.
 */
function decorationOrder(a, b) {
  const rank = (key) => (key.includes("half=upper") ? 0 : 1)
    + (key.includes("shape=") && !key.includes("shape=straight") ? 2 : 0)
    + (key.includes("ascending") ? 4 : 0);
  const age = (key) => Number((/age=(\d+)/.exec(key) || [0, -1])[1]);
  return rank(a) - rank(b) || age(b) - age(a) || (a < b ? -1 : a > b ? 1 : 0);
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

/**
 * The game only tints some of the blocks whose models allow it (cherry and
 * azalea leaves keep their own colours); the textures it does tint are grey.
 */
function isTinted(image, block) {
  let spread = 0, opaque = 0;
  for (let p = 0; p < image.data.length; p += 4) {
    if (image.data[p + 3] < 128) continue;
    spread += Math.abs(image.data[p] - image.data[p + 1]) + Math.abs(image.data[p + 1] - image.data[p + 2]);
    opaque++;
  }
  return opaque > 0 && spread / opaque < 40 && !UNTINTED.test(block);
}

/** Whether two packed RGB tiles show the same picture, allowing quarter turns. */
function sameTexture(a, b) {
  const turns = [
    (x, y) => [x, y], (x, y) => [TILE_PX - 1 - y, x],
    (x, y) => [TILE_PX - 1 - x, TILE_PX - 1 - y], (x, y) => [y, TILE_PX - 1 - x],
  ];
  return turns.some((turn) => {
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const [tx, ty] = turn(x, y), p = (y * TILE_PX + x) * 3, q = (ty * TILE_PX + tx) * 3;
        if (a[p] !== b[q] || a[p + 1] !== b[q + 1] || a[p + 2] !== b[q + 2]) return false;
      }
    }
    return true;
  });
}

/** Average colour of a packed RGB tile, rounded half to even like the bundled palettes. */
function averageColour(tile) {
  const sum = [0, 0, 0];
  tile.forEach((v, i) => { sum[i % 3] += v; });
  return sum.map((v) => (v % 256 === 128 ? (v >> 8) + ((v >> 8) & 1) : Math.round(v / 256)));
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
 * Returns {version, dataVersion, blocks, tiles, faces, faceTiles, fronts,
 * frontTiles, decorations, decoTiles, skipped}. fronts is [{id, name, rgb}],
 * each in the state that shows its picture to the north. faces is [{block: index into blocks, face: "top" |
 * "bottom" | "side", sides: every side it is seen on, rgb}]; a block carries
 * `sides` too when its own picture is not on all of them. tiles and faceTiles are packed RGB, decoTiles packed
 * RGBA, 16x16 each. Throws
 * Error("no-blocks") when the archive has no supported full blocks.
 */
export async function importJar(buffer, fileName, decodePng, onProgress) {
  const archive = new ZipArchive(buffer);
  const { name, dataVersion } = await versionMetadata(archive, fileName);
  const assets = new JarAssets(archive, decodePng);
  const prefix = "assets/minecraft/blockstates/";
  const states = archive.names().filter((n) => n.startsWith(prefix) && n.endsWith(".json")).sort();
  const blocks = [], tiles = [], faces = [], faceTiles = [], decorations = [], decoTiles = [], skipped = [];
  const fronts = [], frontTiles = [];
  for (let s = 0; s < states.length; s++) {
    if (onProgress && s % 16 === 0) onProgress(s / states.length);
    const block = states[s].slice(prefix.length, -5);
    let chosen = null, variants = {};
    try {
      const state = await archive.json(states[s]);
      // Blocks named with numbers before 1.13 are left to the lists that can export them.
      const front = isLegacy(dataVersion) ? null : await assets.frontTile(block, state).catch(() => null);
      if (front) {
        fronts.push({
          id: `minecraft:${block}` + (front.properties ? `[${front.properties}]` : ""),
          name: titleCase(block), rgb: averageColour(front.tile),
        });
        frontTiles.push(front.tile);
      }
      variants = state.variants || {};
      search: for (const properties of Object.keys(variants).sort()) {
        const entries = variants[properties];
        for (const entry of Array.isArray(entries) ? entries : [entries]) {
          let sides = null;
          try { sides = await assets.wallTile(entry); } catch { continue; }
          if (sides) { chosen = { properties, tile: sides.north, sides }; break search; }
        }
      }
    } catch { /* unreadable blockstate: skip */ }
    // Pre-1.13 variants without a known numeric id could not be exported.
    if (chosen && isLegacy(dataVersion) && !legacyBlock(`minecraft:${block}`)) { skipped.push(block); continue; }
    // A slab is a block when doubled; on its own it is a decoration with its half shape.
    const alsoSlab = chosen && chosen.properties === "type=double" && "type=bottom" in variants;
    if (!chosen || alsoSlab) {
      let decoration = null;
      const ordered = alsoSlab ? ["type=bottom"] : Object.keys(variants).sort(decorationOrder);
      // Unrotated variants first: their picture faces the way the model was drawn.
      search: for (const allowTurned of [false, true]) {
        for (const properties of ordered) {
          const entries = variants[properties];
          for (const entry of Array.isArray(entries) ? entries : [entries]) {
            if (Boolean(entry.x || entry.y) !== allowTurned) continue;
            try {
              decoration = await assets.decorationTile(entry, block) || await assets.modelIcon(entry, block);
            } catch { continue; }
            if (decoration) { decoration.properties = properties === "normal" ? "" : properties; break search; }
          }
        }
      }
      if (decoration) {
        decorations.push({
          id: `minecraft:${block}` + (decoration.properties ? `[${decoration.properties}]` : ""),
          name: titleCase(block), rgb: decoration.rgb,
        });
        decoTiles.push(decoration.tile);
      } else if (!chosen) {
        skipped.push(block);
      }
      if (!chosen) continue;
    }
    // Legacy blockstates use ``normal`` as a variant selector, not as a real
    // block-state property.
    const properties = chosen.properties === "normal" ? "" : chosen.properties;
    blocks.push({
      id: `minecraft:${block}` + (properties ? `[${properties}]` : ""),
      name: titleCase(block),
      category: category(block),
      rgb: averageColour(chosen.tile),
    });
    tiles.push(chosen.tile);
    // Group the six sides by what they look like. The north picture is the
    // block itself; every other distinct picture becomes a face entry. `sides`
    // records where each picture is seen ("side", "top", "bottom").
    const pictures = [{ tile: chosen.tile, sides: new Set(["side"]) }];
    for (const [direction, label] of OTHER_FACES) {
      // Snow lies on top of a snowy block, so the texture under it is never seen.
      if (direction === "up" && properties.includes("snowy=true")) continue;
      const tile = chosen.sides[direction];
      const known = pictures.find((picture) => sameTexture(picture.tile, tile));
      if (known) known.sides.add(label);
      else pictures.push({ tile, sides: new Set([label]), face: label });
    }
    // Left out when the block looks the same from everywhere, which most do.
    if (pictures[0].sides.size < 3) blocks.at(-1).sides = [...pictures[0].sides];
    for (const picture of pictures.slice(1)) {
      faces.push({ block: blocks.length - 1, face: picture.face, sides: [...picture.sides], rgb: averageColour(picture.tile) });
      faceTiles.push(picture.tile);
    }
  }
  if (!blocks.length) throw new Error("no-blocks");
  const packed = new Uint8Array(blocks.length * TILE_BYTES);
  tiles.forEach((tile, i) => packed.set(tile, i * TILE_BYTES));
  const packedFaces = new Uint8Array(faces.length * TILE_BYTES);
  faceTiles.forEach((tile, i) => packedFaces.set(tile, i * TILE_BYTES));
  const packedFronts = new Uint8Array(fronts.length * TILE_BYTES);
  frontTiles.forEach((tile, i) => packedFronts.set(tile, i * TILE_BYTES));
  const packedDeco = new Uint8Array(decorations.length * DECO_BYTES);
  decoTiles.forEach((tile, i) => packedDeco.set(tile, i * DECO_BYTES));
  return {
    version: name, dataVersion, blocks, tiles: packed, faces, faceTiles: packedFaces,
    fronts, frontTiles: packedFronts, decorations, decoTiles: packedDeco, skipped,
  };
}
