// Big Signs: type a word, get the four lines to paste into each sign.
import "../shared/tooltip.js";
import { bindLanguageSelect, getLang } from "../shared/i18n.js";
import { BLOCK_INK, LINE_PITCH, LINES, signsFor, STEM_INK, STYLES } from "./core.js";
import { STRINGS } from "./strings.js";

const TEXT_KEY = "bigsigns.text", STYLE_KEY = "bigsigns.style";
// The face of a sign in text pixels, and how much each is enlarged on the page.
const FACE_W = 96, FACE_H = 48, SCALE = 3;
const BOARD = "#a8825a", GRAIN = "#9a7650", INK = "#000000";

const $ = (id) => document.getElementById(id);

const state = {
  lang: getLang(),
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
  document.title = `Big Signs — ${t("subtitle")}`;
  $("text").placeholder = t("placeholder");
  $("status").textContent = t(...state.status);
  render();
}

// ---------- signs ----------
/** The sign as the game draws it: every block where the font puts it. */
function picture(lines) {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_W * SCALE; canvas.height = FACE_H * SCALE;
  const context = canvas.getContext("2d");
  context.fillStyle = BOARD;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = GRAIN;
  for (let y = 12; y < FACE_H; y += 12) context.fillRect(0, y * SCALE, canvas.width, SCALE);
  context.fillStyle = INK;
  const top = (FACE_H - LINES * LINE_PITCH) / 2 + 1, half = BLOCK_INK / 2;
  (lines || []).forEach((line, index) => {
    for (const { x, cell } of line.blocks) {
      // █ and the thin ▌ are a whole line tall, ▀ and ▄ half of it.
      const tall = cell === "█" || cell === "▌";
      const y = top + index * LINE_PITCH + (cell === "▄" ? half : 0);
      context.fillRect((FACE_W / 2 + x) * SCALE, y * SCALE, (cell === "▌" ? STEM_INK : BLOCK_INK) * SCALE, (tall ? BLOCK_INK : half) * SCALE);
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
    caption.append(Object.assign(document.createElement("span"), { textContent: t(sign.lines ? "blank" : "noGlyph") }));
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

function render() {
  const signs = signsFor($("text").value, $("style").value);
  $("signs").replaceChildren(...signs.map(card));
  const unknown = [...new Set(signs.filter((sign) => !sign.lines).map((sign) => sign.characters))];
  $("styleHint").textContent = t(`styleHint_${$("style").value}`);
  $("unknown").hidden = !unknown.length;
  $("unknown").textContent = t("unknown", unknown.join(" "));
}

function textChanged() {
  state.copied.clear();
  try {
    localStorage.setItem(TEXT_KEY, $("text").value);
    localStorage.setItem(STYLE_KEY, $("style").value);
  } catch { /* storage unavailable */ }
  render();
  const count = $("signs").children.length;
  setStatus(count ? "statusSigns" : "statusStart", count);
}

function start() {
  try {
    $("text").value = localStorage.getItem(TEXT_KEY) || "";
    const saved = localStorage.getItem(STYLE_KEY);
    if (STYLES.includes(saved)) $("style").value = saved;
  } catch { /* storage unavailable */ }
  $("text").addEventListener("input", textChanged);
  $("style").addEventListener("change", textChanged);
  $("clear").addEventListener("click", () => { $("text").value = ""; textChanged(); $("text").focus(); });
  bindLanguageSelect($("lang"), (lang) => { state.lang = lang; retranslate(); });
  retranslate();
  textChanged();
}

start();
