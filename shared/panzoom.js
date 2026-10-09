// Zoomable / pannable view: wheel or pinch zooms under the pointer, drag pans.

export class PanZoom {
  /** content is an absolutely positioned child of viewport; onChange fires after every move. */
  constructor(viewport, content, { min = 0.02, max = 40, onChange } = {}) {
    Object.assign(this, { viewport, content, min, max, onChange });
    this.scale = 1; this.tx = 0; this.ty = 0; this.w = 0; this.h = 0;
    const pointers = new Map();
    const local = (e) => {
      const r = viewport.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 1.25 : 0.8, ...local(e));
    }, { passive: false });

    viewport.addEventListener("pointerdown", (e) => {
      // Elements marked data-no-pan (e.g. drag handles) handle their own pointer.
      if (e.target.closest("[data-no-pan]")) return;
      viewport.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
    });
    viewport.addEventListener("pointermove", (e) => {
      const before = pointers.get(e.pointerId);
      if (!before) return;
      const now = local(e);
      pointers.set(e.pointerId, now);
      if (pointers.size === 1) {
        this.tx += now[0] - before[0];
        this.ty += now[1] - before[1];
        this.apply();
      } else if (pointers.size === 2) {
        const other = [...pointers].find(([id]) => id !== e.pointerId)[1];
        const was = Math.hypot(before[0] - other[0], before[1] - other[1]);
        const is = Math.hypot(now[0] - other[0], now[1] - other[1]);
        if (was > 0) this.zoomBy(is / was, (now[0] + other[0]) / 2, (now[1] + other[1]) / 2);
      }
    });
    const release = (e) => pointers.delete(e.pointerId);
    viewport.addEventListener("pointerup", release);
    viewport.addEventListener("pointercancel", release);
  }

  setSize(w, h) { this.w = w; this.h = h; }

  /** Scale the content to fit the viewport; false if the viewport is not laid out. */
  fit() {
    const vw = this.viewport.clientWidth, vh = this.viewport.clientHeight;
    if (!vw || !vh || !this.w || !this.h) return false;
    this.scale = Math.min(vw / this.w, vh / this.h);
    this.tx = (vw - this.w * this.scale) / 2;
    this.ty = (vh - this.h * this.scale) / 2;
    this.apply();
    return true;
  }

  zoomBy(factor, cx = this.viewport.clientWidth / 2, cy = this.viewport.clientHeight / 2) {
    const target = this.scale * factor;
    if (!this.w || target < this.min || target > this.max) return;
    this.tx = cx - (cx - this.tx) * factor;
    this.ty = cy - (cy - this.ty) * factor;
    this.scale = target;
    this.apply();
  }

  reset100() { if (this.w) this.zoomBy(1 / this.scale); }

  /** Client (mouse event) coordinates -> content pixels. */
  toContent(clientX, clientY) {
    const r = this.viewport.getBoundingClientRect();
    return [(clientX - r.left - this.tx) / this.scale, (clientY - r.top - this.ty) / this.scale];
  }

  /** Content pixels -> viewport-relative CSS pixels. */
  toView(x, y) { return [x * this.scale + this.tx, y * this.scale + this.ty]; }

  apply() {
    this.content.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
    if (this.onChange) this.onChange();
  }
}
