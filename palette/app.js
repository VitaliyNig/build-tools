// Palette: find blocks by colour, build gradients, collect and share a palette.
import { bindLanguageSelect, getLang } from "../shared/i18n.js";
import { importJarFile, listPalettes, loadPalette, tileCanvas } from "../shared/mc/palettes.js";
import { fromHex, gradientEntries, labOf, listEntries, rank, toHex } from "./core.js";
import { STRINGS } from "./strings.js";

const BLOCK_RESULTS = 24, DECO_RESULTS = 12, SEARCH_RESULTS = 60;
const MAX_STOPS = 6;
const STORE_CURRENT = "tools.palette.current", STORE_SAVED = "tools.palette.saved";

const $ = (id) => document.getElementById(id);

const state = {
  lang: getLang(),
  palette: null,
  entries: [],            // every block and decoration of the palette
  byId: new Map(),
  colour: [127, 178, 56],
  stops: [[43, 76, 155], [242, 210, 75]],
  mine: [],               // ids in the user's palette, in order
  status: ["statusLoading"],
  statusError: false,
};

// ---------- i18n ----------
function t(key, ...args) {
  const value = STRINGS[key][state.lang === "ru" ? 1 : 0];
  return typeof value === "function" ? value(...args) : value;
}

function setStatus(key, ...args) {
  state.status = [key, ...args];
  state.statusError = key.startsWith("err");
  renderStatus();
}

function renderStatus() {
  $("status").textContent = t(...state.status);
  $("status").classList.toggle("error", state.statusError);
}

function retranslate() {
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
  document.title = `Palette — ${t("subtitle")}`;
  $("search").placeholder = t("search");
  $("paletteName").placeholder = t("paletteName");
  for (const el of document.querySelectorAll(".tiles")) el.dataset.empty = t("nothing");
  renderStatus();
  renderPaletteOptions();
  renderAll();
}

// ---------- storage ----------
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

// ---------- tiles ----------
function tile(entry, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tile";
  button.title = entry.name;
  button.classList.toggle("chosen", state.mine.includes(entry.id));
  button.append(tileCanvas(state.palette, entry.kind, entry.index));
  button.addEventListener("click", () => onClick(entry));
  return button;
}

function pool() {
  const noFalling = $("noFalling").checked, noTechnical = $("noTechnical").checked;
  return state.entries.filter((entry) => !(noFalling && entry.falling) && !(noTechnical && entry.technical));
}

const smooth = () => ($("smooth").checked ? 1 : 0);

// ---------- match by colour ----------
function setColour(rgb) {
  state.colour = rgb;
  $("colour").value = $("hex").value = toHex(rgb);
  renderMatch();
}

function renderMatch() {
  if (!state.palette) return;
  const query = $("search").value.trim().toLowerCase(), lab = labOf(state.colour);
  const found = pool().filter((entry) => !query || `${entry.name} ${entry.id}`.toLowerCase().includes(query));
  const list = (kind, limit) => rank(found.filter((entry) => entry.kind === kind), lab, smooth())
    .slice(0, query ? SEARCH_RESULTS : limit).map((entry) => tile(entry, toggleMine));
  $("blockResults").replaceChildren(...list("block", BLOCK_RESULTS));
  $("decoResults").replaceChildren(...list("deco", DECO_RESULTS));
}

// ---------- gradient ----------
function renderStops() {
  $("stops").replaceChildren(...state.stops.map((rgb, i) => {
    const wrap = document.createElement("span");
    wrap.className = "stop";
    const input = Object.assign(document.createElement("input"), { type: "color", value: toHex(rgb) });
    input.addEventListener("input", () => { state.stops[i] = fromHex(input.value); renderGradient(); });
    wrap.append(input);
    if (state.stops.length > 2) {
      const remove = Object.assign(document.createElement("button"), { type: "button", textContent: "×" });
      remove.addEventListener("click", () => { state.stops.splice(i, 1); renderStops(); renderGradient(); });
      wrap.append(remove);
    }
    return wrap;
  }));
  $("addStop").disabled = state.stops.length >= MAX_STOPS;
}

function gradient() {
  const steps = Math.min(64, Math.max(2, Math.round($("steps").valueAsNumber) || 2));
  const usable = pool().filter((entry) => $("withDeco").checked || entry.kind === "block");
  return gradientEntries(usable, state.stops, steps, { unique: $("unique").checked, smooth: smooth() });
}

function renderGradient() {
  if (!state.palette) return;
  const result = gradient();
  $("gradientColours").replaceChildren(...result.map(({ rgb }) => {
    const cell = document.createElement("span");
    cell.style.background = toHex(rgb);
    return cell;
  }));
  $("gradientResults").replaceChildren(...result.map(({ entry }) => tile(entry, toggleMine)));
}

// ---------- my palette ----------
function toggleMine(entry) {
  const at = state.mine.indexOf(entry.id);
  if (at < 0) state.mine.push(entry.id); else state.mine.splice(at, 1);
  setStatus(at < 0 ? "statusAdded" : "statusRemoved", entry.name);
  mineChanged();
}

function mineChanged() {
  write(STORE_CURRENT, { version: state.palette && state.palette.version, ids: state.mine });
  renderAll();
}

function renderMine() {
  const items = state.mine.map((id) => {
    const entry = state.byId.get(id);
    let node;
    if (entry) {
      // Clicking a collected block looks for similar ones.
      node = tile(entry, () => { showTab("match"); $("search").value = ""; setColour(entry.rgb); });
      node.classList.remove("chosen");
    } else {
      node = Object.assign(document.createElement("div"), { className: "tile missing", title: t("missing", id) });
    }
    const remove = Object.assign(document.createElement("span"), { className: "remove", textContent: "×" });
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      state.mine = state.mine.filter((other) => other !== id);
      mineChanged();
    });
    node.append(remove);
    return node;
  });
  $("mine").replaceChildren(...items);
  $("mine").dataset.empty = "";
  $("mineHint").hidden = state.mine.length > 0;
  $("mineNames").replaceChildren(...state.mine.map((id) => {
    const entry = state.byId.get(id);
    return Object.assign(document.createElement("li"), { textContent: entry ? entry.name : t("missing", id) });
  }));
  for (const id of ["save", "share", "copyNames", "clear", "stopsFromPalette"]) $(id).disabled = !state.mine.length;
}

function shareLink() {
  const hash = `v=${encodeURIComponent(state.palette.version)}&b=${state.mine.map(encodeURIComponent).join(",")}`;
  return `${location.origin}${location.pathname}#${hash}`;
}

async function copy(text, statusKey) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  setStatus(statusKey);
}

// ---------- saved palettes ----------
function renderSaved() {
  const saved = read(STORE_SAVED, []);
  $("savedList").replaceChildren(...saved.map((item, i) => {
    const row = document.createElement("li");
    const open = Object.assign(document.createElement("button"), { type: "button", className: "name", textContent: item.name, title: item.version });
    open.addEventListener("click", () => openPalette(item.version, item.ids));
    const swatches = Object.assign(document.createElement("span"), { className: "swatches" });
    for (const colour of item.colours || []) swatches.appendChild(document.createElement("i")).style.background = colour;
    const remove = Object.assign(document.createElement("button"), { type: "button", textContent: "×" });
    remove.addEventListener("click", () => {
      write(STORE_SAVED, read(STORE_SAVED, []).filter((_, other) => other !== i));
      renderSaved();
    });
    row.append(open, swatches, remove);
    return row;
  }));
}

function savePalette() {
  const name = $("paletteName").value.trim() || t("untitled");
  const colours = state.mine.map((id) => state.byId.get(id)).filter(Boolean).map((entry) => toHex(entry.rgb));
  const saved = read(STORE_SAVED, []).filter((item) => item.name !== name);
  saved.unshift({ name, version: state.palette.version, ids: [...state.mine], colours });
  write(STORE_SAVED, saved);
  renderSaved();
  setStatus("statusSaved", name);
}

/** Switch to the palette's Minecraft version when it is available, then show its blocks. */
async function openPalette(version, ids) {
  const entry = paletteEntries.find((candidate) => candidate.version === version);
  if (entry && (!state.palette || state.palette.key !== entry.key)) await selectPalette(entry.key);
  state.mine = [...ids];
  mineChanged();
}

// ---------- palette versions ----------
let paletteEntries = [];

function renderPaletteOptions() {
  $("paletteVersion").replaceChildren(...paletteEntries.map((entry) =>
    new Option(entry.imported ? `${entry.version} (${t("imported")})` : entry.version, entry.key)));
  if (state.palette) $("paletteVersion").value = state.palette.key;
}

async function selectPalette(key) {
  try {
    state.palette = await loadPalette(key);
  } catch (error) {
    setStatus("errPalette", error.message);
    if (state.palette) $("paletteVersion").value = state.palette.key;
    return false;
  }
  state.entries = listEntries(state.palette);
  state.byId = new Map(state.entries.map((entry) => [entry.id, entry]));
  $("paletteVersion").value = key;
  setStatus("statusReady", state.palette.version, state.palette.blocks.length, state.palette.decorations.length);
  renderAll();
  return true;
}

async function addJar(file) {
  $("addJar").disabled = true;
  try {
    const { key } = await importJarFile(file, (value) => setStatus("statusJar", `${Math.round(value * 100)} %`));
    paletteEntries = (await listPalettes()).entries;
    renderPaletteOptions();
    await selectPalette(key);
  } catch (error) {
    if (error.message === "no-blocks") setStatus("errJarNoBlocks");
    else setStatus("errJar", error.message);
  } finally {
    $("addJar").disabled = false;
  }
}

// ---------- wiring ----------
function showTab(name) {
  for (const tab of ["Match", "Gradient"]) {
    const active = tab.toLowerCase() === name;
    $(`tab${tab}`).setAttribute("aria-selected", active);
    $(`${tab.toLowerCase()}Pane`).hidden = !active;
  }
}

function renderAll() {
  renderMatch();
  renderStops();
  renderGradient();
  renderMine();
  renderSaved();
}

function wire() {
  $("tabMatch").addEventListener("click", () => showTab("match"));
  $("tabGradient").addEventListener("click", () => showTab("gradient"));

  $("colour").addEventListener("input", () => setColour(fromHex($("colour").value)));
  $("hex").addEventListener("change", () => setColour(fromHex($("hex").value) || state.colour));
  $("search").addEventListener("input", renderMatch);
  for (const id of ["noFalling", "noTechnical", "smooth"]) {
    $(id).addEventListener("change", () => { renderMatch(); renderGradient(); });
  }

  for (const id of ["steps", "unique", "withDeco"]) $(id).addEventListener("change", renderGradient);
  $("steps").addEventListener("input", renderGradient);
  $("addStop").addEventListener("click", () => {
    state.stops.push([...state.stops.at(-1)]);
    renderStops();
    renderGradient();
  });
  $("stopsFromPalette").addEventListener("click", () => {
    const colours = state.mine.map((id) => state.byId.get(id)).filter(Boolean).map((entry) => entry.rgb);
    if (colours.length < 2) return;
    state.stops = colours.slice(0, MAX_STOPS);
    showTab("gradient");
    renderStops();
    renderGradient();
  });
  $("addGradient").addEventListener("click", () => {
    for (const { entry } of gradient()) if (!state.mine.includes(entry.id)) state.mine.push(entry.id);
    mineChanged();
  });

  $("save").addEventListener("click", savePalette);
  $("share").addEventListener("click", () => copy(shareLink(), "statusLink"));
  $("copyNames").addEventListener("click", () => copy(
    state.mine.map((id) => (state.byId.get(id) || { name: id }).name).join("\n"), "statusNames"));
  $("clear").addEventListener("click", () => { state.mine = []; mineChanged(); });

  $("paletteVersion").addEventListener("change", (e) => selectPalette(e.target.value));
  $("addJar").addEventListener("click", () => $("jarFile").click());
  $("jarFile").addEventListener("change", (e) => {
    if (e.target.files[0]) addJar(e.target.files[0]);
    e.target.value = "";
  });
}

/** A palette passed in the address: #v=<version>&b=<id>,<id>,... */
function sharedPalette() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.get("b")) return null;
  return { version: params.get("v"), ids: params.get("b").split(",").map(decodeURIComponent).filter(Boolean) };
}

async function start() {
  wire();
  bindLanguageSelect($("lang"), (lang) => { state.lang = lang; retranslate(); });
  retranslate();
  try {
    const { entries, defaultKey } = await listPalettes();
    paletteEntries = entries;
    renderPaletteOptions();
    const shared = sharedPalette(), current = shared || read(STORE_CURRENT, null);
    const wanted = current && entries.find((entry) => entry.version === current.version);
    await selectPalette((wanted || entries.find((entry) => entry.key === defaultKey) || entries[0]).key);
    if (current && Array.isArray(current.ids)) {
      state.mine = current.ids.filter((id) => typeof id === "string");
      mineChanged();
    }
    if (shared) setStatus("statusShared", state.mine.length);
  } catch (error) {
    setStatus("errPalette", error.message);
  }
  // A shared link opened while the page is already showing.
  window.addEventListener("hashchange", async () => {
    const shared = sharedPalette();
    if (!shared) return;
    await openPalette(shared.version, shared.ids);
    setStatus("statusShared", state.mine.length);
  });
}

start();
