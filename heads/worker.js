// Holds the catalogue off the UI thread: downloads it, indexes it and answers
// searches. Messages carry an `id` that the answer repeats.
import { loadCatalog } from "./catalog.js";
import { DICTIONARY } from "./dictionary.js";
import { buildIndex, fontHeads, layoutFix, parseDictionary, search, themeHeads } from "./search.js";
import { NAMES } from "./strings.js";
import { THEMES } from "./themes.js";
import { normalizeTexture } from "./textures.js";
import { colourDistance, decodeColours, labOf, prepare, textureCheck } from "./colors.js";

let catalog = null, index = null, dictionary = null;
// Texture hash → head number, to name heads found in the world.
let byTexture = null;
// Colours of each head, by head number: as stored ([{rgb, weight}]) and ready for matching; null where unknown.
let colours = [], prepared = [];
// The head numbers of the last search, so that "show more" does not search again.
let last = { key: null, found: [] };

const answer = (id, data) => self.postMessage({ id, ...data });

/** The record the page shows for a head. */
const view = (head, n) => ({
  id: head.id, name: head.name, texture: head.texture, category: head.category, tags: head.tags, collections: head.collections,
  colours: colours[n] || null,
});

/**
 * The colours of the heads from colors.bin, kept for heads whose texture is
 * the one they were taken from. Without the file the colour search is off.
 */
async function loadColours() {
  try {
    const response = await fetch(new URL("./colors.bin", import.meta.url));
    if (!response.ok) return null;
    return decodeColours(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

async function load(id) {
  const colourFile = loadColours();
  catalog = await loadCatalog((value) => answer(id, { progress: value }));
  const byId = new Map((await colourFile)?.records.map((record) => [record.id, record]) || []);
  colours = catalog.heads.map((head) => {
    const record = byId.get(head.id);
    return record && record.check === textureCheck(normalizeTexture(head.texture)) && record.colours.length ? record.colours : null;
  });
  prepared = colours.map(prepare);
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
  // And each tag, for the tag filter: tags no head has are left out.
  const tagCounts = {};
  for (const head of catalog.heads) for (const tag of head.tags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  answer(id, {
    done: true,
    revision: catalog.revision,
    timestamp: catalog.timestamp,
    total: catalog.heads.length,
    coloured: colours.filter(Boolean).length,
    categories: catalog.categories,
    collections: catalog.collections.map((c) => ({ ...c, count: counts[c.id] || 0 })).filter((c) => c.count),
    // The city selections, as collections of head ids; letter fonts also caption each head with its character.
    themes: THEMES.map((theme) => {
      if (!theme.font) return { id: theme.id, heads: themeHeads(index, theme).map((n) => catalog.heads[n].id) };
      const items = fontHeads(index, theme);
      return { id: theme.id, heads: items.map(([n]) => catalog.heads[n].id), captions: items.map(([, caption]) => caption) };
    }),
    tags: catalog.tags.map((tag) => ({ ...tag, count: tagCounts[tag.id] || 0 })),
  });
}

function find({ query, category, collection, tags = [], match = "all", colour = null, colourMode = "has", spread = 25, offset, limit }) {
  const key = JSON.stringify([query, category, collection, tags, match, colour, colourMode, spread]);
  if (last.key !== key) {
    // Tags: a head needs all of them, or any one with match "any".
    const tagged = match === "any" ? (head) => tags.some((tag) => head.tags.includes(tag)) : (head) => tags.every((tag) => head.tags.includes(tag));
    const filter = category || collection || tags.length
      ? (n) => {
        const head = catalog.heads[n];
        return (!category || head.category === category) && (!collection || head.collections.includes(collection))
          && (!tags.length || tagged(head));
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
    // A colour keeps the heads within `spread` of it (ΔE), the closest first.
    if (colour) {
      const lab = labOf(colour);
      found = found.filter((n) => prepared[n]).map((n) => [n, colourDistance(prepared[n], lab, colourMode)])
        .filter(([, d]) => d <= spread).sort((a, b) => a[1] - b[1]).map(([n]) => n);
    }
    last = { key, found, corrected };
  }
  return {
    total: last.found.length,
    corrected: last.corrected,
    items: last.found.slice(offset, offset + limit).map((n) => view(catalog.heads[n], n)),
  };
}

/** Catalogue heads with these textures, in order; and the textures that are not in the catalogue. */
function lookup(textures) {
  const items = [], missing = [];
  for (const texture of textures) {
    const n = byTexture.get(normalizeTexture(texture));
    if (n === undefined) missing.push(texture); else items.push(view(catalog.heads[n], n));
  }
  return { items, missing };
}

function get(ids) {
  return ids.map((id) => index.byId.get(id)).filter((n) => n !== undefined).map((n) => view(catalog.heads[n], n));
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
