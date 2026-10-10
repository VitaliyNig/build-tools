// The HeadDB catalogue, as the HeadDB plugin and headsdb.com read it: a small
// manifest names the current files, which are Zstandard-compressed JSON on a
// mirror, each with its size and SHA-256. Files are named by their digest, so
// a file once downloaded never changes: they are kept in the browser's cache.
import { decompress } from "./vendor/fzstd.js";

export const MANIFEST = "https://data.headsdb.com/manifest.json";
const CACHE = "heads-catalog-v1";
const INDEX_TYPE = "application/vnd.heads.catalog-index+json";
const PART_TYPE = "application/vnd.heads.catalog-part+json";

async function openCache() {
  try { return await caches.open(CACHE); } catch { return null; } // no Cache Storage (private mode, plain HTTP)
}

/** The manifest from the network; the last one seen if the network fails. */
async function fetchManifest(cache) {
  try {
    const response = await fetch(MANIFEST, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.clone().json();
    await cache?.put(MANIFEST, response);
    return manifest;
  } catch (error) {
    const cached = await cache?.match(MANIFEST);
    if (cached) return cached.json();
    throw error;
  }
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) return null; // not a secure context: skip the check
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Read a response to the end, reporting the bytes received. */
async function readAll(response, total, onBytes) {
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const out = new Uint8Array(total);
  const reader = response.body.getReader();
  let at = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (at + value.length > out.length) throw new Error("larger than the manifest says");
    out.set(value, at);
    at += value.length;
    onBytes(value.length);
  }
  return out.subarray(0, at);
}

/** One file of the catalogue, checked and decompressed, as JSON. */
async function fetchArtifact(manifest, artifact, type, cache, onBytes) {
  if (artifact.contentType !== type) throw new Error(`unexpected file type ${artifact.contentType}`);
  if (artifact.compression !== "zstd") throw new Error(`unsupported compression ${artifact.compression}`);
  const { bytes: size, digest } = artifact.integrity;
  const mirrors = [...manifest.mirrors].sort((a, b) => a.priority - b.priority);
  let lastError = null;
  for (const mirror of mirrors) {
    const url = new URL(artifact.path, mirror.url).href;
    try {
      let response = await cache?.match(url);
      const cached = Boolean(response);
      if (!response) {
        response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }
      const bytes = await readAll(response, size, onBytes);
      if (bytes.length !== size) throw new Error(`expected ${size} bytes, got ${bytes.length}`);
      const actual = await sha256(bytes);
      if (actual && actual !== digest.toLowerCase()) throw new Error("checksum mismatch");
      if (!cached) await cache?.put(url, new Response(bytes, { headers: { "content-type": "application/zstd" } }));
      return JSON.parse(new TextDecoder().decode(decompress(bytes)));
    } catch (error) {
      if (cache) await cache.delete(url);
      lastError = new Error(`${url}: ${error.message || error}`);
    }
  }
  throw lastError;
}

/** Drop cached files the manifest no longer names. */
async function prune(cache, keep) {
  if (!cache) return;
  for (const request of await cache.keys()) {
    if (request.url !== MANIFEST && !keep.has(request.url)) await cache.delete(request);
  }
}

/**
 * Load the whole catalogue. `onProgress(fraction)` follows the download.
 * Returns { revision, timestamp, categories, tags, collections, heads }.
 */
export async function loadCatalog(onProgress = () => {}) {
  const cache = await openCache();
  const manifest = await fetchManifest(cache);
  if (manifest.schema !== 1) throw new Error(`unsupported manifest schema ${manifest.schema}`);
  const indexArtifact = manifest.resources.catalog.index;
  const index = await fetchArtifact(manifest, indexArtifact, INDEX_TYPE, cache, () => {});
  const parts = [...index.artifacts].sort((a, b) => a.index - b.index);
  const total = parts.reduce((sum, part) => sum + part.integrity.bytes, 0);
  let received = 0;
  const heads = [];
  for (const part of parts) {
    const data = await fetchArtifact(manifest, part, PART_TYPE, cache, (n) => { received += n; onProgress(received / total); });
    if (data.schema !== 1 || !Array.isArray(data.heads)) throw new Error(`unsupported catalogue part ${part.id}`);
    for (const head of data.heads) heads.push(head);
  }
  await prune(cache, new Set([indexArtifact, ...parts].flatMap((a) => manifest.mirrors.map((m) => new URL(a.path, m.url).href))));
  return {
    revision: manifest.revision,
    timestamp: manifest.timestamp,
    categories: index.categories,
    tags: index.tags,
    collections: index.collections,
    heads,
  };
}
