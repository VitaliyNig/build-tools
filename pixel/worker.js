// Runs generation off the UI thread.
import { makePalette } from "../shared/mc/palette.js";
import { generate } from "./core/pipeline.js";

self.onmessage = ({ data }) => {
  try {
    const palette = makePalette(data.palette);
    let last = 0;
    const idx = generate(data.source, data.settings, palette, (value) => {
      const now = performance.now();
      if (now - last > 100) { last = now; self.postMessage({ type: "progress", value }); }
    });
    self.postMessage({ type: "done", idx }, [idx.buffer]);
  } catch (error) {
    self.postMessage({ type: "error", message: String((error && error.message) || error) });
  }
};
