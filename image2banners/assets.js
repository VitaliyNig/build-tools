// Loads the bundled banner-pattern and block textures (works in pages and workers).
import { prepareAssets } from "./core/generate.js";
import { decodePng } from "./core/png.js";

const BASE = new URL("./assets/", import.meta.url);

async function png(name) {
  const response = await fetch(new URL(name, BASE));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return decodePng(new Uint8Array(await response.arrayBuffer()));
}

let loading = null;

export function loadAssets() {
  loading ||= Promise.all([
    fetch(new URL("meta.json", BASE)).then((response) => response.json()),
    png("patterns.png"),
    png("blocks.png"),
  ]).then(([meta, patterns, blocks]) => prepareAssets(meta, patterns, blocks));
  return loading;
}
