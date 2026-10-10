// Big letters for Minecraft signs: one letter per sign, drawn with the block
// characters of the game's font. No DOM access.
//
// A sign has 4 lines. A line of block characters gives two rows of "pixels":
// █ fills both, ▀ the upper one, ▄ the lower one. So a letter is a grid 8 rows
// tall and a few columns wide.
//
// The game centres every line on its own and a space is narrower than a block,
// so the columns of different lines only meet if each line is padded with the
// right number of spaces. layoutLine works that out from the font's widths.

export const ROWS = 8, LINES = 4;
// Widths in the default Minecraft font, in text pixels: what a character
// advances the pen by, and how much of that is drawn.
export const BLOCK_ADVANCE = 9, BLOCK_INK = 8, SPACE_ADVANCE = 4;
export const LINE_WIDTH = 90;     // the widest line a sign accepts
export const LINE_PITCH = 10;     // from the top of one line to the top of the next
export const MAX_COLUMNS = Math.floor(LINE_WIDTH / BLOCK_ADVANCE);

// Letters as rows of "#" (filled) and "." separated by "/", top row first.
const SHAPES = {
  A: ".###./#...#/#...#/#...#/#####/#...#/#...#/#...#",
  B: "####./#...#/#...#/####./#...#/#...#/#...#/####.",
  C: ".###./#...#/#..../#..../#..../#..../#...#/.###.",
  D: "####./#...#/#...#/#...#/#...#/#...#/#...#/####.",
  E: "#####/#..../#..../####./#..../#..../#..../#####",
  F: "#####/#..../#..../####./#..../#..../#..../#....",
  G: ".###./#...#/#..../#..../#.###/#...#/#...#/.###.",
  H: "#...#/#...#/#...#/#####/#...#/#...#/#...#/#...#",
  I: "###/.#./.#./.#./.#./.#./.#./###",
  J: "..###/...#./...#./...#./...#./#..#./#..#./.##..",
  K: "#...#/#..#./#.#../##.../##.../#.#../#..#./#...#",
  L: "#..../#..../#..../#..../#..../#..../#..../#####",
  M: "#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#/#...#",
  N: "#...#/##..#/##..#/#.#.#/#.#.#/#..##/#..##/#...#",
  O: ".###./#...#/#...#/#...#/#...#/#...#/#...#/.###.",
  P: "####./#...#/#...#/#...#/####./#..../#..../#....",
  Q: ".###./#...#/#...#/#...#/#...#/#.#.#/#..#./.##.#",
  R: "####./#...#/#...#/#...#/####./#.#../#..#./#...#",
  S: ".####/#..../#..../.###./....#/....#/....#/####.",
  T: "#####/..#../..#../..#../..#../..#../..#../..#..",
  U: "#...#/#...#/#...#/#...#/#...#/#...#/#...#/.###.",
  V: "#...#/#...#/#...#/#...#/#...#/.#.#./.#.#./..#..",
  W: "#...#/#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#",
  X: "#...#/#...#/.#.#./..#../..#../.#.#./#...#/#...#",
  Y: "#...#/#...#/.#.#./..#../..#../..#../..#../..#..",
  Z: "#####/....#/...#./..#../..#../.#.../#..../#####",

  0: ".###./#...#/#..##/#.#.#/#.#.#/##..#/#...#/.###.",
  1: "..#../.##../..#../..#../..#../..#../..#../.###.",
  2: ".###./#...#/....#/...#./..#../.#.../#..../#####",
  3: ".###./#...#/....#/..##./....#/....#/#...#/.###.",
  4: "...#./..##./.#.#./#..#./#..#./#####/...#./...#.",
  5: "#####/#..../#..../####./....#/....#/#...#/.###.",
  6: ".###./#...#/#..../####./#...#/#...#/#...#/.###.",
  7: "#####/....#/....#/...#./..#../..#../..#../..#..",
  8: ".###./#...#/#...#/.###./#...#/#...#/#...#/.###.",
  9: ".###./#...#/#...#/#...#/.####/....#/#...#/.###.",

  "Б": "#####/#..../#..../####./#...#/#...#/#...#/####.",
  "Г": "#####/#..../#..../#..../#..../#..../#..../#....",
  "Д": "..###./.#..#./.#..#./.#..#./.#..#./.#..#./######/#....#",
  "Ё": ".#.#./#####/#..../####./#..../#..../#..../#####",
  "Ж": "#.#.#/#.#.#/#.#.#/.###./.###./#.#.#/#.#.#/#.#.#",
  "З": ".###./#...#/....#/..##./....#/....#/#...#/.###.",
  "И": "#...#/#...#/#..##/#.#.#/#.#.#/##..#/#...#/#...#",
  "Й": "..#../#...#/#..##/#.#.#/#.#.#/##..#/#...#/#...#",
  "Л": "..###/.#..#/.#..#/.#..#/.#..#/.#..#/.#..#/#...#",
  "П": "#####/#...#/#...#/#...#/#...#/#...#/#...#/#...#",
  "У": "#...#/#...#/#...#/.####/....#/....#/#...#/.###.",
  "Ф": "..#../.###./#.#.#/#.#.#/#.#.#/.###./..#../..#..",
  "Ц": "#...#./#...#./#...#./#...#./#...#./#...#./######/.....#",
  "Ч": "#...#/#...#/#...#/#...#/.####/....#/....#/....#",
  "Ш": "#.#.#/#.#.#/#.#.#/#.#.#/#.#.#/#.#.#/#.#.#/#####",
  "Щ": "#.#.#./#.#.#./#.#.#./#.#.#./#.#.#./#.#.#./######/.....#",
  "Ъ": "##..../.#..../.#..../.####./.#...#/.#...#/.#...#/.####.",
  "Ы": "#....#/#....#/#....#/###..#/#..#.#/#..#.#/#..#.#/###..#",
  "Ь": "#..../#..../#..../####./#...#/#...#/#...#/####.",
  "Э": ".###./#...#/....#/..###/....#/....#/#...#/.###.",
  "Ю": "#..##./#.#..#/#.#..#/###..#/#.#..#/#.#..#/#.#..#/#..##.",
  "Я": ".####/#...#/#...#/#...#/.####/..#.#/.#..#/#...#",

  ".": "../../../../../../##/##",
  ",": "../../../../../.#/.#/#.",
  "!": "##/##/##/##/##/../##/##",
  "?": ".###./#...#/....#/...#./..#../..#../...../..#..",
  "-": "...../...../...../#####/#####/...../...../.....",
  "+": "...../..#../..#../#####/#####/..#../..#../.....",
  ":": "../##/##/../../##/##/..",
  "/": "....#/....#/...#./...#./..#../..#../.#.../.#...",
  "(": ".#/#./#./#./#./#./#./.#",
  ")": "#./.#/.#/.#/.#/.#/.#/#.",
  "=": "...../...../#####/...../...../#####/...../.....",
  " ": ".../.../.../.../.../.../.../...",
};
// Cyrillic letters that look like Latin ones.
const SAME = { "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X" };

// Narrower shapes of the same letters, for two letters on one sign: four columns
// where the letter allows it. Letters missing here have only their wide shape.
const NARROW = {
  A: ".##./#..#/#..#/#..#/####/#..#/#..#/#..#",
  B: "###./#..#/#..#/###./#..#/#..#/#..#/###.",
  C: ".###/#.../#.../#.../#.../#.../#.../.###",
  D: "###./#..#/#..#/#..#/#..#/#..#/#..#/###.",
  E: "####/#.../#.../###./#.../#.../#.../####",
  F: "####/#.../#.../###./#.../#.../#.../#...",
  G: ".##./#..#/#.../#.../#.##/#..#/#..#/.###",
  H: "#..#/#..#/#..#/####/#..#/#..#/#..#/#..#",
  J: "..##/...#/...#/...#/...#/#..#/#..#/.##.",
  K: "#..#/#..#/#.#./##../##../#.#./#..#/#..#",
  L: "#.../#.../#.../#.../#.../#.../#.../####",
  N: "#..#/##.#/##.#/#.##/#.##/#..#/#..#/#..#",
  O: ".##./#..#/#..#/#..#/#..#/#..#/#..#/.##.",
  P: "###./#..#/#..#/#..#/###./#.../#.../#...",
  Q: ".##./#..#/#..#/#..#/#..#/#..#/.##./...#",
  R: "###./#..#/#..#/#..#/###./#.#./#..#/#..#",
  S: ".###/#.../#.../.##./...#/...#/...#/###.",
  T: "###/.#./.#./.#./.#./.#./.#./.#.",
  U: "#..#/#..#/#..#/#..#/#..#/#..#/#..#/.##.",
  V: "#.#/#.#/#.#/#.#/#.#/#.#/.#./.#.",
  X: "#..#/#..#/#..#/.##./.##./#..#/#..#/#..#",
  Y: "#.#/#.#/#.#/.#./.#./.#./.#./.#.",
  Z: "####/...#/...#/..#./.#../#.../#.../####",

  0: ".##./#..#/#..#/#.##/##.#/#..#/#..#/.##.",
  1: ".#./##./.#./.#./.#./.#./.#./###",
  2: ".##./#..#/...#/..#./.#../#.../#.../####",
  3: "###./...#/...#/.##./...#/...#/...#/###.",
  4: "#..#/#..#/#..#/####/...#/...#/...#/...#",
  5: "####/#.../#.../###./...#/...#/...#/###.",
  6: ".##./#.../#.../###./#..#/#..#/#..#/.##.",
  7: "####/...#/...#/..#./..#./.#../.#../.#..",
  8: ".##./#..#/#..#/.##./#..#/#..#/#..#/.##.",
  9: ".##./#..#/#..#/#..#/.###/...#/...#/.##.",

  "Б": "####/#.../#.../###./#..#/#..#/#..#/###.",
  "Г": "####/#.../#.../#.../#.../#.../#.../#...",
  "Д": ".###./.#.#./.#.#./.#.#./.#.#./.#.#./#####/#...#",
  "Ё": "#..#/####/#.../###./#.../#.../#.../####",
  "З": "###./...#/...#/.##./...#/...#/...#/###.",
  "И": "#..#/#..#/#.##/#.##/##.#/##.#/#..#/#..#",
  "Й": ".##./#..#/#.##/#.##/##.#/##.#/#..#/#..#",
  "Л": ".###/.#.#/.#.#/.#.#/.#.#/.#.#/.#.#/#..#",
  "П": "####/#..#/#..#/#..#/#..#/#..#/#..#/#..#",
  "У": "#..#/#..#/#..#/.###/...#/...#/...#/###.",
  "Ц": "#..#./#..#./#..#./#..#./#..#./#..#./#####/....#",
  "Ч": "#..#/#..#/#..#/#..#/.###/...#/...#/...#",
  "Ъ": "##.../.#.../.#.../.###./.#..#/.#..#/.#..#/.###.",
  "Ы": "#...#/#...#/#...#/##..#/#.#.#/#.#.#/#.#.#/##..#",
  "Ь": "#.../#.../#.../###./#..#/#..#/#..#/###.",
  "Э": ".##./#..#/...#/.###/...#/...#/#..#/.##.",
  "Ю": "#..#./#.#.#/#.#.#/###.#/#.#.#/#.#.#/#.#.#/#..#.",
  "Я": ".###/#..#/#..#/#..#/.###/.#.#/#..#/#..#",

  "?": ".##./#..#/...#/..#./.#../.#../..../.#..",
  "-": ".../.../.../###/###/.../.../...",
  "+": ".../.#./.#./###/###/.#./.#./...",
  "/": "..#/..#/..#/.#./.#./#../#../#..",
  "=": ".../.../###/.../.../###/.../...",
  " ": "../../../../../../../..",
};

/**
 * The letter's grid: 8 rows of booleans, or null when the font has no such
 * letter. With `narrow`, the letter's narrower shape where it has one.
 */
export function glyph(character, narrow = false) {
  const upper = character.toUpperCase(), name = SAME[upper] || upper;
  const shape = (narrow && NARROW[name]) || SHAPES[name];
  return shape ? shape.split("/").map((row) => [...row].map((cell) => cell === "#")) : null;
}

/** Every character the font can draw, for the help text. */
export const CHARACTERS = [...Object.keys(SHAPES), ...Object.keys(SAME)];

/**
 * One sign line.
 *
 * wanted: the blocks of the line, left to right: [{cell, at}], cell being "█",
 *         "▀" or "▄" and `at` where its left edge should be, in text pixels
 *         from the left edge of the picture.
 * span:   the width of the whole picture, which is centred on the sign.
 * Returns {text, blocks: [{x, cell}], width, error}: the text to type, where
 * the game then draws each block (x in text pixels from the middle of the
 * sign), the width of the line, and how far the worst block is from its place.
 */
export function layoutLine(wanted, span) {
  const target = (at) => -Math.floor(span / 2) + at;
  // Runs of blocks standing side by side, and the empty stretches between them.
  const runs = [];
  for (const { cell, at } of wanted) {
    const last = runs.at(-1);
    if (last && last.start + last.cells.length * BLOCK_ADVANCE === at) last.cells.push(cell);
    else runs.push({ start: at, cells: [cell] });
  }
  if (!runs.length) return { text: "", blocks: [], width: 0, error: 0 };
  const gaps = runs.slice(1).map((run, i) => run.start - runs[i].start - runs[i].cells.length * BLOCK_ADVANCE);
  // A stretch is rarely a whole number of spaces: try the count on either side.
  const choices = gaps.map((gap) => [Math.max(1, Math.floor(gap / SPACE_ADVANCE)), Math.ceil(gap / SPACE_ADVANCE)]);
  const most = Math.ceil(span / SPACE_ADVANCE) + 2;
  const inked = runs.reduce((sum, run) => sum + run.cells.length, 0) * BLOCK_ADVANCE;

  let best = null;
  const tryWith = (between) => {
    const middle = between.reduce((sum, count) => sum + count, 0);
    for (let leading = 0; leading <= most; leading++) {
      for (let trailing = 0; trailing <= most; trailing++) {
        const width = inked + (leading + middle + trailing) * SPACE_ADVANCE;
        if (width > LINE_WIDTH) break;
        // The game draws a line starting half its width left of the middle.
        let x = -Math.floor(width / 2) + leading * SPACE_ADVANCE, worst = 0, total = 0;
        const blocks = [];
        runs.forEach((run, r) => {
          run.cells.forEach((cell, i) => {
            const off = Math.abs(x - target(run.start + i * BLOCK_ADVANCE));
            worst = Math.max(worst, off); total += off;
            blocks.push({ x, cell });
            x += BLOCK_ADVANCE;
          });
          if (r < between.length) x += between[r] * SPACE_ADVANCE;
        });
        const spaces = leading + middle + trailing;
        if (!best || worst < best.error || (worst === best.error && (total < best.total || (total === best.total && spaces < best.spaces)))) {
          best = { error: worst, total, spaces, width, blocks, leading, trailing, between };
        }
      }
    }
  };
  const each = (index, between) => {
    if (index === choices.length) { tryWith(between); return; }
    for (const count of new Set(choices[index])) each(index + 1, [...between, count]);
  };
  each(0, []);
  // Too wide for a sign however it is padded.
  if (!best) return { text: "", blocks: [], width: 0, error: Infinity };

  let text = " ".repeat(best.leading);
  runs.forEach((run, r) => {
    text += run.cells.join("");
    if (r < best.between.length) text += " ".repeat(best.between[r]);
  });
  text += " ".repeat(best.trailing);
  return { text, blocks: best.blocks, width: best.width, error: best.error };
}

// Two letters on a sign stand one space apart: a whole empty column would not fit.
const LETTER_GAP = SPACE_ADVANCE;
// Blocks further than this from their place make a letter look broken.
const MAX_ERROR = 2;

/** Width in text pixels of letters (grids) standing side by side on one sign. */
function spanOf(grids) {
  return grids.reduce((sum, grid) => sum + grid[0].length * BLOCK_ADVANCE, 0) + (grids.length - 1) * LETTER_GAP;
}

/** The four lines of a sign showing these letters (grids of 8 rows of booleans) side by side. */
export function signLines(grids) {
  const span = spanOf(grids);
  return Array.from({ length: LINES }, (_, line) => {
    const wanted = [];
    let left = 0;
    for (const grid of grids) {
      const upper = grid[line * 2], lower = grid[line * 2 + 1];
      upper.forEach((on, column) => {
        const cell = on ? (lower[column] ? "█" : "▀") : lower[column] ? "▄" : null;
        if (cell) wanted.push({ cell, at: left + column * BLOCK_ADVANCE });
      });
      left += grid[0].length * BLOCK_ADVANCE + LETTER_GAP;
    }
    return layoutLine(wanted, span);
  });
}

/**
 * Text -> signs: [{characters, lines}]; lines is null for a character the font
 * does not have. perSign is 1 or 2: with 2, neighbouring letters share a sign
 * in their narrow shapes wherever the pair fits and comes out straight.
 */
export function signsFor(text, perSign = 1) {
  const characters = [...text].filter((character) => character !== "\n" && character !== "\r");
  const narrow = perSign > 1, signs = [];
  for (let i = 0; i < characters.length; i++) {
    const first = glyph(characters[i], narrow);
    if (!first) { signs.push({ characters: characters[i], lines: null }); continue; }
    // A space stays a sign of its own, so every word starts on a fresh sign.
    const pairable = narrow && i + 1 < characters.length && characters[i] !== " " && characters[i + 1] !== " ";
    const second = pairable ? glyph(characters[i + 1], narrow) : null;
    if (second && spanOf([first, second]) <= LINE_WIDTH) {
      const lines = signLines([first, second]);
      if (lines.every((line) => line.error <= MAX_ERROR)) {
        signs.push({ characters: characters[i] + characters[i + 1], lines });
        i++;
        continue;
      }
    }
    signs.push({ characters: characters[i], lines: signLines([first]) });
  }
  return signs;
}
