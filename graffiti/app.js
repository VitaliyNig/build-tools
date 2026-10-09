// Graffiti: controls, edit canvas, result preview, export.
import "../shared/tooltip.js";
import { bindLanguageSelect, getLang } from "../shared/i18n.js";
import { applyAdjustments, isNeutral, rotate90 } from "./core/imageops.js";
import { categoryMap, subset, TILE_BYTES, TILE_PX } from "../shared/mc/palette.js";
import { materialCounts } from "./core/quantize.js";
import { isLegacy } from "../shared/mc/legacy.js";
import { buildSchematic } from "./core/schematic.js";
import { atlasStyle, importJarFile, listPalettes, loadPalette, tileIcon } from "../shared/mc/palettes.js";
import { PanZoom } from "../shared/panzoom.js";
import { CATEGORIES, STRINGS } from "./strings.js";

const MAX_SOURCE_SIDE = 4096;   // larger images are downscaled on load
const MAX_PREVIEW_SIDE = 1600;  // the edit canvas shows at most this many pixels per side
const MAX_PNG_SIDE = 8192;

const $ = (id) => document.getElementById(id);
const factor = (v) => (v / 100).toFixed(2);
const signed = (v) => (v > 0 ? `+${v}` : `${v}`);
// key, min, max, default, value formatter
const SLIDERS = [
  ["brightness", 0, 200, 100, factor],
  ["contrast", 0, 200, 100, factor],
  ["saturation", 0, 200, 100, factor],
  ["temperature", -100, 100, 0, signed],
  ["shadows", -100, 100, 0, signed],
  ["highlights", -100, 100, 0, signed],
];

const state = {
  lang: getLang(),
  palette: null,
  enabled: null,      // Set of block ids, or null = whole palette
  source: null,       // {data: RGBA, w, h}
  preview: null,      // downscaled copy of source shown on the edit canvas
  quad: null,         // 4 [x, y] in source pixels: TL, TR, BR, BL
  result: null,       // {idx, w, h, palette, counts, tilePx, fullPalette, fullIndex}
  busy: false,
  status: ["statusStart"],
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
  document.title = `Graffiti — ${t("subtitle")}`;
  $("pickerSearch").placeholder = t("pickerSearch");
  renderStatus();
  refreshBlocksLabel();
  renderPaletteOptions();
  renderSummary();
  updateActions();
}

// ---------- views ----------
const editCanvas = $("editCanvas"), resultCanvas = $("resultCanvas");
const editView = new PanZoom($("editView"), $("editView").querySelector(".content"), { onChange: drawQuad });
const resultView = new PanZoom($("resultView"), $("resultView").querySelector(".content"), {
  min: 0.05,
  // nearest-neighbour so magnified blocks/textures stay crisp
  onChange: () => resultCanvas.classList.toggle("crisp", resultView.scale >= 1),
});
const pendingFit = new Set();

function fitWhenVisible(view) {
  if (!view.fit()) pendingFit.add(view);
}

function showTab(name) {
  for (const tab of ["Edit", "Result"]) {
    const active = tab.toLowerCase() === name;
    $(`tab${tab}`).setAttribute("aria-selected", active);
    $(`${tab.toLowerCase()}Pane`).hidden = !active;
  }
  for (const view of pendingFit) if (view.fit()) pendingFit.delete(view);
}

// ---------- adjustments ----------
function buildSliders() {
  const host = $("adjustSliders");
  for (const [key, min, max, value, format] of SLIDERS) {
    const label = document.createElement("label");
    label.htmlFor = key;
    label.dataset.i18n = key;
    const input = Object.assign(document.createElement("input"), { type: "range", id: key, min, max, value });
    const output = document.createElement("output");
    output.textContent = format(value);
    input.addEventListener("input", () => {
      output.textContent = format(input.valueAsNumber);
      schedulePreview();
    });
    host.append(label, input, output);
  }
}

function adjustments() {
  return Object.fromEntries(SLIDERS.map(([key]) => [key, $(key).valueAsNumber / 100]));
}

function resetAdjustments() {
  for (const [key, , , value] of SLIDERS) {
    $(key).value = value;
    $(key).dispatchEvent(new Event("input"));
  }
}

// debounced live preview of image adjustments on the edit canvas
let previewTimer = 0;
function schedulePreview() {
  if (!state.source) return;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(applyLivePreview, 60);
}

function applyLivePreview() {
  if (!state.preview) return;
  const { data, w, h } = state.preview, a = adjustments();
  const shown = isNeutral(a) ? data : applyAdjustments(data, a);
  editCanvas.getContext("2d").putImageData(new ImageData(shown, w, h), 0, 0);
}

// ---------- source image ----------
function scaledCopy(image, w, h, targetW, targetH) {
  const canvas = document.createElement("canvas");
  canvas.width = targetW; canvas.height = targetH;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  // Transparent areas become white rather than black.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, targetW, targetH);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, w, h, 0, 0, targetW, targetH);
  return context.getImageData(0, 0, targetW, targetH).data;
}

function setSource(source) {
  state.source = source;
  const { data, w, h } = source;
  const scale = Math.min(1, MAX_PREVIEW_SIDE / Math.max(w, h));
  if (scale < 1) {
    const full = document.createElement("canvas");
    full.width = w; full.height = h;
    full.getContext("2d").putImageData(new ImageData(data, w, h), 0, 0);
    const pw = Math.max(1, Math.round(w * scale)), ph = Math.max(1, Math.round(h * scale));
    state.preview = { data: scaledCopy(full, w, h, pw, ph), w: pw, h: ph };
  } else {
    state.preview = source;
  }
  editCanvas.width = state.preview.w; editCanvas.height = state.preview.h;
  // The canvas is laid out at source size so view coordinates are source pixels.
  editCanvas.style.width = `${w}px`; editCanvas.style.height = `${h}px`;
  $("dropHint").hidden = true;
  editView.setSize(w, h);
  resetCorners();
  applyLivePreview();
  fitWhenVisible(editView);
  updateActions();
}

async function loadImage(blob) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);   // honours EXIF rotation
  } catch {
    setStatus("errLoad");
    return;
  }
  const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
  const data = scaledCopy(bitmap, bitmap.width, bitmap.height, w, h);
  bitmap.close();
  showTab("edit");
  setSource({ data, w, h });
  setStatus("statusLoaded", w, h);
}

function rotate(clockwise) {
  if (!state.source) return;
  const { data, w, h } = state.source;
  setSource(rotate90(data, w, h, clockwise));
}

// ---------- perspective quad ----------
const quadSvg = $("quad");
const quadHandles = [...quadSvg.querySelectorAll("circle")];

function resetCorners() {
  if (!state.source) return;
  const { w, h } = state.source, ix = w * 0.02, iy = h * 0.02;
  state.quad = [[ix, iy], [w - ix, iy], [w - ix, h - iy], [ix, h - iy]];
  drawQuad();
}

function drawQuad() {
  const shown = Boolean($("perspectiveOn").checked && state.quad);
  // SVG elements have no `hidden` property, only the attribute.
  quadSvg.toggleAttribute("hidden", !shown);
  if (!shown) return;
  const points = state.quad.map(([x, y]) => editView.toView(x, y));
  quadSvg.querySelector("polygon").setAttribute("points", points.map((p) => p.join(",")).join(" "));
  quadHandles.forEach((handle, i) => {
    handle.setAttribute("cx", points[i][0]);
    handle.setAttribute("cy", points[i][1]);
  });
}

quadHandles.forEach((handle, i) => {
  handle.addEventListener("pointerdown", (e) => { handle.setPointerCapture(e.pointerId); e.preventDefault(); });
  handle.addEventListener("pointermove", (e) => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    state.quad[i] = editView.toContent(e.clientX, e.clientY);
    drawQuad();
  });
});

// ---------- palette ----------
let paletteEntries = [];

function renderPaletteOptions() {
  const select = $("paletteVersion");
  select.replaceChildren(...paletteEntries.map((entry) =>
    new Option(entry.imported ? `${entry.version} (${t("imported")})` : entry.version, entry.key)));
  if (state.palette) select.value = state.palette.key;
}

function refreshBlocksLabel() {
  if (!state.palette) return;
  const n = state.enabled ? state.enabled.size : state.palette.size;
  $("blocksLabel").textContent = t("blocksEnabled", n, state.palette.size, state.palette.version);
}

async function selectPalette(key) {
  try {
    state.palette = await loadPalette(key);
  } catch (error) {
    setStatus("errPalette", error.message);
    if (state.palette) $("paletteVersion").value = state.palette.key;
    return false;
  }
  state.enabled = null;
  $("paletteVersion").value = key;
  refreshBlocksLabel();
  updateActions();
  return true;
}

async function addJar(file) {
  state.busy = true;
  updateActions();
  try {
    const { key, record } = await importJarFile(file,
      (value) => setStatus("statusJar", `${Math.round(value * 100)} %`));
    paletteEntries = (await listPalettes()).entries;
    renderPaletteOptions();
    if (await selectPalette(key)) {
      setStatus("statusJarDone", record.version, record.blocks.length, record.skipped);
    }
  } catch (error) {
    if (error.message === "no-blocks") setStatus("errJarNoBlocks");
    else if (error.message === "bad-metadata") setStatus("errJarMetadata");
    else setStatus("errJar", error.message);
  } finally {
    state.busy = false;
    updateActions();
  }
}

// ---------- block picker ----------
const picker = $("picker");

function categoryTitle(key) {
  const known = CATEGORIES[key];
  if (known) return known[state.lang === "ru" ? 1 : 0];
  return key.replace(/_/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function syncCategory(section) {
  const boxes = [...section.querySelectorAll(".blocks input")];
  const checked = boxes.filter((box) => box.checked).length;
  const master = section.querySelector("header input");
  master.checked = checked === boxes.length;
  master.indeterminate = checked > 0 && checked < boxes.length;
}

function openPicker() {
  const palette = state.palette;
  const position = new Map(palette.blocks.map((b, i) => [b.id, i]));
  const list = $("pickerList");
  for (const [name, value] of Object.entries(atlasStyle(palette))) list.style.setProperty(name, value);
  list.replaceChildren();
  for (const [category, blocks] of categoryMap(palette)) {
    const section = document.createElement("div");
    section.className = "category";
    const header = document.createElement("header");
    const master = Object.assign(document.createElement("input"), { type: "checkbox" });
    const toggle = Object.assign(document.createElement("button"), { type: "button", textContent: categoryTitle(category) });
    toggle.addEventListener("click", () => section.classList.toggle("open"));
    header.append(master, toggle);
    const items = document.createElement("div");
    items.className = "blocks";
    for (const block of blocks) {
      const label = document.createElement("label");
      label.dataset.search = `${block.name} ${block.id}`.toLowerCase();
      const box = Object.assign(document.createElement("input"), { type: "checkbox", value: block.id });
      box.checked = !state.enabled || state.enabled.has(block.id);
      box.addEventListener("change", () => syncCategory(section));
      label.append(box, tileIcon(position.get(block.id)), block.name);
      items.append(label);
    }
    master.addEventListener("change", () => {
      for (const box of items.querySelectorAll("input")) box.checked = master.checked;
    });
    section.append(header, items);
    list.append(section);
    syncCategory(section);
  }
  $("pickerSearch").value = "";
  picker.showModal();
}

function filterPicker() {
  const query = $("pickerSearch").value.trim().toLowerCase();
  for (const section of $("pickerList").children) {
    let anyVisible = false;
    for (const label of section.querySelectorAll(".blocks label")) {
      label.hidden = !label.dataset.search.includes(query);
      anyVisible ||= !label.hidden;
    }
    section.hidden = !anyVisible;
    section.classList.toggle("open", Boolean(query) && anyVisible);
  }
}

/** Apply to currently visible (matching) blocks only. */
function setAllVisible(checked) {
  for (const section of $("pickerList").children) {
    for (const label of section.querySelectorAll(".blocks label:not([hidden])")) {
      label.querySelector("input").checked = checked;
    }
    syncCategory(section);
  }
}

function acceptPicker() {
  const chosen = new Set([...$("pickerList").querySelectorAll(".blocks input:checked")].map((box) => box.value));
  if (!chosen.size) {
    $("pickerSearch").setCustomValidity(t("errEmptyPalette"));
    $("pickerSearch").reportValidity();
    $("pickerSearch").setCustomValidity("");
    return;
  }
  state.enabled = chosen.size === state.palette.size ? null : chosen;
  refreshBlocksLabel();
  picker.close();
}

// ---------- generate ----------
let worker = null;

function clampSize(input) {
  const value = Math.min(1024, Math.max(1, Math.round(input.valueAsNumber) || 1));
  input.value = value;
  return value;
}

function generate() {
  if (!state.source || !state.palette || state.busy) return;
  const fullPalette = state.palette;
  const palette = state.enabled ? subset(fullPalette, state.enabled) : fullPalette;
  const settings = {
    width: clampSize($("width")), height: clampSize($("height")),
    ...adjustments(),
    dither: $("dither").valueAsNumber / 100,
    textureStrength: $("texture").valueAsNumber / 100,
    quad: $("perspectiveOn").checked && state.quad ? state.quad.map((p) => [...p]) : null,
  };
  state.busy = true;
  updateActions();
  setStatus("generating", "");

  if (!worker) worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  const finish = () => { state.busy = false; updateActions(); };
  worker.onmessage = ({ data }) => {
    if (data.type === "progress") {
      setStatus("generating", `${Math.round(data.value * 100)} %`);
    } else if (data.type === "done") {
      finish();
      showResult(data.idx, settings.width, settings.height, palette, fullPalette);
    } else {
      finish();
      setStatus("errGenerate", data.message);
    }
  };
  worker.onerror = (event) => {
    worker.terminate();
    worker = null;
    finish();
    setStatus("errGenerate", event.message || "worker");
  };
  const { blocks, tiles, version, dataVersion } = palette;
  worker.postMessage({ source: state.source, settings, palette: { blocks, tiles, version, dataVersion } });
}

// ---------- result ----------
/** Draw the block grid as a real-texture mosaic, tilePx pixels per block. */
function renderMosaic(canvas, idx, w, h, palette, tilePx) {
  // Pack every tile (nearest-resized if needed) as 32-bit pixels, then copy rows.
  const packed = new Uint32Array(palette.size * tilePx * tilePx);
  const bytes = new Uint8Array(packed.buffer);
  for (let p = 0; p < palette.size; p++) {
    for (let y = 0; y < tilePx; y++) {
      const sy = Math.floor((y + 0.5) * TILE_PX / tilePx);
      for (let x = 0; x < tilePx; x++) {
        const sx = Math.floor((x + 0.5) * TILE_PX / tilePx);
        const s = p * TILE_BYTES + (sy * TILE_PX + sx) * 3;
        const d = ((p * tilePx + y) * tilePx + x) * 4;
        bytes[d] = palette.tiles[s]; bytes[d + 1] = palette.tiles[s + 1];
        bytes[d + 2] = palette.tiles[s + 2]; bytes[d + 3] = 255;
      }
    }
  }
  canvas.width = w * tilePx; canvas.height = h * tilePx;
  const image = new ImageData(canvas.width, canvas.height);
  const out = new Uint32Array(image.data.buffer);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const tile = idx[row * w + col] * tilePx * tilePx;
      for (let y = 0; y < tilePx; y++) {
        out.set(packed.subarray(tile + y * tilePx, tile + (y + 1) * tilePx),
          (row * tilePx + y) * canvas.width + col * tilePx);
      }
    }
  }
  canvas.getContext("2d").putImageData(image, 0, 0);
}

function showResult(idx, w, h, palette, fullPalette) {
  // full 16px tiles (real texture detail for zoom) up to a sane mosaic size;
  // shrink tiles only for very large canvases to bound memory.
  const side = Math.max(w, h);
  const tilePx = side <= 256 ? TILE_PX : Math.max(4, Math.floor(4096 / side));
  const fullIndex = new Map(fullPalette.blocks.map((b, i) => [b.id, i]));
  state.result = { idx, w, h, palette, tilePx, fullPalette, fullIndex, counts: materialCounts(idx, palette.size) };

  renderMosaic(resultCanvas, idx, w, h, palette, tilePx);
  $("resultHint").hidden = true;
  resultView.setSize(resultCanvas.width, resultCanvas.height);
  showTab("result");
  fitWhenVisible(resultView);

  const materials = $("materials");
  for (const [name, value] of Object.entries(atlasStyle(fullPalette))) materials.style.setProperty(name, value);
  $("materialRows").replaceChildren(...state.result.counts.map(([index, count]) => {
    const row = document.createElement("tr"), block = palette.blocks[index];
    row.insertCell().append(tileIcon(fullIndex.get(block.id)));
    row.insertCell().textContent = block.name;
    const cell = row.insertCell();
    cell.className = "num";
    cell.textContent = count;
    return row;
  }));
  renderSummary();
  setStatus("statusDone", w, h, state.result.counts.length);
  updateActions();
}

function renderSummary() {
  const r = state.result;
  $("summary").innerHTML = r ? t("summary", r.w, r.h, r.w * r.h, r.counts.length) : "";
}

function hoverResult(e) {
  const r = state.result, tip = $("tooltip");
  tip.hidden = true;
  if (!r || e.buttons) return;
  const [x, y] = resultView.toContent(e.clientX, e.clientY);
  const col = Math.floor(x / r.tilePx), row = Math.floor(y / r.tilePx);
  if (col < 0 || row < 0 || col >= r.w || row >= r.h) return;
  tip.textContent = r.palette.blocks[r.idx[row * r.w + col]].name;
  const box = $("resultView").getBoundingClientRect();
  tip.style.left = `${e.clientX - box.left + 14}px`;
  tip.style.top = `${e.clientY - box.top + 14}px`;
  tip.hidden = false;
}

// ---------- export ----------
function download(blob, name) {
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

async function exportSchem() {
  const r = state.result;
  if (!r) return;
  try {
    const { bytes, paletteSize, extension } = buildSchematic(r.idx, r.w, r.h, r.palette);
    const gzip = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    download(await new Response(gzip).blob(), `graffiti.${extension}`);
    setStatus("statusSchem", r.w, r.h, paletteSize);
  } catch (error) {
    setStatus("errExport", error.message);
  }
}

function exportPng() {
  const r = state.result;
  if (!r) return;
  try {
    // Full 16px tiles unless the image would exceed what a canvas can hold.
    const tilePx = Math.max(1, Math.min(TILE_PX, Math.floor(MAX_PNG_SIDE / Math.max(r.w, r.h))));
    let canvas = resultCanvas;
    if (tilePx !== r.tilePx) {
      canvas = document.createElement("canvas");
      renderMosaic(canvas, r.idx, r.w, r.h, r.palette, tilePx);
    }
    canvas.toBlob((blob) => {
      if (!blob) { setStatus("errExport", "PNG"); return; }
      download(blob, "graffiti.png");
      setStatus("statusPng");
    }, "image/png");
  } catch (error) {
    setStatus("errExport", error.message);
  }
}

// ---------- wiring ----------
function updateActions() {
  const hasResult = Boolean(state.result);
  $("exportVersion").textContent = hasResult ? state.result.palette.version : "—";
  // Versions before 1.13 cannot load Sponge .schem files.
  const legacy = isLegacy((hasResult ? state.result.palette : state.palette || {}).dataVersion ?? Infinity);
  $("exportSchem").textContent = t(legacy ? "exportSchematic" : "exportSchem");
  $("generate").disabled = !state.source || !state.palette || state.busy;
  $("exportSchem").disabled = $("exportPng").disabled = !hasResult || state.busy;
  $("chooseBlocks").disabled = !state.palette;
  $("addJar").disabled = $("paletteVersion").disabled = state.busy;
}

function wire() {
  $("tabEdit").addEventListener("click", () => showTab("edit"));
  $("tabResult").addEventListener("click", () => showTab("result"));

  $("load").addEventListener("click", () => $("imageFile").click());
  $("imageFile").addEventListener("change", (e) => {
    if (e.target.files[0]) loadImage(e.target.files[0]);
    e.target.value = "";
  });
  const drop = $("editView");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drop"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drop"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drop");
    if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
  });

  $("perspectiveOn").addEventListener("change", drawQuad);
  $("resetCorners").addEventListener("click", resetCorners);
  $("rotateLeft").addEventListener("click", () => rotate(false));
  $("rotateRight").addEventListener("click", () => rotate(true));
  $("resetAdjust").addEventListener("click", resetAdjustments);

  for (const id of ["dither", "texture"]) {
    $(id).addEventListener("input", () => { $(`${id}Value`).textContent = `${$(id).value} %`; });
  }
  $("paletteVersion").addEventListener("change", async (e) => {
    if (await selectPalette(e.target.value)) setStatus("statusPalette", state.palette.version, state.palette.size);
  });
  $("addJar").addEventListener("click", () => $("jarFile").click());
  $("jarFile").addEventListener("change", (e) => {
    if (e.target.files[0]) addJar(e.target.files[0]);
    e.target.value = "";
  });

  $("chooseBlocks").addEventListener("click", openPicker);
  $("pickerSearch").addEventListener("input", filterPicker);
  $("pickerAll").addEventListener("click", () => setAllVisible(true));
  $("pickerNone").addEventListener("click", () => setAllVisible(false));
  $("pickerOk").addEventListener("click", acceptPicker);
  $("pickerCancel").addEventListener("click", () => picker.close());

  $("generate").addEventListener("click", generate);
  $("exportSchem").addEventListener("click", exportSchem);
  $("exportPng").addEventListener("click", exportPng);

  $("zoomIn").addEventListener("click", () => resultView.zoomBy(1.25));
  $("zoomOut").addEventListener("click", () => resultView.zoomBy(0.8));
  $("zoomFit").addEventListener("click", () => resultView.fit());
  $("zoomOne").addEventListener("click", () => resultView.reset100());
  $("resultView").addEventListener("pointermove", hoverResult);
  $("resultView").addEventListener("pointerleave", () => { $("tooltip").hidden = true; });
}

async function start() {
  buildSliders();
  wire();
  bindLanguageSelect($("lang"), (lang) => { state.lang = lang; retranslate(); });
  retranslate();
  updateActions();
  try {
    const { entries, defaultKey } = await listPalettes();
    paletteEntries = entries;
    renderPaletteOptions();
    if (!entries.length) {
      // Site published without bundled palettes: the user imports a client JAR.
      setStatus("statusNoPalette");
      return;
    }
    await selectPalette(entries.some((entry) => entry.key === defaultKey) ? defaultKey : entries[0].key);
  } catch (error) {
    setStatus("errPalette", error.message);
  }
}

start();
