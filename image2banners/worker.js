// One member of the generation pool: turns banner slots into patterns and blocks.
import { loadAssets } from "./assets.js";
import { processCell } from "./core/generate.js";

self.onmessage = async ({ data }) => {
  try {
    const result = processCell(data.strip, await loadAssets(), data.options);
    self.postMessage({ type: "done", index: data.index, result }, [result.preview.buffer]);
  } catch (error) {
    self.postMessage({ type: "error", message: String((error && error.message) || error) });
  }
};
