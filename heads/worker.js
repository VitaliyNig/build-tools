// Holds the catalogue off the UI thread: downloads it, indexes it and answers
// searches. Messages carry an `id` that the answer repeats.
import { loadCatalog } from "./catalog.js";
import { DICTIONARY } from "./dictionary.js";
import { buildIndex, layoutFix, parseDictionary, search, themeHeads } from "./search.js";
import { NAMES } from "./strings.js";
import { THEMES } from "./themes.js";
import { normalizeTexture } from "./textures.js";

let catalog = null, index = null, dictionary = null;
// Texture hash → head number, to name heads found in the world.
let byTexture = null;
// The head numbers of the last search, so that "show more" does not search again.
let last = { key: null, found: [] };

const answer = (id, data) => self.postMessage({ id, ...data });

/** The record the page shows for a head. */
const view = (head) => ({ id: head.id, name: head.name, texture: head.texture, category: head.category, tags: head.tags, collections: head.collections });

async function load(id) {
  catalog = await loadCatalog((value) => answer(id, { progress: value }));
  const labels = {};
  for (const group of [catalog.tags, catalog.collections, catalog.categories]) for (const item of group) labels[item.id] = item.name;
  // Russian names of categories and collections are searched too.
  for (const [key, name] of Object.entries(NAMES)) if (labels[key]) labels[key] += ` ${name}`;
  dictionary = parseDictionary(DICTIONARY);
  index = buildIndex(catalog.heads, labels);
  byTexture = new Map();
  catalog.heads.forEach((head, n) => {
    const key = normalizeTexture(head.texture);
    if (!byTexture.has(key)) byTexture.set(key, n);
  });
  // How many heads each collection holds, for the filter list.
  const counts = {};
  for (const head of catalog.heads) for (const c of head.collections) counts[c] = (counts[c] || 0) + 1;
  answer(id, {
    done: true,
    revision: catalog.revision,
    timestamp: catalog.timestamp,
    total: catalog.heads.length,
    categories: catalog.categories,
    collections: catalog.collections.map((c) => ({ ...c, count: counts[c.id] || 0 })).filter((c) => c.count),
    // The city selections, as collections of head ids.
    themes: THEMES.map((theme) => ({ id: theme.id, heads: themeHeads(index, theme).map((n) => catalog.heads[n].id) })),
    tags: catalog.tags,
  });
}

function find({ query, category, collection, offset, limit }) {
  const key = JSON.stringify([query, category, collection]);
  if (last.key !== key) {
    const filter = category || collection
      ? (n) => {
        const head = catalog.heads[n];
        return (!category || head.category === category) && (!collection || head.collections.includes(collection));
      }
      : null;
    let found = search(index, dictionary, query, filter);
    let corrected = null;
    // Typed in the wrong keyboard layout: "cnek" for "стул".
    if (!found.length && query.trim()) {
      const fixed = layoutFix(query);
      const again = fixed ? search(index, dictionary, fixed, filter) : [];
      if (again.length) { found = again; corrected = fixed; }
    }
    last = { key, found, corrected };
  }
  return {
    total: last.found.length,
    corrected: last.corrected,
    items: last.found.slice(offset, offset + limit).map((n) => view(catalog.heads[n])),
  };
}

/** Catalogue heads with these textures, in order; and the textures that are not in the catalogue. */
function lookup(textures) {
  const items = [], missing = [];
  for (const texture of textures) {
    const n = byTexture.get(normalizeTexture(texture));
    if (n === undefined) missing.push(texture); else items.push(view(catalog.heads[n]));
  }
  return { items, missing };
}

function get(ids) {
  return ids.map((id) => index.byId.get(id)).filter((n) => n !== undefined).map((n) => view(catalog.heads[n]));
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") await load(data.id);
    else if (data.type === "search") answer(data.id, find(data));
    else if (data.type === "get") answer(data.id, { items: get(data.ids) });
    else if (data.type === "textures") answer(data.id, lookup(data.textures));
  } catch (error) {
    answer(data.id, { error: String((error && error.message) || error) });
  }
};
