// Palette storage: versions bundled with the site plus JARs imported in this browser.
import { importJar } from "./jar.js";
import { makePalette, TILE_BYTES, TILE_PX, tilesFromAtlas } from "./palette.js";

const BUNDLED = new URL("./palettes/", import.meta.url);
const ATLAS_COLS = 32;
const DB_NAME = "tools.pixel", STORE = "palettes";
const RECORD_FORMAT = 2;      // 2: imported palettes also carry decorations

const loaded = new Map();     // key -> palette
const session = new Map();    // imported records, also the fallback when IndexedDB is unavailable

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "sha" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function importedRecords() {
  try {
    for (const record of await store("readonly", (s) => s.getAll())) session.set(record.sha, record);
  } catch { /* private mode etc.: imports last for this session only */ }
  return [...session.values()];
}

async function decodeImage(blob) {
  const bitmap = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, w: canvas.width, h: canvas.height };
}

/** {entries: [{key, version, imported}], defaultKey} */
export async function listPalettes() {
  const index = await (await fetch(new URL("index.json", BUNDLED))).json();
  const entries = index.palettes.map((p) => ({ key: `bundled:${p.version}`, version: p.version, imported: false }));
  for (const record of await importedRecords()) {
    entries.push({ key: `jar:${record.sha}`, version: record.version, imported: true });
  }
  return { entries, defaultKey: `bundled:${index.default}` };
}

export async function loadPalette(key) {
  if (!loaded.has(key)) {
    const [kind, name] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    let palette;
    if (kind === "bundled") {
      const response = await fetch(new URL(`${encodeURIComponent(name)}.json`, BUNDLED));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const image = async (suffix) => decodeImage(
        await (await fetch(new URL(`${encodeURIComponent(name)}${suffix}.png`, BUNDLED))).blob());
      const atlas = await image(""), decorations = data.decorations || [];
      const decoAtlas = decorations.length ? await image(".deco") : null;
      palette = makePalette({
        key, version: data.version, dataVersion: data.data_version, blocks: data.blocks,
        tiles: tilesFromAtlas(atlas.data, atlas.w, data.blocks.length, data.cols),
        decorations,
        decoTiles: decoAtlas ? tilesFromAtlas(decoAtlas.data, decoAtlas.w, decorations.length, data.cols, 4) : undefined,
      });
    } else {
      const record = session.get(name);
      if (!record) throw new Error("Unknown palette.");
      palette = makePalette({ key, ...record });
    }
    loaded.set(key, palette);
  }
  return loaded.get(key);
}

async function digest(buffer, file) {
  // crypto.subtle only exists in secure contexts (https / localhost).
  if (!globalThis.crypto || !crypto.subtle) return `${file.name}-${file.size}-${file.lastModified}`;
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  return [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Import a client JAR (content-addressed, so each JAR is processed once). Returns {key, record}. */
export async function importJarFile(file, onProgress) {
  const buffer = await file.arrayBuffer();
  const sha = await digest(buffer, file);
  let record = session.get(sha);
  if (!record || record.format !== RECORD_FORMAT) {
    const decodePng = (bytes) => decodeImage(new Blob([bytes], { type: "image/png" }));
    const result = await importJar(buffer, file.name, decodePng, onProgress);
    record = { ...result, sha, format: RECORD_FORMAT, skipped: result.skipped.length };
    loaded.delete(`jar:${sha}`);
    session.set(sha, record);
    try { await store("readwrite", (s) => s.put(record)); } catch { /* kept for this session */ }
  }
  return { key: `jar:${sha}`, record };
}

const atlases = new WeakMap();

/** CSS custom properties that let `.tile` elements show this palette's textures. */
export function atlasStyle(palette) {
  if (!atlases.has(palette)) {
    const rows = Math.ceil(palette.size / ATLAS_COLS);
    const canvas = document.createElement("canvas");
    canvas.width = ATLAS_COLS * TILE_PX; canvas.height = rows * TILE_PX;
    const image = new ImageData(canvas.width, canvas.height);
    for (let i = 0; i < palette.size; i++) {
      const ox = (i % ATLAS_COLS) * TILE_PX, oy = Math.floor(i / ATLAS_COLS) * TILE_PX;
      for (let p = 0; p < TILE_PX * TILE_PX; p++) {
        const s = i * TILE_BYTES + p * 3;
        const d = ((oy + Math.floor(p / TILE_PX)) * canvas.width + ox + (p % TILE_PX)) * 4;
        image.data[d] = palette.tiles[s]; image.data[d + 1] = palette.tiles[s + 1];
        image.data[d + 2] = palette.tiles[s + 2]; image.data[d + 3] = 255;
      }
    }
    canvas.getContext("2d").putImageData(image, 0, 0);
    atlases.set(palette, {
      "--atlas": `url(${canvas.toDataURL("image/png")})`,
      "--atlas-size": `${ATLAS_COLS * 20}px ${rows * 20}px`,
    });
  }
  return atlases.get(palette);
}

/** A 20px icon of block number `index` in the palette whose atlasStyle is set on an ancestor. */
export function tileIcon(index) {
  const icon = document.createElement("i");
  icon.className = "tile";
  icon.style.backgroundPosition = `${-(index % ATLAS_COLS) * 20}px ${-Math.floor(index / ATLAS_COLS) * 20}px`;
  return icon;
}

/**
 * A 16x16 canvas showing one block (kind "block") or decoration (kind "deco").
 * Scale it with CSS and `image-rendering: pixelated`.
 */
export function tileCanvas(palette, kind, index) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE_PX;
  const image = new ImageData(TILE_PX, TILE_PX), deco = kind === "deco";
  const source = deco ? palette.decoTiles : palette.tiles, step = deco ? 4 : 3;
  for (let p = 0; p < TILE_PX * TILE_PX; p++) {
    const s = index * TILE_PX * TILE_PX * step + p * step;
    image.data[p * 4] = source[s]; image.data[p * 4 + 1] = source[s + 1];
    image.data[p * 4 + 2] = source[s + 2]; image.data[p * 4 + 3] = deco ? source[s + 3] : 255;
  }
  canvas.getContext("2d").putImageData(image, 0, 0);
  return canvas;
}
