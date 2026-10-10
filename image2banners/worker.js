// One member of the generation pool: turns banner slots into patterns and blocks.
import { loadAssets } from "./assets.js";
import { processCell } from "./core/generate.js";

let assets = null;

self.onmessage = async ({ data }) => {
  try {
    // The first message brings the blocks of the chosen Minecraft version.
    if (data.blockSet) { assets = loadAssets(data.blockSet); return; }
    const result = processCell(data.strip, await assets, data.options);
    self.postMessage({ type: "done", index: data.index, result }, [result.preview.buffer]);
  } catch (error) {
    self.postMessage({ type: "error", message: String((error && error.message) || error) });
  }
};
