// Big Signs: type a word, get the four lines to paste into each sign.
import "../shared/tooltip.js";
import { bindLanguageSelect, getLang } from "../shared/i18n.js";
import { BLOCK_INK, INK, LINES, SIGNS, signsFor, STYLES } from "./core.js";
import { STRINGS } from "./strings.js";

const TEXT_KEY = "bigsigns.text", STYLE_KEY = "bigsigns.style", ITALIC_KEY = "bigsigns.italic";
const SIGN_KEY = "bigsigns.sign";
// How much a text pixel is enlarged in the pictures.
const SCALE = 3;
const BOARD = "#a8825a", GRAIN = "#9a7650", TEXT_COLOUR = "#000000";

const $ = (id) => document.getElementById(id);

const state = {
  lang: getLang(),
  style: STYLES[0],    // the font
  copied: new Set(),   // "sign index:line" of the lines already copied, to keep one's place
  status: ["statusStart"],
};

// ---------- i18n ----------
function t(key, ...args) {
  const value = STRINGS[key][state.lang === "ru" ? 1 : 0];
  return typeof value === "function" ? value(...args) : value;
}

function setStatus(key, ...args) {
  state.status = [key, ...args];
  $("status").textContent = t(...state.status);
  $("status").classList.toggle("error", key.startsWith("err"));
}

function retranslate() {
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
  document.title = `Big Signs — ${t("subtitle")}`;
  $("text").placeholder = t("placeholder");
  $("status").textContent = t(...state.status);
  render();
}

// ---------- signs ----------
/** The kind of sign being written on. */
const signKind = () => SIGNS[$("sign").value];

/** The sign as the game draws it: every block where the font puts it. */
function picture(lines) {
  const { pitch, face: [boardW, FACE_H] } = signKind();
  // Text may reach a little past the edges of a hanging sign's board.
  const FACE_W = Math.max(boardW, signKind().width + 4), LINE_PITCH = pitch;
  const canvas = document.createElement("canvas");
  canvas.width = FACE_W * SCALE; canvas.height = FACE_H * SCALE;
  const context = canvas.getContext("2d");
  context.fillStyle = BOARD;
  context.fillRect((FACE_W - boardW) / 2 * SCALE, 0, boardW * SCALE, canvas.height);
  context.fillStyle = GRAIN;
  for (let y = 12; y < FACE_H; y += 12) context.fillRect((FACE_W - boardW) / 2 * SCALE, y * SCALE, boardW * SCALE, SCALE);
  context.fillStyle = TEXT_COLOUR;
  const top = Math.round((FACE_H - LINES * LINE_PITCH) / 2) + 1;
  (lines || []).forEach((line, index) => {
    for (const { x, cell } of line.blocks) {
      // Pixel by pixel, as the font has the character.
      INK[cell].forEach((row, r) => {
        for (let column = 0; column < BLOCK_INK; column++) {
          if (row & (0x80 >> column)) context.fillRect((FACE_W / 2 + x + column) * SCALE, (top + index * LINE_PITCH + r) * SCALE, SCALE, SCALE);
        }
      });
    }
  });
  return canvas;
}

/** Copy through a selection: the old way, which works where the clipboard API refuses. */
function copyBySelection(text) {
  const area = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
  area.style.cssText = "position: fixed; left: -1000px; top: 0; white-space: pre;";
  document.body.append(area);
  area.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { /* not allowed */ }
  area.remove();
  return copied;
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Refused while the window is only just getting focus, as on the first
    // click after switching back from the game.
    return copyBySelection(text);
  }
}

async function copyLine(text, key, sign, line, button) {
  if (!await writeClipboard(text)) {
    setStatus("errCopy");
    return;
  }
  state.copied.add(key);
  button.classList.add("done");
  setStatus("statusCopied", sign, line);
}

function card(sign, index) {
  const item = document.createElement("div");
  item.className = "sign";
  const blank = sign.lines && sign.lines.every((line) => !line.text);
  const caption = Object.assign(document.createElement("div"), { className: "caption" });
  const name = sign.characters.toUpperCase().replace(/ /g, "␣");
  caption.append(Object.assign(document.createElement("b"), { textContent: name }));
  if (!sign.lines || blank) {
    caption.append(Object.assign(document.createElement("span"), { textContent: t(sign.lines ? "blank" : sign.tooWide ? "tooWide" : "noGlyph") }));
  }
  item.append(picture(sign.lines), caption);
  if (!sign.lines || blank) return item;

  sign.lines.forEach((line, number) => {
    const key = `${index}:${number}`, row = document.createElement("div");
    row.className = "line";
    const label = Object.assign(document.createElement("span"), { className: "number", textContent: number + 1 });
    // Spaces are part of the line: show the text exactly, without collapsing them.
    const text = Object.assign(document.createElement("code"), { textContent: line.text || t("emptyLine") });
    text.classList.toggle("empty", !line.text);
    const button = Object.assign(document.createElement("button"), { type: "button", textContent: "📋", title: t("copyLine", number + 1) });
    button.disabled = !line.text;
    button.classList.toggle("done", state.copied.has(key));
    button.addEventListener("click", () => copyLine(line.text, key, name, number + 1, button));
    row.append(label, text, button);
    item.append(row);
  });
  return item;
}

/** What the font cards show: the start of the typed word, or a few letters of the alphabet. */
function sampleText() {
  const typed = [...$("text").value].filter((character) => character.trim()).slice(0, 4).join("");
  return typed || t("sample");
}

/** One card per font, each with a sign written in it. */
function renderFonts() {
  const sample = sampleText(), italic = $("italic").checked;
  $("fonts").replaceChildren(...STYLES.map((style) => {
    const button = Object.assign(document.createElement("button"), { type: "button", className: "font" });
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", style === state.style);
    // The first sign of the sample: as many letters as the font puts on one.
    const first = signsFor(sample, style, italic, signKind().width)[0];
    const [name, note] = t(`style_${style}`).split(" — ");
    const preview = picture(first && first.lines);
    // Two screen pixels to a text pixel, whatever the size of the sign.
    preview.style.width = `${preview.width / SCALE * 2}px`;
    button.append(preview,
      Object.assign(document.createElement("b"), { textContent: name }),
      Object.assign(document.createElement("span"), { textContent: note }));
    button.addEventListener("click", () => { state.style = style; textChanged(); });
    return button;
  }));
}

function render() {
  renderFonts();
  const signs = signsFor($("text").value, state.style, $("italic").checked, signKind().width);
  $("signs").replaceChildren(...signs.map(card));
  const unknown = [...new Set(signs.filter((sign) => !sign.lines && !sign.tooWide).map((sign) => sign.characters))];
  const wide = [...new Set(signs.filter((sign) => sign.tooWide).map((sign) => sign.characters.toUpperCase()))];
  $("tooWide").hidden = !wide.length;
  $("tooWide").textContent = t("tooWideList", wide.join(" "));
  $("signHint").hidden = $("sign").value !== "hanging";
  $("styleHint").textContent = t(`styleHint_${state.style}`);
  $("unknown").hidden = !unknown.length;
  $("unknown").textContent = t("unknown", unknown.join(" "));
}

function textChanged() {
  state.copied.clear();
  try {
    localStorage.setItem(TEXT_KEY, $("text").value);
    localStorage.setItem(STYLE_KEY, state.style);
    localStorage.setItem(ITALIC_KEY, $("italic").checked ? "1" : "");
    localStorage.setItem(SIGN_KEY, $("sign").value);
  } catch { /* storage unavailable */ }
  render();
  const count = $("signs").children.length;
  setStatus(count ? "statusSigns" : "statusStart", count);
}

function start() {
  try {
    $("text").value = localStorage.getItem(TEXT_KEY) || "";
    const saved = localStorage.getItem(STYLE_KEY);
    if (STYLES.includes(saved)) state.style = saved;
    $("italic").checked = localStorage.getItem(ITALIC_KEY) === "1";
    if (localStorage.getItem(SIGN_KEY) in SIGNS) $("sign").value = localStorage.getItem(SIGN_KEY);
  } catch { /* storage unavailable */ }
  $("text").addEventListener("input", textChanged);
  $("italic").addEventListener("change", textChanged);
  $("sign").addEventListener("change", textChanged);
  $("clear").addEventListener("click", () => { $("text").value = ""; textChanged(); $("text").focus(); });
  bindLanguageSelect($("lang"), (lang) => { state.lang = lang; retranslate(); });
  retranslate();
  textChanged();
}

start();
