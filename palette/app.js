// Palette: find blocks by colour, build gradients, collect and share a palette.
import { bindLanguageSelect, getLang } from "../shared/i18n.js";
import { importJarFile, listPalettes, loadPalette, tileCanvas } from "../shared/mc/palettes.js";
import {
  baseFromPoint, fromHex, gradientColours, gradientEntries, HARMONY_RULES, hsvToRgb, labOf, listEntries, rank, rgbToHsv,
  schemeColours, toHex,
} from "./core.js";
import { STRINGS } from "./strings.js";

const MIN_BLOCK_RESULTS = 12, MIN_DECO_RESULTS = 6;  // shown even when nothing is close in colour
const HARMONY_RESULTS = 4;  // blocks offered for each colour of a scheme
const WHEEL = 260;          // colour wheel diameter in CSS pixels
const CUSTOM = "custom";    // the rule in which every point moves on its own
const MAX_STOPS = 8;
const MIN_LENGTH = 2, MAX_LENGTH = 64, DEFAULT_LENGTH = 12;   // blocks per gradient segment
const STORE_CURRENT = "tools.palette.current", STORE_SAVED = "tools.palette.saved";

const $ = (id) => document.getElementById(id);

const state = {
  lang: getLang(),
  palette: null,
  entries: [],            // every block and decoration of the palette
  byId: new Map(),
  colour: [127, 178, 56],
  // The By colour picker. It keeps its own hue, which a grey or black cannot carry.
  picker: { h: 85, s: 0.69, v: 0.7 },
  // Colour wheel: `base` drives a rule; in the custom rule `custom` holds the points.
  harmony: { rule: "analogous", base: { h: 85, s: 0.69, v: 0.7 }, custom: [], selected: 2 },
  // Gradient: colours, the number of blocks between each pair, and the tag being edited.
  stops: [[232, 148, 46], [110, 36, 40]],
  lengths: [DEFAULT_LENGTH],
  selectedStop: 0,
  keptRows: [],           // results pinned for comparison: [{rgb, id}] lists
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
  // Decorations have no sides, so the side filter leaves them alone.
  const side = $("side").value;
  return state.entries.filter((entry) => !entry.hidden
    && !(noFalling && entry.falling) && !(noTechnical && entry.technical)
    && (side === "all" || entry.kind === "deco" || entry.sides.has(side)));
}

const smooth = () => ($("smooth").checked ? 1 : 0);

// ---------- match by colour ----------
function setColour(rgb) {
  // Keep the hue of a grey: converting it back from RGB would reset it to red.
  const harmony = state.harmony, hsv = rgbToHsv(rgb);
  const target = harmony.rule === CUSTOM ? harmony.custom[harmony.selected] : harmony.base;
  if (!hsv.s || !hsv.v) hsv.h = target.h;
  Object.assign(target, hsv);
  colourChanged();
}

/** The base colour changed: update the inputs and everything derived from it. */
function colourChanged() {
  state.colour = hsvToRgb(harmonyPoints()[state.harmony.selected]);
  for (const id of ["hex", "harmonyColour", "harmonyHex"]) $(id).value = toHex(state.colour);
  renderPicker();
  renderMatch();
  renderHarmonies();
}

/** Show state.colour in the picker, moving its knobs only if the colour came from elsewhere. */
function renderPicker() {
  const picker = state.picker;
  // A difference of one step is only rounding from the picker's own colour.
  if (hsvToRgb(picker).some((v, c) => Math.abs(v - state.colour[c]) > 1)) {
    const hsv = rgbToHsv(state.colour);
    if (!hsv.s || !hsv.v) hsv.h = picker.h;
    Object.assign(picker, hsv);
  }
  $("shade").style.setProperty("--hue", toHex(hsvToRgb({ h: picker.h, s: 1, v: 1 })));
  $("shadeKnob").style.left = `${picker.s * 100}%`;
  $("shadeKnob").style.top = `${(1 - picker.v) * 100}%`;
  $("shadeKnob").style.background = toHex(state.colour);
  $("hueKnob").style.top = `${picker.h / 360 * 100}%`;
}

/** Drag inside an element: calls move(x, y) with the pointer position as 0..1 fractions. */
function dragArea(element, move) {
  const report = (e) => {
    const box = element.getBoundingClientRect();
    move(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)));
  };
  let active = false;
  element.addEventListener("pointerdown", (e) => { active = true; element.setPointerCapture(e.pointerId); report(e); });
  element.addEventListener("pointermove", (e) => { if (active) report(e); });
  const release = () => { active = false; };
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
}

function wirePicker() {
  const apply = (change) => {
    Object.assign(state.picker, change);
    setColour(hsvToRgb(state.picker));
  };
  dragArea($("shade"), (x, y) => apply({ s: x, v: 1 - y }));
  // The bottom of the hue bar is red again; stop just short so the knob stays there.
  dragArea($("hue"), (x, y) => apply({ h: Math.min(359.9, y * 360) }));
  $("randomColour").addEventListener("click", () => setColour([0, 0, 0].map(() => Math.floor(Math.random() * 256))));
  if ("EyeDropper" in window) {
    $("eyedropper").hidden = false;
    $("eyedropper").addEventListener("click", async () => {
      try {
        setColour(fromHex((await new window.EyeDropper().open()).sRGBHex) || state.colour);
      } catch { /* cancelled */ }
    });
  }
}

// The two panels list everything, closest first, and scroll. Their tiles are
// made once per palette and only reordered, so dragging in the picker stays fast.
const matchTiles = new Map();
let matchOrder = "";

function renderMatch() {
  if (!state.palette) return;
  const query = $("search").value.trim().toLowerCase(), lab = labOf(state.colour);
  const found = pool().filter((entry) => !query || `${entry.name} ${entry.id}`.toLowerCase().includes(query));
  // Without a search only colours close enough to the chosen one are listed,
  // but never fewer than a couple of rows, so a rare colour still gets answers.
  const spread = $("spread").valueAsNumber;
  // Leave the number alone while it is being typed.
  if (document.activeElement !== $("spreadValue")) $("spreadValue").value = spread;
  const near = (entry) => Math.hypot(entry.lab[0] - lab[0], entry.lab[1] - lab[1], entry.lab[2] - lab[2]) <= spread;
  const closest = (ranked, least) => (query ? ranked : ranked.slice(0, Math.max(least, ranked.filter(near).length)));
  const list = (deco) => closest(rank(found.filter((entry) => (entry.kind === "deco") === deco), lab, smooth()), deco ? MIN_DECO_RESULTS : MIN_BLOCK_RESULTS).map((entry) => {
    if (!matchTiles.has(entry.id)) matchTiles.set(entry.id, tile(entry, toggleMine));
    const node = matchTiles.get(entry.id);
    node.classList.toggle("chosen", state.mine.includes(entry.id));
    return node;
  });
  const blocks = list(false), decorations = list(true);
  $("blockResults").replaceChildren(...blocks);
  $("decoResults").replaceChildren(...decorations);
  // A new colour or search starts from the best matches again.
  const order = `${toHex(state.colour)}|${query}|${spread}`;
  if (order !== matchOrder) {
    matchOrder = order;
    $("blockResults").scrollTop = $("decoResults").scrollTop = 0;
  }
}

// ---------- harmonies ----------
function harmonyPoints() {
  const { rule, base, custom } = state.harmony;
  return rule === CUSTOM ? custom : schemeColours(rule, base);
}

function setRule(rule) {
  const harmony = state.harmony, selected = harmonyPoints()[harmony.selected];
  if (rule === CUSTOM) {
    harmony.custom = harmonyPoints().map((point) => ({ ...point }));
  } else {
    harmony.base = { ...selected };
    harmony.selected = HARMONY_RULES[rule].base;
  }
  harmony.rule = rule;
  colourChanged();
}

/** Hue and saturation under a pointer event on the wheel. */
function wheelPosition(event) {
  const box = $("wheel").getBoundingClientRect(), radius = box.width / 2;
  const dx = event.clientX - box.left - radius, dy = event.clientY - box.top - radius;
  return {
    h: (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360,
    s: Math.min(1, Math.hypot(dx, dy) / radius),
  };
}

function movePoint(index, { h, s }) {
  const harmony = state.harmony;
  if (harmony.rule === CUSTOM) Object.assign(harmony.custom[index], { h, s });
  else harmony.base = baseFromPoint(harmony.rule, index, h, s, harmony.base);
  colourChanged();
}

function drawWheel() {
  const canvas = $("wheelCanvas"), size = canvas.width, radius = size / 2;
  const image = new ImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - radius, dy = y + 0.5 - radius, distance = Math.hypot(dx, dy) / radius;
      if (distance > 1) continue;
      const rgb = hsvToRgb({ h: (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360, s: distance, v: 1 });
      image.data.set([rgb[0], rgb[1], rgb[2], 255], (y * size + x) * 4);
    }
  }
  canvas.getContext("2d").putImageData(image, 0, 0);
}

/** A small picture of a rule: where its colours sit on the wheel. */
function ruleIcon(rule) {
  const dots = rule === CUSTOM
    ? [[-70, 0.9], [-20, 0.45], [40, 0.85], [150, 0.6], [215, 0.9]]
    : HARMONY_RULES[rule].colours.map(([hue, saturation, brightness]) => [hue + 90, 0.9 * saturation * (brightness < 1 ? brightness : 1)]);
  const circles = dots.map(([angle, distance]) => {
    const x = 16 + 12 * distance * Math.cos(angle * Math.PI / 180), y = 16 - 12 * distance * Math.sin(angle * Math.PI / 180);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="currentColor"/>`;
  }).join("");
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5"/>${circles}</svg>`;
}

function renderRules() {
  $("rules").replaceChildren(...[CUSTOM, ...Object.keys(HARMONY_RULES)].map((rule) => {
    const button = Object.assign(document.createElement("button"), { type: "button", title: t(`harmony_${rule}`) });
    button.innerHTML = ruleIcon(rule);
    button.setAttribute("aria-pressed", rule === state.harmony.rule);
    button.addEventListener("click", () => setRule(rule));
    return button;
  }));
  $("ruleName").textContent = t(`harmony_${state.harmony.rule}`);
}

function renderHarmonies() {
  if (!state.palette) return;
  const { selected } = state.harmony, points = harmonyPoints();
  $("brightness").value = Math.round(points[selected].v * 100);
  renderRules();

  const wheel = $("wheel");
  for (const old of wheel.querySelectorAll(".point")) old.remove();
  points.forEach((point, i) => {
    const dot = Object.assign(document.createElement("div"), { className: "point" });
    dot.classList.toggle("selected", i === selected);
    dot.dataset.index = i;
    const angle = point.h * Math.PI / 180, distance = point.s * WHEEL / 2;
    dot.style.left = `${WHEEL / 2 + distance * Math.cos(angle)}px`;
    dot.style.top = `${WHEEL / 2 - distance * Math.sin(angle)}px`;
    dot.style.background = toHex(hsvToRgb(point));
    wheel.append(dot);
  });

  const blocks = pool().filter((entry) => entry.kind !== "deco");
  $("scheme").replaceChildren(...points.map((point, i) => {
    const rgb = hsvToRgb(point), hex = toHex(rgb);
    const column = Object.assign(document.createElement("div"), { className: "column" });
    column.classList.toggle("selected", i === selected);
    const swatch = Object.assign(document.createElement("button"), { type: "button", className: "swatch", textContent: hex.toUpperCase() });
    swatch.style.background = hex;
    // Dark text on light colours, light text on dark ones.
    swatch.style.color = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] > 150 ? "#111" : "#fff";
    swatch.addEventListener("click", () => selectPoint(i));
    column.append(swatch, ...rank(blocks, labOf(rgb), smooth()).slice(0, HARMONY_RESULTS).map((entry) => tile(entry, toggleMine)));
    return column;
  }));
}

/** Make a colour of the scheme the one the sliders and inputs control. */
function selectPoint(index) {
  const harmony = state.harmony;
  if (harmony.rule === CUSTOM) {
    harmony.selected = index;
    colourChanged();
  } else {
    // In a rule the selected colour is always the base, so rebuild around this one.
    const point = harmonyPoints()[index];
    harmony.base = { ...point };
    colourChanged();
  }
}

function wireWheel() {
  const wheel = $("wheel");
  let dragging = -1;
  wheel.addEventListener("pointerdown", (e) => {
    const dot = e.target.closest(".point");
    dragging = dot ? Number(dot.dataset.index) : state.harmony.selected;
    if (state.harmony.rule === CUSTOM) state.harmony.selected = dragging;
    wheel.setPointerCapture(e.pointerId);
    movePoint(dragging, wheelPosition(e));
  });
  wheel.addEventListener("pointermove", (e) => { if (dragging >= 0) movePoint(dragging, wheelPosition(e)); });
  const release = () => { dragging = -1; };
  wheel.addEventListener("pointerup", release);
  wheel.addEventListener("pointercancel", release);

  $("brightness").addEventListener("input", () => {
    const harmony = state.harmony, v = $("brightness").valueAsNumber / 100;
    if (harmony.rule === CUSTOM) harmony.custom[harmony.selected].v = v;
    else harmony.base.v = Math.min(1, v / HARMONY_RULES[harmony.rule].colours[harmony.selected][2]);
    colourChanged();
  });
  $("harmonyAdd").addEventListener("click", () => {
    const blocks = pool().filter((entry) => entry.kind !== "deco");
    for (const point of harmonyPoints()) {
      const [best] = rank(blocks, labOf(hsvToRgb(point)), smooth());
      if (best && !state.mine.includes(best.id)) state.mine.push(best.id);
    }
    mineChanged();
  });
}

// ---------- gradient ----------
function gradient() {
  const usable = pool().filter((entry) => $("withDeco").checked || entry.kind !== "deco");
  return gradientEntries(usable, state.stops, state.lengths,
    { unique: $("unique").checked, smooth: smooth(), oklab: $("oklab").checked });
}

function setLength(segment, value) {
  state.lengths[segment] = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(value) || MIN_LENGTH));
  renderGradient();
}

function addStop(atStart) {
  if (state.stops.length >= MAX_STOPS) return;
  const neighbour = [...state.stops.at(atStart ? 0 : -1)];
  if (atStart) { state.stops.unshift(neighbour); state.lengths.unshift(DEFAULT_LENGTH); }
  else { state.stops.push(neighbour); state.lengths.push(DEFAULT_LENGTH); }
  state.selectedStop = atStart ? 0 : state.stops.length - 1;
  renderGradient();
}

function removeStop(index) {
  state.stops.splice(index, 1);
  // The two parts around a removed colour merge; at an end the outer part goes.
  if (index > 0 && index < state.lengths.length) {
    state.lengths.splice(index - 1, 2, Math.min(MAX_LENGTH, state.lengths[index - 1] + state.lengths[index]));
  } else {
    state.lengths.splice(Math.min(index, state.lengths.length - 1), 1);
  }
  state.selectedStop = Math.min(state.selectedStop, state.stops.length - 1);
  renderGradient();
}

/** The colour bar: one part per pair of colours, sized by its length, with tags below. */
function renderGradientBar() {
  const total = state.lengths.reduce((sum, n) => sum + n, 0);
  const colours = gradientColours(state.stops, state.lengths, $("oklab").checked).map(toHex);
  let offset = 0;
  $("segments").replaceChildren(...state.lengths.map((length, i) => {
    const part = Object.assign(document.createElement("div"), { className: "segment" });
    part.style.flex = `${length} 0 0`;
    part.style.background = `linear-gradient(to right, ${colours.slice(offset, offset + length).concat(colours[Math.min(colours.length - 1, offset + length)]).join(", ")})`;
    offset += length;
    // The length of the part: an editable number with its unit.
    const stepper = Object.assign(document.createElement("label"), { className: "stepper", title: t("lengthTip") });
    const input = Object.assign(document.createElement("input"), { type: "number", min: MIN_LENGTH, max: MAX_LENGTH, value: length });
    input.addEventListener("change", () => setLength(i, input.valueAsNumber));
    const word = Object.assign(document.createElement("span"), { className: "word", textContent: t("blocksLabel") });
    stepper.append(input, word);
    part.append(stepper);
    part.addEventListener("wheel", (e) => {
      e.preventDefault();
      setLength(i, state.lengths[i] + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });
    return part;
  }));

  let position = 0;
  $("tags").replaceChildren(...state.stops.map((rgb, i) => {
    const hex = toHex(rgb);
    const tag = Object.assign(document.createElement("div"), { className: "tag", title: t("tagTip", hex.toUpperCase()) });
    tag.classList.toggle("selected", i === state.selectedStop);
    tag.style.left = `${position / total * 100}%`;
    tag.style.background = hex;
    position += state.lengths[i] || 0;
    const input = Object.assign(document.createElement("input"), { type: "color", value: hex });
    input.addEventListener("click", () => { state.selectedStop = i; });
    input.addEventListener("input", () => {
      state.stops[i] = fromHex(input.value);
      state.selectedStop = i;
      // Leave the bar alone while the picker is open; redraw only what depends on the colour.
      tag.style.background = input.value;
      renderGradientRows();
    });
    input.addEventListener("change", renderGradient);
    tag.addEventListener("contextmenu", (e) => { e.preventDefault(); copy(hex.toUpperCase(), "statusHex", hex.toUpperCase()); });
    tag.append(input);
    if (state.stops.length > 2) {
      const remove = Object.assign(document.createElement("span"), { className: "remove", textContent: "×" });
      remove.addEventListener("click", (e) => { e.stopPropagation(); removeStop(i); });
      tag.append(remove);
    }
    return tag;
  }));
  $("stopLeft").disabled = $("stopRight").disabled = state.stops.length >= MAX_STOPS;
}

function gradientRow(steps, kept) {
  const row = Object.assign(document.createElement("div"), { className: kept ? "gradient-row kept" : "gradient-row" });
  const body = Object.assign(document.createElement("div"), { className: "body" });
  const strip = Object.assign(document.createElement("div"), { className: "strip" });
  for (const { rgb } of steps) strip.appendChild(document.createElement("span")).style.background = toHex(rgb);
  const blocks = Object.assign(document.createElement("div"), { className: "blocks" });
  blocks.append(...steps.map(({ entry }) => tile(entry, toggleMine)));
  body.append(strip, blocks);
  row.append(body);
  if (kept) {
    const side = Object.assign(document.createElement("div"), { className: "side" });
    const add = Object.assign(document.createElement("button"), { type: "button", textContent: "＋", title: t("rowAddTip") });
    add.addEventListener("click", () => addToMine(steps.map(({ entry }) => entry)));
    const remove = Object.assign(document.createElement("button"), { type: "button", textContent: "×", title: t("rowRemoveTip") });
    remove.addEventListener("click", () => { state.keptRows.splice(state.keptRows.indexOf(kept), 1); renderGradientRows(); });
    side.append(add, remove);
    row.append(side);
  }
  return row;
}

function renderGradientRows() {
  if (!state.palette) return;
  for (const id of ["gradientRows", "historyRows"]) $(id).classList.toggle("one-row", $("oneRow").checked);
  $("gradientRows").replaceChildren(gradientRow(gradient(), null));
  // History is a separate list below. Its rows remember block ids, so after a
  // change of Minecraft version they show only the blocks that still exist.
  $("history").hidden = !state.keptRows.length;
  $("historyRows").replaceChildren(...state.keptRows.map((saved) => gradientRow(
    saved.map(({ rgb, id }) => ({ rgb, entry: state.byId.get(id) })).filter((step) => step.entry), saved)));
}

function renderGradient() {
  if (!state.palette) return;
  renderGradientBar();
  renderGradientRows();
}

function addToMine(entries) {
  for (const entry of entries) if (!state.mine.includes(entry.id)) state.mine.push(entry.id);
  mineChanged();
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
      node = tile(entry, () => {
        // On the gradient tab a collected block recolours the selected tag.
        if (!$("gradientPane").hidden) {
          state.stops[state.selectedStop] = [...entry.rgb];
          renderGradient();
          return;
        }
        // Stay on the harmonies tab if that is where the user is working.
        if ($("harmonyPane").hidden) showTab("match");
        $("search").value = "";
        setColour(entry.rgb);
      });
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

async function copy(text, statusKey, ...statusArgs) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  setStatus(statusKey, ...statusArgs);
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
  matchTiles.clear();
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
  for (const tab of ["Match", "Harmony", "Gradient"]) {
    const active = tab.toLowerCase() === name;
    $(`tab${tab}`).setAttribute("aria-selected", active);
    $(`${tab.toLowerCase()}Pane`).hidden = !active;
  }
}

function renderAll() {
  renderPicker();
  renderMatch();
  renderHarmonies();
  renderGradient();
  renderMine();
  renderSaved();
}

function wire() {
  $("tabMatch").addEventListener("click", () => showTab("match"));
  $("tabHarmony").addEventListener("click", () => showTab("harmony"));
  Object.assign(state.harmony.base, rgbToHsv(state.colour));
  drawWheel();
  wireWheel();
  $("tabGradient").addEventListener("click", () => showTab("gradient"));

  wirePicker();
  $("hex").addEventListener("change", () => setColour(fromHex($("hex").value) || state.colour));
  $("harmonyColour").addEventListener("input", () => setColour(fromHex($("harmonyColour").value)));
  $("harmonyHex").addEventListener("change", () => setColour(fromHex($("harmonyHex").value) || state.colour));
  $("search").addEventListener("input", renderMatch);
  $("spread").addEventListener("input", renderMatch);
  // The number next to the slider can be typed; out-of-range values are pulled back in.
  const typed = $("spreadValue");
  const applyTyped = (final) => {
    const value = Math.round(typed.valueAsNumber);
    if (Number.isNaN(value)) { if (final) typed.value = $("spread").value; return; }
    const clamped = Math.min(Number($("spread").max), Math.max(Number($("spread").min), value));
    if (final) typed.value = clamped;
    if (!final && clamped !== value) return;
    $("spread").value = clamped;
    renderMatch();
  };
  typed.addEventListener("input", () => applyTyped(false));
  typed.addEventListener("change", () => applyTyped(true));
  for (const id of ["noFalling", "noTechnical", "smooth", "side"]) {
    $(id).addEventListener("change", () => { renderMatch(); renderHarmonies(); renderGradient(); });
  }

  for (const id of ["unique", "withDeco", "oklab"]) $(id).addEventListener("change", renderGradient);
  $("oneRow").addEventListener("change", renderGradientRows);
  $("stopLeft").addEventListener("click", () => addStop(true));
  $("stopRight").addEventListener("click", () => addStop(false));
  $("swapStops").addEventListener("click", () => {
    state.stops.reverse();
    state.lengths.reverse();
    state.selectedStop = state.stops.length - 1 - state.selectedStop;
    renderGradient();
  });
  $("randomStops").addEventListener("click", () => {
    state.stops = state.stops.map(() => [0, 0, 0].map(() => Math.floor(Math.random() * 256)));
    renderGradient();
  });
  $("keepRow").addEventListener("click", () => {
    state.keptRows.unshift(gradient().map(({ rgb, entry }) => ({ rgb, id: entry.id })));
    renderGradientRows();
  });
  $("clearHistory").addEventListener("click", () => { state.keptRows = []; renderGradientRows(); });
  $("stopsFromPalette").addEventListener("click", () => {
    const colours = state.mine.map((id) => state.byId.get(id)).filter(Boolean).map((entry) => [...entry.rgb]);
    if (colours.length < 2) return;
    state.stops = colours.slice(0, MAX_STOPS);
    state.lengths = state.stops.slice(1).map(() => Math.max(MIN_LENGTH, Math.round(DEFAULT_LENGTH / 2)));
    state.selectedStop = 0;
    showTab("gradient");
    renderGradient();
  });
  $("addGradient").addEventListener("click", () => addToMine(gradient().map(({ entry }) => entry)));

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
