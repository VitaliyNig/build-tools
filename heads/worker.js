// Holds the catalogue off the UI thread: downloads it, indexes it and answers
// searches. Messages carry an `id` that the answer repeats.
import { loadCatalog } from "./catalog.js";
import { DICTIONARY } from "./dictionary.js";
import { buildIndex, layoutFix, parseDictionary, search, themeHeads } from "./search.js";
import { NAMES } from "./strings.js";
import { THEMES } from "./themes.js";

let catalog = null, index = null, dictionary = null;
// The head numbers of the last search, so that "show more" does not search again.
let last = { key: null, found: [] };
// Head numbers of each selection from themes.js, made once.
const themes = new Map();

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
    themes: THEMES.map((theme) => ({ id: theme.id, count: selection(theme.id).list.length })),
    tags: catalog.tags,
  });
}

/** A selection from themes.js: its heads in order, and as a set. */
function selection(id) {
  if (!themes.has(id)) {
    const theme = THEMES.find((t) => t.id === id);
    const list = theme ? themeHeads(index, theme) : [];
    themes.set(id, { list, set: new Set(list) });
  }
  return themes.get(id);
}

function find({ query, category, collection, theme, offset, limit }) {
  const key = JSON.stringify([query, category, collection, theme]);
  if (last.key !== key) {
    const chosen = theme ? selection(theme) : null;
    const filter = category || collection || chosen
      ? (n) => {
        const head = catalog.heads[n];
        return (!category || head.category === category) && (!collection || head.collections.includes(collection)) && (!chosen || chosen.set.has(n));
      }
      : null;
    // A selection without a query keeps its own order.
    let found = chosen && !query.trim() ? chosen.list.filter(filter) : search(index, dictionary, query, filter);
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

function get(ids) {
  return ids.map((id) => index.byId.get(id)).filter((n) => n !== undefined).map((n) => view(catalog.heads[n]));
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") await load(data.id);
    else if (data.type === "search") answer(data.id, find(data));
    else if (data.type === "get") answer(data.id, { items: get(data.ids) });
  } catch (error) {
    answer(data.id, { error: String((error && error.message) || error) });
  }
};
