// Heads: search the HeadDB catalogue in Russian or English, keep collections
// of heads and copy the commands that give them in the game.
import { bindLanguageSelect, getLang } from "../shared/i18n.js";
import { CHAT_LIMIT, command, FORMATS, textureValue } from "./commands.js";
import { drawHead, loadSkin } from "./render.js";
import { NAMES, STRINGS } from "./strings.js";
import { GROUPS, THEMES } from "./themes.js";
import { findInFile, findInText } from "./textures.js";

const COLLECTIONS_KEY = "heads.collections", TARGET_KEY = "heads.target", FORMAT_KEY = "heads.format";
const OPEN_GROUPS_KEY = "heads.openGroups";
// Cards shown at a time; "show more" adds as many again.
const PAGE = 60;
// Size of a head picture on a card, in CSS pixels.
const THUMB = 64;

const $ = (id) => document.getElementById(id);

const state = {
  lang: getLang(),
  status: null,
  meta: null,                  // the catalogue: revision, categories, collections, tags
  tagNames: new Map(),         // tag id → name
  query: "", results: [], total: 0, corrected: null,
  heads: new Map(),            // head id → record, for every head seen
  collections: loadCollections(),
  standards: [],               // from standards.json
  shared: null,                // a collection opened from a link
  found: null,                 // heads found by their textures: { name, heads, description, missing }
  selected: null,              // { kind: "mine" | "standard" | "city" | "shared", index }
  shown: 0, shownOf: "",       // cards of the selected collection on the page, and which collection that is
  detailsHead: null,
};

// ---------- i18n ----------
function t(key, ...args) {
  const value = STRINGS[key][state.lang === "ru" ? 1 : 0];
  return typeof value === "function" ? value(...args) : value;
}

/** Display name of a category or catalogue collection. */
function label(item) {
  return state.lang === "ru" && NAMES[item.id] ? NAMES[item.id] : item.name;
}

function setStatus(key, ...args) {
  state.status = key ? [key, ...args] : null;
  $("status").textContent = key ? t(key, ...args) : "";
  $("status").classList.toggle("error", Boolean(key?.startsWith("err")));
}

function retranslate() {
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
  document.title = `Heads — ${t("subtitle")}`;
  $("query").placeholder = t("placeholder");
  $("idText").placeholder = t("idPlaceholder");
  if (state.status) $("status").textContent = t(...state.status);
  fillFormats();
  fillFilters();
  fillTargets();
  renderSource();
  renderResults();
  renderCollections();
  if ($("details").open) renderDetails();
}

// ---------- the worker that holds the catalogue ----------
const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
const pending = new Map();
let nextId = 1;
worker.onmessage = ({ data }) => {
  const request = pending.get(data.id);
  if (!request) return;
  if (data.progress !== undefined && !data.done) { request.onProgress?.(data.progress); return; }
  pending.delete(data.id);
  if (data.error) request.reject(new Error(data.error)); else request.resolve(data);
};
function ask(message, onProgress) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ ...message, id });
  });
}

const remember = (items) => { for (const head of items) state.heads.set(head.id, head); return items; };

async function loadCatalog() {
  $("loading").hidden = false;
  $("retry").hidden = true;
  $("loadingBar").parentElement.hidden = false;
  const show = (p) => {
    $("loadingText").textContent = p < 1 ? t("loading", Math.round(p * 100)) : t("indexing");
    $("loadingBar").style.width = `${Math.round(p * 100)}%`;
  };
  show(0);
  try {
    state.meta = await ask({ type: "load" }, show);
    state.tagNames = new Map(state.meta.tags.map((tag) => [tag.id, tag.name]));
    $("loading").hidden = true;
    fillFilters();
    renderSource();
    await runSearch();
    renderCollections();
  } catch (error) {
    $("loadingText").textContent = t("errLoad", error.message);
    $("loadingBar").parentElement.hidden = true;
    $("retry").hidden = false;
  }
}

// ---------- options ----------
function fillSelect(select, options, value) {
  select.replaceChildren(...options.map(([v, text]) => new Option(text, v)));
  select.value = options.some(([v]) => v === value) ? value : options[0]?.[0] ?? "";
}

function fillFormats() {
  fillSelect($("format"), FORMATS.map((f) => [f, t(`format_${f}`)]), $("format").value || load(FORMAT_KEY) || "hdb");
}

function fillFilters() {
  const meta = state.meta;
  const byName = (a, b) => label(a).localeCompare(label(b), state.lang);
  fillSelect($("category"), [["", t("any")], ...(meta ? [...meta.categories].sort(byName).map((c) => [c.id, label(c)]) : [])], $("category").value);
  fillSelect($("collection"), [["", t("any")], ...(meta ? [...meta.collections].sort(byName).map((c) => [c.id, `${label(c)} (${c.count})`]) : [])], $("collection").value);
}

/** The collection the + buttons add to. */
function fillTargets() {
  const options = state.collections.map((c) => [c.id, c.name]);
  if (!options.length) options.push(["", t("defaultName")]);
  fillSelect($("target"), options, $("target").value || load(TARGET_KEY));
}

const format = () => $("format").value || "hdb";

// ---------- storage ----------
function load(key) {
  try { return localStorage.getItem(key); } catch { return null; } // storage unavailable
}
function store(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

function loadCollections() {
  try {
    const saved = JSON.parse(load(COLLECTIONS_KEY));
    if (Array.isArray(saved)) return saved.filter((c) => c && typeof c.name === "string" && Array.isArray(c.heads));
  } catch { /* damaged */ }
  return [];
}

function saveCollections() {
  store(COLLECTIONS_KEY, JSON.stringify(state.collections));
  $("collectionsCount").textContent = state.collections.length || "";
}

const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function createCollection(name, heads = [], description = "") {
  const collection = { id: newId(), name, heads: [...new Set(heads)], ...(description ? { description } : {}) };
  state.collections.push(collection);
  saveCollections();
  fillTargets();
  return collection;
}

/** The collection the + buttons add to, made on the first add if there is none. */
function target() {
  return state.collections.find((c) => c.id === $("target").value) || state.collections[0] || null;
}

function toggleInTarget(head) {
  let collection = target();
  if (!collection) {
    collection = createCollection(t("defaultName"));
    $("target").value = collection.id;
  }
  const at = collection.heads.indexOf(head.id);
  if (at < 0) collection.heads.push(head.id); else collection.heads.splice(at, 1);
  saveCollections();
  setStatus(at < 0 ? "statusAdded" : "statusRemoved", head.name, collection.name);
  refreshMarks();
  if (state.selected?.kind === "mine") renderCollection();
}

// ---------- clipboard ----------
/** Copy through a selection: the old way, which works where the clipboard API refuses. */
function copyBySelection(text) {
  const area = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
  area.style.cssText = "position: fixed; left: -1000px; top: 0;";
  document.body.append(area);
  area.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { /* not allowed */ }
  area.remove();
  return copied;
}

async function copy(text, statusKey, ...args) {
  let copied;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    // Refused while the window is only just getting focus, as on the first click after switching back from the game.
    copied = copyBySelection(text);
  }
  if (copied) setStatus(statusKey, ...args); else setStatus("errCopy");
  return copied;
}

// ---------- head pictures ----------
const pictures = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    pictures.unobserve(entry.target);
    paint(entry.target, entry.target.dataset.texture);
  }
}, { rootMargin: "300px" });

function paint(canvas, texture) {
  loadSkin(texture).then((image) => drawHead(canvas, image)).catch(() => canvas.classList.add("broken"));
}

function headCanvas(head, size) {
  const canvas = document.createElement("canvas");
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = canvas.height = Math.round(size * ratio);
  canvas.style.width = canvas.style.height = `${size}px`;
  canvas.dataset.texture = head.texture;
  pictures.observe(canvas);
  return canvas;
}

// ---------- cards ----------
/** A head's card; `caption` replaces its catalogue name, which then shows on hover. */
function card(head, caption = "") {
  const item = document.createElement("div");
  item.className = "card";
  item.dataset.id = head.id;
  const open = document.createElement("button");
  open.type = "button";
  open.className = "open";
  open.title = caption ? `${caption}\n${head.name}` : head.name;
  const name = Object.assign(document.createElement("span"), { className: "name", textContent: caption || head.name });
  const id = Object.assign(document.createElement("span"), { className: "id", textContent: `#${head.id}` });
  open.append(headCanvas(head, THUMB), name, id);
  open.addEventListener("click", () => openDetails(head));
  const copyButton = Object.assign(document.createElement("button"), { type: "button", className: "copy", textContent: t("copy"), title: t("copyCommand") });
  copyButton.addEventListener("click", () => copy(command(head, format()), "statusCopied", head.name));
  const add = Object.assign(document.createElement("button"), { type: "button", className: "add" });
  add.addEventListener("click", () => toggleInTarget(head));
  const actions = Object.assign(document.createElement("div"), { className: "actions" });
  actions.append(copyButton, add);
  item.append(open, actions);
  mark(item);
  return item;
}

/** Show on a card whether its head is in the collection the + adds to. */
function mark(item) {
  const on = Boolean(target()?.heads.includes(Number(item.dataset.id)));
  const add = item.querySelector(".add");
  add.textContent = on ? "✓" : "+";
  add.setAttribute("aria-pressed", on);
  add.title = t(on ? "removeHead" : "addHead");
  item.classList.toggle("chosen", on);
}

const refreshMarks = () => document.querySelectorAll(".card").forEach(mark);

// ---------- catalogue ----------
let searchSeq = 0, searchTimer = 0;

async function runSearch(append = false) {
  if (!state.meta) return;
  const seq = ++searchSeq;
  const offset = append ? state.results.length : 0;
  const answer = await ask({
    type: "search", query: $("query").value, category: $("category").value, collection: $("collection").value,
    offset, limit: PAGE,
  });
  if (seq !== searchSeq) return;
  remember(answer.items);
  state.results = append ? [...state.results, ...answer.items] : answer.items;
  state.total = answer.total;
  state.corrected = answer.corrected;
  renderResults(append ? offset : 0);
}

function renderResults(from = 0) {
  if (!state.meta) return;
  const grid = $("grid");
  if (!from) grid.replaceChildren();
  grid.append(...state.results.slice(from).map(card));
  const filtered = $("query").value.trim() || $("category").value || $("collection").value;
  $("info").textContent = [    state.corrected ? t("corrected", state.corrected) : "",
    state.total ? t(filtered ? "found" : "all", state.total) : t("nothing"),
  ].filter(Boolean).join(" ");
  const left = state.total - state.results.length;
  $("more").hidden = left <= 0;
  $("more").textContent = t("more", left);
}

// ---------- city selections ----------
/** The selections from themes.js as read-only collections, named in the page's language. */
function city() {
  const heads = new Map((state.meta?.themes || []).map((item) => [item.id, item.heads]));
  const lang = state.lang === "ru" ? 1 : 0;
  return THEMES.filter((theme) => heads.get(theme.id)?.length).map((theme) => ({
    name: theme.name[lang],
    short: theme.short?.[lang] || theme.name[lang],
    group: theme.group,
    heads: heads.get(theme.id),
    captions: theme.heads ? new Map(theme.heads) : null,
  }));
}

function renderSource() {
  if (!state.meta) return;
  const date = new Date(state.meta.timestamp).toLocaleDateString(state.lang);
  $("source").textContent = t("source", state.meta.revision, date);
}

// ---------- details ----------
function openDetails(head) {
  state.detailsHead = head;
  renderDetails();
  if (!$("details").open) $("details").showModal();
}

function chip(text, onClick) {
  const button = Object.assign(document.createElement("button"), { type: "button", className: "chip", textContent: text });
  button.addEventListener("click", (event) => { event.preventDefault(); $("details").close(); onClick(); });
  return button;
}

function commandRow(title, text, note) {
  const row = Object.assign(document.createElement("div"), { className: "command" });
  const caption = Object.assign(document.createElement("span"), { className: "label", textContent: title });
  const code = Object.assign(document.createElement("code"), { textContent: text });
  const button = Object.assign(document.createElement("button"), { type: "button", textContent: t("copy") });
  button.addEventListener("click", (event) => { event.preventDefault(); copy(text, "statusCopied", title); });
  row.append(caption, code, button);
  if (note) row.append(Object.assign(document.createElement("span"), { className: "note", textContent: note }));
  return row;
}

function renderDetails() {
  const head = state.detailsHead;
  const canvas = $("detailsCanvas");
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  paint(canvas, head.texture);
  $("detailsName").textContent = head.name;
  const category = state.meta.categories.find((c) => c.id === head.category);
  $("detailsMeta").textContent = `${t("idLabel")} ${head.id}${category ? ` · ${label(category)}` : ""}`;
  $("detailsTags").replaceChildren(...head.tags.map((tag) => chip(`#${state.tagNames.get(tag) || tag}`, () => {
    $("query").value = state.tagNames.get(tag) || tag;
    showTab("catalog");
    runSearch();
  })));
  $("detailsCollections").replaceChildren(...head.collections.map((id) => state.meta.collections.find((c) => c.id === id))
    .filter(Boolean).map((c) => chip(label(c), () => {
      $("collection").value = c.id;
      $("query").value = "";
      showTab("catalog");
      runSearch();
    })));
  $("detailsCommands").replaceChildren(...FORMATS.map((f) => {
    const text = command(head, f);
    const note = f === "hdb" ? t("hdbNote") : text.length > CHAT_LIMIT ? t("tooLong", text.length) : "";
    return commandRow(t(`format_${f}`), text, note);
  }));
  $("detailsTexture").replaceChildren(commandRow(t("textureHash"), head.texture), commandRow(t("textureValue"), textureValue(head.texture)));
  const mine = state.collections.map((collection) => {
    const box = Object.assign(document.createElement("input"), { type: "checkbox", checked: collection.heads.includes(head.id) });
    box.addEventListener("change", () => {
      if (box.checked) collection.heads.push(head.id);
      else collection.heads.splice(collection.heads.indexOf(head.id), 1);
      saveCollections();
      refreshMarks();
      if (state.selected?.kind === "mine") renderCollection();
    });
    const row = Object.assign(document.createElement("label"), { className: "check" });
    row.append(box, document.createTextNode(` ${collection.name}`));
    return row;
  });
  const create = Object.assign(document.createElement("button"), { type: "button", textContent: t("newCollection") });
  create.addEventListener("click", (event) => {
    event.preventDefault();
    const name = prompt(t("namePrompt"), t("defaultName"));
    if (!name?.trim()) return;
    createCollection(name.trim(), [head.id]);
    refreshMarks();
    renderCollections();
    renderDetails();
  });
  $("detailsMine").replaceChildren(...mine, create);
}

// ---------- collections ----------
function showTab(name) {
  const catalog = name === "catalog";
  $("tabCatalog").setAttribute("aria-selected", catalog);
  $("tabCollections").setAttribute("aria-selected", !catalog);
  $("catalogView").hidden = !catalog;
  $("collectionsView").hidden = catalog;
  if (!catalog) renderCollections();
}

/** The collection being shown: { name, heads, description }. */
function selected() {
  const s = state.selected;
  if (!s) return null;
  if (s.kind === "mine") return state.collections[s.index] || null;
  if (s.kind === "standard") return state.standards[s.index] || null;
  if (s.kind === "city") return city()[s.index] || null;
  if (s.kind === "found") return state.found;
  return state.shared;
}

function listButton(collection, kind, index, label = collection.name) {
  const button = Object.assign(document.createElement("button"), { type: "button", className: "item", title: collection.name });
  button.append(Object.assign(document.createElement("span"), { textContent: label }),
    Object.assign(document.createElement("span"), { className: "count", textContent: collection.heads.length }));
  button.setAttribute("aria-pressed", state.selected?.kind === kind && state.selected.index === index);
  button.addEventListener("click", () => {
    state.selected = { kind, index };
    renderCollections();
    // On a phone the collection is under the lists.
    if (matchMedia("(max-width: 720px)").matches) document.querySelector(".collection").scrollIntoView({ behavior: "smooth" });
  });
  return button;
}

/** Which groups of city selections are open, kept between visits. */
function loadOpenGroups() {
  try {
    const saved = JSON.parse(load(OPEN_GROUPS_KEY));
    if (Array.isArray(saved)) return new Set(saved);
  } catch { /* damaged */ }
  return new Set([GROUPS[0].id]); // on a first visit, the first group is open
}
const openGroups = loadOpenGroups();

/** The city selections in collapsible groups, folded or open as they were left. */
function renderCityGroups() {
  const all = city();
  $("cityList").replaceChildren(...GROUPS.map((group) => {
    const members = all.map((c, i) => [c, i]).filter(([c]) => c.group === group.id);
    if (!members.length) return null;
    const box = Object.assign(document.createElement("details"), { className: "group", open: openGroups.has(group.id) });
    const summary = document.createElement("summary");
    summary.append(Object.assign(document.createElement("span"), { textContent: group.name[state.lang === "ru" ? 1 : 0] }),
      Object.assign(document.createElement("span"), { className: "count", textContent: members.length }));
    const list = Object.assign(document.createElement("div"), { className: "list" });
    list.append(...members.map(([c, i]) => listButton(c, "city", i, c.short)));
    box.append(summary, list);
    box.addEventListener("toggle", () => {
      if (box.open) openGroups.add(group.id); else openGroups.delete(group.id);
      store(OPEN_GROUPS_KEY, JSON.stringify([...openGroups]));
    });
    return box;
  }).filter(Boolean));
}

function renderCollections() {
  $("collectionsCount").textContent = state.collections.length || "";
  if (!selected()) {
    state.selected = state.standards.length ? { kind: "standard", index: 0 }
      : state.collections.length ? { kind: "mine", index: 0 } : city().length ? { kind: "city", index: 0 } : null;
  }
  $("cityBox").hidden = !city().length;
  renderCityGroups();
  $("standardsBox").hidden = !state.standards.length;
  $("standardsList").replaceChildren(...state.standards.map((c, i) => listButton(c, "standard", i)));
  $("foundBox").hidden = !state.found;
  $("foundList").replaceChildren(...(state.found ? [listButton(state.found, "found", 0)] : []));
  $("sharedBox").hidden = !state.shared;
  $("sharedList").replaceChildren(...(state.shared ? [listButton(state.shared, "shared", 0)] : []));
  $("exportAll").hidden = !state.collections.length;
  $("mineList").replaceChildren(...(state.collections.length
    ? state.collections.map((c, i) => listButton(c, "mine", i))
    : [Object.assign(document.createElement("p"), { className: "hint", textContent: t("noCollections") })]));
  if (!$("collectionsView").hidden) renderCollection();
}

function action(key, run) {
  const button = Object.assign(document.createElement("button"), { type: "button", textContent: t(key) });
  button.addEventListener("click", run);
  return button;
}

let collectionSeq = 0;

async function renderCollection() {
  const collection = selected();
  $("collectionHeader").hidden = !collection;
  $("collectionEmpty").hidden = Boolean(collection?.heads.length);
  if (!collection) {
    $("collectionEmpty").textContent = t("pickCollection");
    $("collectionGrid").replaceChildren();
    return;
  }
  const kind = state.selected.kind;
  $("collectionName").textContent = collection.name;
  $("collectionCount").textContent = t("heads", collection.heads.length);
  const note = [collection.description || "", kind === "mine" ? t("standardsFormat") : ""].filter(Boolean).join(" ");
  $("collectionNote").textContent = note;
  $("collectionNote").hidden = !note;
  $("collectionEmpty").textContent = t("emptyCollection");
  const actions = [
    action("copyAll", () => copyAll(collection)),
    action("share", () => copy(shareLink(collection), "statusLink")),
    action("exportFile", () => exportCollection(collection)),
  ];
  if (kind === "mine") {
    actions.push(action("rename", () => {
      const name = prompt(t("namePrompt"), collection.name);
      if (!name?.trim()) return;
      collection.name = name.trim();
      saveCollections();
      fillTargets();
      renderCollections();
    }), action("remove", () => {
      if (!confirm(t("confirmRemove", collection.name))) return;
      state.collections.splice(state.selected.index, 1);
      state.selected = null;
      saveCollections();
      fillTargets();
      refreshMarks();
      renderCollections();
    }));
  } else {
    if (kind === "found" && collection.missing.length) actions.push(action("copyMissing", () => copyMissing(collection)));
    actions.unshift(action("saveCopy", () => {
      createCollection(collection.name, collection.heads, collection.description);
      state.selected = { kind: "mine", index: state.collections.length - 1 };
      refreshMarks();
      renderCollections();
    }));
  }
  $("collectionActions").replaceChildren(...actions);
  const seq = ++collectionSeq;
  const heads = await headsOf(collection.heads);
  if (seq !== collectionSeq) return;
  const missing = collection.heads.length - heads.length;
  // Big selections are shown a page at a time, as the catalogue is.
  const which = `${kind}:${state.selected.index}`;
  if (state.shownOf !== which) { state.shownOf = which; state.shown = 0; }
  state.shown = Math.min(heads.length, Math.max(state.shown, PAGE * 2));
  const grid = heads.slice(0, state.shown).map((head) => card(head, collection.captions?.get(head.id)));
  if (missing > 0 && state.meta) grid.push(Object.assign(document.createElement("p"), { className: "hint missing", textContent: t("missing", missing) }));
  $("collectionGrid").replaceChildren(...grid);
  const left = heads.length - state.shown;
  $("collectionMore").hidden = left <= 0;
  $("collectionMore").textContent = t("more", left);
}

/** The records of these heads, in this order; heads the catalogue lacks are left out. */
async function headsOf(ids) {
  if (!state.meta) return [];
  const unknown = ids.filter((id) => !state.heads.has(id));
  if (unknown.length) remember((await ask({ type: "get", ids: unknown })).items);
  return ids.map((id) => state.heads.get(id)).filter(Boolean);
}

async function copyAll(collection) {
  const heads = await headsOf(collection.heads);
  await copy(heads.map((head) => command(head, format())).join("\n"), "statusCopiedAll", heads.length);
}

// ---------- heads from the game ----------
/** Show the catalogue heads with these textures (and these HeadDB ids) as a collection. */
async function showFound({ textures, ids }, name) {
  if (!textures.length && !ids.length) { setStatus("errFound"); return; }
  if (!state.meta) return;
  const answer = await ask({ type: "textures", textures });
  remember(answer.items);
  const heads = [...new Set([...ids, ...answer.items.map((head) => head.id)])];
  state.found = {
    name: name || t("foundName"),
    heads,
    missing: answer.missing,
    get description() { return t("foundNote", heads.length, this.missing.length); },
  };
  state.selected = { kind: "found", index: 0 };
  setStatus("statusFound", heads.length, answer.missing.length);
  showTab("collections");
  renderCollections();
  document.querySelector(".collection").scrollIntoView();
}

/** Vanilla /give for textures the catalogue lacks: /hdb give cannot give them. */
async function copyMissing(found) {
  const version = format() === "hdb" ? "1.20.5" : format();
  const commands = found.missing.map((texture) => command({ id: 0, texture }, version));
  await copy(commands.join("\n"), "statusCopiedAll", commands.length);
}

async function findFromFile(file) {
  try {
    await showFound(await findInFile(file), file.name.replace(/\.[^.]+$/, ""));
  } catch (error) {
    setStatus("errFile", error.message);
  }
}

// A collection in a link: #c=<name>~<ids in base 36, joined by dots>.
function shareLink(collection) {
  const url = new URL(location.href);
  url.hash = `c=${encodeURIComponent(collection.name)}~${collection.heads.map((id) => id.toString(36)).join(".")}`;
  return url.href;
}

/** Every collection link in a text: [{ name, heads }]. */
function parseLinks(text) {
  return [...text.matchAll(/#c=([^~\s]*)~([0-9a-z.]*)/g)].map(([, encoded, ids]) => {
    let name;
    try { name = decodeURIComponent(encoded); } catch { name = encoded; }
    const heads = [...new Set(ids.split(".").filter(Boolean).map((id) => parseInt(id, 36)).filter(Number.isFinite))];
    return { name: name || t("shared"), description: "", heads };
  }).filter((c) => c.heads.length);
}

/** Open a collection link of the address bar, if there is one. */
function openLink() {
  const [shared] = parseLinks(location.hash);
  if (!shared) return;
  state.shared = shared;
  state.selected = { kind: "shared", index: 0 };
  showTab("collections");
  renderCollections();
  document.querySelector(".collection").scrollIntoView();
}

/** A collection as it is written to a file: heads with their names, for people reading it. */
async function collectionData(collection) {
  await headsOf(collection.heads);
  return {
    name: collection.name,
    ...(collection.description ? { description: collection.description } : {}),
    heads: collection.heads.map((id) => {
      const name = collection.captions?.get(id) || state.heads.get(id)?.name;
      return name ? { id, name } : { id };
    }),
  };
}

function download(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
  const link = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `${name.replace(/[\\/:*?"<>|]+/g, "_") || "heads"}.json`,
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function exportCollection(collection) {
  download(await collectionData(collection), collection.name);
}

/** All one's collections in one file, in the format of standards.json. */
async function exportAll() {
  if (!state.collections.length) return;
  const collections = [];
  for (const collection of state.collections) collections.push(await collectionData(collection));
  download({ collections }, `heads-collections-${new Date().toISOString().slice(0, 10)}`);
  setStatus("statusExported", collections.length);
}

/**
 * Collections from JSON: one collection {name, heads}, a list of them, or
 * {collections: [...]} as in standards.json. A head is an id or {id, ...}.
 */
function parseCollections(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.collections) ? data.collections : [data];
  return list.filter((c) => c && Array.isArray(c.heads)).map((c) => ({
    name: String(c.name || t("defaultName")),
    description: typeof c.description === "string" ? c.description : "",
    heads: [...new Set(c.heads.map((h) => Number(typeof h === "object" && h ? h.id : h)).filter(Number.isInteger))],
  }));
}

const sameHeads = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * Add collections to one's own. One that is already there, with the same
 * name and heads, is skipped, so importing a file twice changes nothing; a
 * different one with a taken name gets a number: "Street (2)".
 */
function addCollections(collections) {
  let added = 0, same = 0;
  for (const c of collections) {
    if (state.collections.some((mine) => mine.name === c.name && sameHeads(mine.heads, c.heads))) { same++; continue; }
    let name = c.name;
    for (let n = 2; state.collections.some((mine) => mine.name === name); n++) name = `${c.name} (${n})`;
    createCollection(name, c.heads, c.description);
    added++;
  }
  if (added) state.selected = { kind: "mine", index: state.collections.length - 1 };
  setStatus("statusImported", added, same);
  refreshMarks();
  showTab("collections");
  renderCollections();
}

async function importFiles(files) {
  const collections = [];
  for (const file of files) {
    try { collections.push(...parseCollections(JSON.parse(await file.text()))); } catch { /* not JSON */ }
  }
  if (collections.length) addCollections(collections); else setStatus("errImport");
}

/** Collections from pasted text: links, or the text of a .json file. */
function importText(text) {
  let collections = parseLinks(text);
  if (!collections.length) {
    try { collections = parseCollections(JSON.parse(text)); } catch { /* not JSON */ }
  }
  if (collections.length) addCollections(collections); else setStatus("errPaste");
}

async function loadStandards() {
  try {
    const response = await fetch("standards.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.standards = parseCollections(await response.json());
    renderCollections();
  } catch (error) {
    setStatus("errStandards", error.message);
  }
}

// ---------- start ----------
$("query").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 150);
});
$("query").addEventListener("keydown", (event) => {
  if (event.key === "Enter") { clearTimeout(searchTimer); showTab("catalog"); runSearch(); }
});
$("query").addEventListener("focus", () => showTab("catalog"));
for (const id of ["category", "collection"]) $(id).addEventListener("change", () => { showTab("catalog"); runSearch(); });
$("format").addEventListener("change", () => store(FORMAT_KEY, format()));
$("target").addEventListener("change", () => { store(TARGET_KEY, $("target").value); refreshMarks(); });
$("more").addEventListener("click", () => runSearch(true));
$("collectionMore").addEventListener("click", () => { state.shown += PAGE * 2; renderCollection(); });
$("retry").addEventListener("click", loadCatalog);
$("tabCatalog").addEventListener("click", () => showTab("catalog"));
$("tabCollections").addEventListener("click", () => showTab("collections"));
$("newCollection").addEventListener("click", () => {
  const name = prompt(t("namePrompt"), t("defaultName"));
  if (!name?.trim()) return;
  const collection = createCollection(name.trim());
  $("target").value = collection.id;
  store(TARGET_KEY, collection.id);
  state.selected = { kind: "mine", index: state.collections.length - 1 };
  refreshMarks();
  renderCollections();
});
$("importButton").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", () => {
  const files = [...$("importFile").files];
  $("importFile").value = "";
  if (files.length) importFiles(files);
});
$("exportAll").addEventListener("click", exportAll);
$("idButton").addEventListener("click", () => $("idDialog").showModal());
$("idDialog").addEventListener("close", () => {
  if ($("idDialog").returnValue === "find" && $("idText").value.trim()) showFound(findInText($("idText").value));
});
$("idFileButton").addEventListener("click", () => $("idFile").click());
$("idFile").addEventListener("change", () => {
  const file = $("idFile").files[0];
  $("idFile").value = "";
  if (!file) return;
  $("idDialog").close();
  findFromFile(file);
});
$("pasteButton").addEventListener("click", () => {
  $("pasteText").value = "";
  $("pasteDialog").showModal();
});
$("pasteDialog").addEventListener("close", () => {
  if ($("pasteDialog").returnValue === "add" && $("pasteText").value.trim()) importText($("pasteText").value);
});
// .json files dropped anywhere on the page are imported.
let dragDepth = 0;
const carriesFiles = (event) => [...(event.dataTransfer?.types || [])].includes("Files");
document.addEventListener("dragenter", (event) => { if (carriesFiles(event)) { dragDepth++; $("drop").hidden = false; } });
document.addEventListener("dragleave", (event) => { if (carriesFiles(event) && --dragDepth <= 0) { dragDepth = 0; $("drop").hidden = true; } });
document.addEventListener("dragover", (event) => { if (carriesFiles(event)) event.preventDefault(); });
document.addEventListener("drop", (event) => {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  dragDepth = 0;
  $("drop").hidden = true;
  const all = [...event.dataTransfer.files];
  const structure = all.find((file) => /\.(schem|schematic|litematic|nbt|bp)$/i.test(file.name));
  if (structure) { findFromFile(structure); return; }
  const files = all.filter((file) => /\.json$/i.test(file.name) || file.type === "application/json");
  if (files.length) importFiles(files); else setStatus("errImport");
});
// A collection link opened while the page is open.
window.addEventListener("hashchange", openLink);
// "/" jumps to the search box.
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !$("details").open) {
    event.preventDefault();
    $("query").focus();
  }
});

bindLanguageSelect($("lang"), (lang) => { state.lang = lang; retranslate(); });
retranslate();
saveCollections();
openLink();
loadStandards();
loadCatalog();
