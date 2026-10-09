// Image2Banners: controls, preview, banner recipes, export.
import "../shared/tooltip.js";
import { bindLanguageSelect, getLang } from "../shared/i18n.js";
import { PanZoom } from "../shared/panzoom.js";
import { loadAssets } from "./assets.js";
import { BANNER_H, BANNER_W, CELL, DEFAULT_BLOCK, patternTile } from "./core/generate.js";
import { applyCell, bannerSteps, cellAt, createModel, fromJson, giveCommand, renderModel, toJson } from "./core/model.js";
import { buildStructure } from "./core/nbt.js";
import { DYE_NAMES, PATTERN_ITEMS, PATTERN_NAMES, STRINGS } from "./strings.js";

const MAX_SIZE = 128;   // blocks per side
const SLOT_H = CELL * 2;

const $ = (id) => document.getElementById(id);

const state = {
  lang: getLang(),
  assets: null,
  image: null,        // ImageBitmap of the loaded picture
  name: "banners",    // file name stem for downloads
  model: null,        // generated or loaded art
  selected: null,     // [x, y] of the cell shown in the details panel
  run: null,          // {workers, cancelled} while generating
  status: ["statusAssets"],
  statusError: false,
};

// ---------- i18n ----------
const pick = (pair) => pair[state.lang === "ru" ? 1 : 0];

function t(key, ...args) {
  const value = pick(STRINGS[key]);
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
  document.title = `Image2Banners — ${t("subtitle")}`;
  renderStatus();
  updateActions();
  showDetails();
}

// ---------- preview ----------
const art = $("art");
const view = new PanZoom($("view"), $("view").querySelector(".content"), { min: 0.1 });

function putImage(canvas, data, w, h) {
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").putImageData(new ImageData(data, w, h), 0, 0);
}

function resizeArt(w, h) {
  art.width = w; art.height = h;
  view.setSize(w, h);
  view.fit();
  $("dropHint").hidden = true;
}

function drawModel() {
  const { data, w, h } = renderModel(state.model, state.assets);
  const fresh = art.width !== w || art.height !== h;
  putImage(art, data, w, h);
  if (fresh) { view.setSize(w, h); view.fit(); }
  $("dropHint").hidden = true;
}

/** The picture stretched to the working size: 22 px per block. */
function scaledImage(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width * CELL; canvas.height = height * CELL;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingQuality = "high";
  context.drawImage(state.image, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

// ---------- loading ----------
function clampSize(input) {
  const value = Math.min(MAX_SIZE, Math.max(1, Math.round(input.valueAsNumber) || 1));
  input.value = value;
  return value;
}

function setModel(model) {
  state.model = model;
  state.selected = null;
  $("selection").hidden = true;
  showDetails();
  updateActions();
}

async function loadFile(file) {
  const stem = file.name.replace(/\.[^.]*$/, "") || "banners";
  if (/\.json$/i.test(file.name) || file.type === "application/json") {
    let model;
    try {
      model = fromJson(JSON.parse(await file.text()), state.assets);
    } catch {
      setStatus("errJson");
      return;
    }
    state.name = stem;
    $("width").value = model.width; $("height").value = model.height;
    setModel(model);
    drawModel();
    setStatus("statusJson", model.width, model.height);
    return;
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    setStatus("errFile");
    return;
  }
  state.image = bitmap;
  state.name = stem;
  // Default size: 8 blocks wide, height following the picture's proportions (even).
  const width = clampSize($("width"));
  $("height").value = Math.min(MAX_SIZE, Math.max(2, Math.round(width * bitmap.height / bitmap.width / 2) * 2));
  setModel(null);
  showSource();
  setStatus("statusImage", bitmap.width, bitmap.height);
}

function showSource() {
  if (!state.image || state.model || state.run) return;
  const image = scaledImage(clampSize($("width")), clampSize($("height")));
  resizeArt(image.width, image.height);
  art.getContext("2d").putImageData(image, 0, 0);
}

// ---------- generation ----------
function options() {
  return {
    blocks: $("optBlocks").checked, layering: $("optLayering").checked,
    big: $("optBig").checked, patternItems: $("optItems").checked,
    compare: $("compare").valueAsNumber / 100,
  };
}

function stopRun() {
  if (!state.run) return;
  for (const worker of state.run.workers) worker.terminate();
  state.run = null;
  updateActions();
}

function generate() {
  if (state.run) {
    stopRun();
    // Show whatever was finished: either the previous art or the source picture.
    if (state.model) drawModel(); else showSource();
    setStatus("statusCancelled");
    return;
  }
  if (!state.image || !state.assets) return;

  const width = clampSize($("width")), height = clampSize($("height")), opts = options();
  const image = scaledImage(width, height), rows = Math.ceil(height / 2), total = width * rows;
  const model = createModel(width, height);
  for (const cell of model.cells) cell.block = DEFAULT_BLOCK;
  setModel(null);
  resizeArt(image.width, image.height);
  const context = art.getContext("2d");
  context.putImageData(image, 0, 0);

  // Each slot gets the block above it too, for the layered-banner attempt.
  const strip = (index) => {
    const column = index % width, top = Math.floor(index / width) * SLOT_H - CELL;
    const out = new Uint8ClampedArray(CELL * (SLOT_H + CELL) * 4);
    for (let y = 0; y < SLOT_H + CELL; y++) {
      const sy = top + y;
      if (sy < 0 || sy >= image.height) continue;
      const from = (sy * image.width + column * CELL) * 4;
      out.set(image.data.subarray(from, from + CELL * 4), y * CELL * 4);
    }
    return out;
  };

  const started = performance.now(), tile = document.createElement("canvas");
  const run = { workers: [] };
  state.run = run;
  let next = 0, done = 0;
  const feed = (worker) => {
    if (next >= total) return;
    const index = next++, data = strip(index);
    // The top row has nothing above it to layer over.
    worker.postMessage({ index, strip: data, options: { ...opts, layering: opts.layering && index >= width } }, [data.buffer]);
  };
  const finish = () => {
    stopRun();
    setModel(model);
    drawModel();
    const banners = model.cells.filter((cell) => cell.banner).length;
    setStatus("statusDone", width, height, banners, ((performance.now() - started) / 1000).toFixed(1));
  };
  const count = Math.min($("threads").valueAsNumber, total);
  for (let i = 0; i < count; i++) {
    const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      if (state.run !== run) return;
      if (data.type === "error") {
        stopRun();
        setStatus("errGenerate", data.message);
        return;
      }
      applyCell(model, data.index % width, Math.floor(data.index / width), data.result);
      putImage(tile, data.result.preview, CELL, SLOT_H + 3);
      context.drawImage(tile, (data.index % width) * CELL, Math.floor(data.index / width) * SLOT_H - 3);
      done++;
      setStatus("statusProgress", done, total);
      if (done === total) finish(); else feed(worker);
    };
    worker.onerror = (event) => {
      if (state.run !== run) return;
      stopRun();
      setStatus("errGenerate", event.message || "worker");
    };
    run.workers.push(worker);
    feed(worker);
  }
  setStatus("statusProgress", 0, total);
  updateActions();
}

// ---------- banner details ----------
function dyeName(colour) {
  return DYE_NAMES[colour] ? pick(DYE_NAMES[colour]) : colour;
}

function titleCase(name) {
  return name.replace(/[_-]/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function stepLabel(name) {
  const [colour, pattern] = name.split("#");
  if (pattern === "wall_banner") return t("baseBanner", dyeName(colour));
  const label = `${dyeName(colour)} · ${PATTERN_NAMES[pattern] || titleCase(pattern)}`;
  return PATTERN_ITEMS.has(pattern) ? `${label} (${t("needsItem")})` : label;
}

function bannerCanvas(data) {
  const canvas = document.createElement("canvas");
  canvas.className = "pixel";
  putImage(canvas, data, BANNER_W, BANNER_H);
  return canvas;
}

function select(x, y) {
  if (!state.model || !cellAt(state.model, x, y)) return;
  // A click on the lower half of a banner selects the banner hanging from above.
  const above = cellAt(state.model, x, y - 1);
  if (!cellAt(state.model, x, y).banner && above && above.banner) y -= 1;
  state.selected = [x, y];
  showDetails();
}

function showDetails() {
  const cell = state.model && state.selected && cellAt(state.model, ...state.selected);
  $("detailsBody").hidden = !cell;
  $("detailsHint").hidden = Boolean(cell);
  $("selection").hidden = !cell;
  if (!cell) return;
  const [x, y] = state.selected, { assets } = state;
  const box = $("selection").style;
  box.left = `${x * CELL}px`; box.top = `${y * CELL}px`;
  box.width = `${CELL}px`; box.height = `${Math.min(cell.banner ? SLOT_H : CELL, art.height - y * CELL)}px`;

  $("detailsTitle").textContent = t(cell.banner ? "detailsBanner" : "detailsBlock", x, y);
  const block = cell.block || DEFAULT_BLOCK;
  putImage($("blockIcon"), assets.blocks[assets.blockIndex.get(block)], CELL, CELL);
  $("blockName").textContent = titleCase(block);

  const steps = cell.banner ? bannerSteps(assets, cell.banner) : [];
  $("bannerResult").hidden = $("commandBox").hidden = !cell.banner;
  if (cell.banner) {
    putImage($("bannerResult"), steps.at(-1), BANNER_W, BANNER_H);
    $("command").value = giveCommand(cell.banner);
    $("copyCommand").textContent = t("copy");
  }
  $("steps").replaceChildren(...steps.map((image, i) => {
    const item = document.createElement("li");
    const number = Object.assign(document.createElement("span"), { className: "number", textContent: i + 1 });
    const arrow = Object.assign(document.createElement("span"), { className: "arrow", textContent: "→" });
    const label = Object.assign(document.createElement("span"), { textContent: stepLabel(cell.banner[i]) });
    item.append(number, bannerCanvas(patternTile(assets, cell.banner[i])), arrow, bannerCanvas(image), label);
    return item;
  }));
}

// ---------- export ----------
function fileName(extension) {
  const size = `${state.model.width}x${state.model.height}`;
  const stem = state.name.includes(size) ? state.name : `${state.name}_${size}`;
  return `${stem.replace(/ /g, "_")}.${extension}`;
}

function download(blob, name) {
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  setStatus("statusSaved", name);
}

function savePng() {
  art.toBlob((blob) => blob && download(blob, fileName("png")), "image/png");
}

function saveJson() {
  download(new Blob([JSON.stringify(toJson(state.model), null, 4)], { type: "application/json" }), fileName("json"));
}

async function saveNbt() {
  const gzip = new Blob([buildStructure(state.model)]).stream().pipeThrough(new CompressionStream("gzip"));
  download(await new Response(gzip).blob(), fileName("nbt"));
}

// ---------- wiring ----------
function updateActions() {
  const busy = Boolean(state.run), ready = Boolean(state.model) && !busy;
  $("generate").textContent = t(busy ? "cancel" : "generate");
  $("generate").disabled = !busy && !(state.image && state.assets);
  $("savePng").disabled = $("saveJson").disabled = $("saveNbt").disabled = !ready;
  $("load").disabled = busy || !state.assets;
}

function wire() {
  $("load").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", (e) => {
    if (e.target.files[0]) loadFile(e.target.files[0]);
    e.target.value = "";
  });
  const drop = $("view");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drop"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drop"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drop");
    if (e.dataTransfer.files[0] && state.assets && !state.run) loadFile(e.dataTransfer.files[0]);
  });

  // A press that does not move is a click on a cell; a drag pans the view.
  let press = null;
  drop.addEventListener("pointerdown", (e) => { press = [e.clientX, e.clientY]; });
  drop.addEventListener("pointerup", (e) => {
    if (!press || Math.hypot(e.clientX - press[0], e.clientY - press[1]) > 4) return;
    const [x, y] = view.toContent(e.clientX, e.clientY);
    select(Math.floor(x / CELL), Math.floor(y / CELL));
  });

  for (const id of ["width", "height"]) {
    $(id).addEventListener("change", () => {
      // A new size invalidates loaded art only when a picture can replace it.
      if (state.image && !state.run) { setModel(null); showSource(); }
    });
  }
  const threads = navigator.hardwareConcurrency || 4;
  $("threads").max = threads; $("threads").value = threads;
  for (const id of ["threads", "compare"]) {
    const sync = () => { $(`${id}Value`).textContent = $(id).value; };
    $(id).addEventListener("input", sync);
    sync();
  }

  $("generate").addEventListener("click", generate);
  $("savePng").addEventListener("click", savePng);
  $("saveJson").addEventListener("click", saveJson);
  $("saveNbt").addEventListener("click", saveNbt);
  $("copyCommand").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("command").value);
    } catch {
      $("command").select();
      document.execCommand("copy");
    }
    $("copyCommand").textContent = t("copied");
  });

  $("zoomIn").addEventListener("click", () => view.zoomBy(1.25));
  $("zoomOut").addEventListener("click", () => view.zoomBy(0.8));
  $("zoomFit").addEventListener("click", () => view.fit());
}

async function start() {
  wire();
  bindLanguageSelect($("lang"), (lang) => { state.lang = lang; retranslate(); });
  retranslate();
  try {
    state.assets = await loadAssets();
    setStatus("statusStart");
  } catch (error) {
    setStatus("errAssets", error.message);
  }
  updateActions();
}

start();
