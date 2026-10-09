// Hover hints in the site's own style, in place of the browser's `title` tooltips.
// Importing this module is enough: elements keep setting `title` as usual.

const OFFSET = 14, EDGE = 6;
const tip = Object.assign(document.createElement("div"), { className: "hover-tip", hidden: true });
let shown = null;

/** The hinted element under the pointer; its `title` moves to `data-tip` so the browser shows nothing itself. */
function hinted(target) {
  const el = target instanceof Element ? target.closest("[title], [data-tip]") : null;
  if (!el) return null;
  if (el.hasAttribute("title")) {
    const text = el.getAttribute("title");
    el.removeAttribute("title");
    el.dataset.tip = text;
    // An icon-only control was named by its title.
    if (text && el.matches("button, input, select") && !el.hasAttribute("aria-label")) el.setAttribute("aria-label", text);
  }
  return el.dataset.tip ? el : null;
}

function place(e) {
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = e.clientX + OFFSET, y = e.clientY + OFFSET;
  if (x + w > innerWidth - EDGE) x = e.clientX - OFFSET - w;
  if (y + h > innerHeight - EDGE) y = e.clientY - OFFSET - h;
  tip.style.left = `${Math.max(EDGE, x)}px`;
  tip.style.top = `${Math.max(EDGE, y)}px`;
}

function hide() {
  shown = null;
  tip.hidden = true;
}

function move(e) {
  const el = e.pointerType === "touch" || e.buttons ? null : hinted(e.target);
  if (!el) { hide(); return; }
  if (el !== shown || tip.textContent !== el.dataset.tip) {
    shown = el;
    tip.textContent = el.dataset.tip;
    // A modal dialog covers everything outside it.
    const host = el.closest("dialog") || document.body;
    if (tip.parentNode !== host) host.append(tip);
    tip.hidden = false;
  }
  place(e);
}

document.addEventListener("pointerover", move);
document.addEventListener("pointermove", move);
document.addEventListener("pointerdown", hide);
document.addEventListener("scroll", hide, true);
document.addEventListener("keydown", hide);
document.documentElement.addEventListener("pointerleave", hide);
