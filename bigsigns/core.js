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
//
// There are five styles: large letters, one to a sign; narrow ones of the same
// kind, two to a sign; either of these with thin strokes mixed in; and thin
// ones, whose stems are all the half-wide ▌.

export const ROWS = 8, LINES = 4;
// Widths in the default Minecraft font, in text pixels: what a character
// advances the pen by, and how much of that is drawn.
export const BLOCK_ADVANCE = 9, BLOCK_INK = 8, SPACE_ADVANCE = 4;
// ▌ is the left half of a block: half the ink, and the pen moves on just past it.
export const STEM_ADVANCE = 5, STEM_INK = 4;
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
  "_": "...../...../...../...../...../...../...../#####",
  "\\": "#..../#..../.#.../.#.../..#../..#../...#./...#.",
  "|": "#/#/#/#/#/#/#/#",
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
  "_": ".../.../.../.../.../.../.../###",
  "\\": "#../#../#../.#./.#./..#/..#/..#",
  " ": "../../../../../../../..",
};

// Thin letters mix all the characters: stems are the half-wide ▌, as thick as the
// bars made of ▀ and ▄, and stems set a little inwards from one line to the next
// stand for slanted strokes. A letter is about half as wide as a large one. There is no
// half-wide character half a line tall, so these are written line by line, not
// as a grid. One string per sign line, one mark per character or empty stretch:
//   |  ▌ thin stem          ^  ▀ upper bar     _  ▄ lower bar     #  █ block
//   .  empty, wide as |     :  empty, wide as a bar     ;  empty 4 px     ,  empty 2 px
const THIN = {
  A: [".|^|", "|__|", "|::|", "|::|"],
  B: ["|^^", "|__|", "|::|", "|__|"],
  C: ["|^^", "|", "|", "|__"],
  D: ["|^^", "|::|", "|::|", "|__"],
  E: ["|^^", "|__", "|", "|__"],
  F: ["|^^", "|__", "|", "|"],
  G: ["|^^", "|", "|:^|", "|__|"],
  H: ["|::|", "|__|", "|::|", "|::|"],
  I: ["^^^", ":,|", ":,|", "___"],
  J: [".::|", ".::|", "|::|", "|__|"],
  K: ["|:|", "|_", "|^", "|:|"],
  L: ["|", "|", "|", "|__"],
  M: ["||;;||", "|;,|.,|", "|::|", "|::|"],
  N: ["|::|", "|_:|", "|:^|", "|::|"],
  O: ["|^^|", "|::|", "|::|", "|__|"],
  P: ["|^^|", "|__|", "|", "|"],
  Q: ["|^^|", "|::|", "|:_|", "|__|_"],
  R: ["|^^|", "|__|", "|^", "|:|"],
  S: ["|^^|", "|__", ".::|", "|__|"],
  T: ["^^^", ":,|", ":,|", ":,|"],
  U: ["|::|", "|::|", "|::|", "|__|"],
  V: ["|::|", "|::|", ".|;;|", ":,|"],
  W: ["|::|", "|::|", "|;,|.,|", "||;;||"],
  X: ["|::|", ".|_|", ".|^|", "|::|"],
  Y: ["|::|", ".|;;|", ":,|", ":,|"],
  Z: ["^^^", "::_", ":^", "___"],

  0: ["|^^|", "|:_|", "|^:|", "|__|"],
  1: ["^|", ":|", ":|", "_|_"],
  2: [".^^|", ".__|", "|", "|__"],
  3: ["^^|", "__|", "::|", "__|"],
  4: ["|::|", "|__|", ".::|", ".::|"],
  5: ["|^^", "|__", ".::|", ".__|"],
  6: ["|^^", "|__", "|::|", "|__|"],
  7: ["|^^|", ".::|", ".::|", ".::|"],
  8: ["|^^|", "|__|", "|^^|", "|__|"],
  9: ["|^^|", "|__|", ".::|", ".__|"],

  "Б": ["|^^", "|__", "|::|", "|__|"],
  "Г": ["|^^", "|", "|", "|"],
  "Д": [".|^|", "|::|", "|::|", "|__|"],
  "Ё": ["^:^", "|^^", "|^", "|__"],
  "Ж": ["|:|:|", "._|_", ".^|^", "|:|:|"],
  "З": ["^^|", ":_|", "::|", "__|"],
  "И": ["|::|", "|:_|", "|^:|", "|::|"],
  "Й": [":^", "|:_|", "|^:|", "|::|"],
  "Л": [".|^|", "|::|", "|::|", "|::|"],
  "П": ["|^^|", "|::|", "|::|", "|::|"],
  "У": ["|::|", ".|_|", ":.|", "._"],
  "Ф": ["|^|^|", "|_|_|", ":.|", ":.|"],
  "Ц": ["|::|", "|::|", "|::|", "|__|_"],
  "Ч": ["|::|", "|__|", ".::|", ".::|"],
  "Ш": ["|:|:|", "|:|:|", "|:|:|", "|_|_|"],
  "Щ": ["|:|:|", "|:|:|", "|:|:|", "|_|_|_"],
  "Ъ": ["^|", ":|__", ":|::|", ":|__|"],
  "Ы": ["|:::|", "|__:|", "|::|;|", "|__|;|"],
  "Ь": ["|", "|__", "|::|", "|__|"],
  "Э": ["|^^|", ".:_|", ".::|", "|__|"],
  "Ю": ["|:|^|", "|_|:|", "|:|:|", "|:|_|"],
  "Я": ["|^^|", "|__|", ".^:|", "|::|"],

  ".": ["", "", "", "_"],
  ",": ["", "", "", "|"],
  "!": ["|", "|", "", "|"],
  "?": ["^^|", ":_|", ":|", ":_"],
  "-": ["", "__", "", ""],
  "+": ["", "_|_", ":|", ""],
  ":": ["", "_", "", "_"],
  "/": ["::|", ":;|", ";,|", "|"],
  "(": [";|", "|", "|", ";|"],
  ")": ["|", ";|", ";|", "|"],
  "=": ["", "^^", "__", ""],
  "_": ["", "", "", "__"],
  "\\": ["|", ";,|", ":;|", "::|"],
  "|": ["|", "|", "|", "|"],
  " ": [":.", "", "", ""],
};
// Large and narrow letters with thin strokes mixed in: stems stay a whole block
// thick, while slanted strokes and inner stems are the half-wide ▌. Written
// with the same marks; letters not listed here keep their plain shape.
const LARGE_MIXED = {
  K: ["#::|", "#_^", "#^_", "#::|"],
  M: ["#|:;;|#", "#;,|.|;,#", "#:,|:,#", "#:::#"],
  N: ["#|::;#", "#;,|:.,#", "#;;;|..#", "#::|;#"],
  R: ["#^^^_", "#:::#", "#^^^", "#::.,|"],
  V: ["#:::#", ";#:..#", ";;;|;;;|", "::||"],
  W: ["#:::#", "#:,|:,#", "#;,|.|;,#", "#|:;;|#"],
  X: ["#:::#", ":,|,_,|", ":,|,^,|", "#:::#"],
  Y: ["#:::#", ";;;|;;;|", "::#", "::#"],
  Z: ["^^^^^", "::.,|", ":,|", "_____"],
  7: ["^^^^^", ":::|", "::,|", ":.|"],
  "И": ["#::|;#", "#;;;|..#", "#;,|:.,#", "#|::;#"],
  "Й": ["#:^:#", "#::|;#", "#:|:;#", "#|::;#"],
  "Я": ["_^^^#", "#:::#", ":^^^#", ";|:::#"],
  "/": [":::;|", "::,|", ":,|", "|"],
  "\\": ["|", ":,|", "::,|", ":::;|"],
};
const NARROW_MIXED = {
  K: ["#:;|", "#_", "#^", "#:;|"],
  M: ["#|;;|#", "#.,|;,#", "#::#", "#::#"],
  N: ["#|:;#", "#.|;;#", "#:|;#", "#:;|#"],
  R: ["#^^_", "#::#", "#^^", "#:.,|"],
  W: ["#::#", "#::#", "#.,|;,#", "#|;;|#"],
  X: ["#::#", ".,|,_,|", ".,|,^,|", "#::#"],
  Z: ["^^^^", "::;|", ".,|", "____"],
  7: ["^^^^", "::;|", ":.|", ":|"],
  "Ж": ["|:#:|", "._#_", ".^#^", "|:#:|"],
  "И": ["#:;|#", "#:|;#", "#.|;;#", "#|:;#"],
  "Й": ["#;^.#", "#:;|#", "#.,|;,#", "#|:;#"],
  "Ф": ["#^|^#", "#_|_#", "::|", "::|"],
  "Ш": ["#.,|;,#", "#.,|;,#", "#.,|;,#", "#__#"],
  "Щ": ["#.,|;,#", "#.,|;,#", "#.,|;,#", "#__#|"],
  "Ы": ["#::;|", "#__;|", "#:#;|", "#_#;|"],
  "Ю": ["|;#^#", "||#:#", "|;#:#", "|;#_#"],
  "Я": ["_^^#", "#::#", ":^^#", ";|::#"],
};
// Styles whose letters are written with marks, and the grid font each falls back on.
const MARKED = { thin: THIN, largeMixed: LARGE_MIXED, narrowMixed: NARROW_MIXED };

const MARKS = { "|": "▌", "^": "▀", "_": "▄", "#": "█" };
const EMPTY = { ".": 5, ":": 9, ";": 4, ",": 2 };

/** How far a character moves the pen. */
const advanceOf = (cell) => (cell === "▌" ? STEM_ADVANCE : BLOCK_ADVANCE);

export const STYLES = ["large", "largeMixed", "narrow", "narrowMixed", "thin"];
// One letter to a sign in these; two in the others.
const SINGLE = new Set(["large", "largeMixed"]);

/**
 * A letter as the pieces to draw: {width, lines}, lines being four lists of
 * {cell, at} — a character and where its left edge belongs, in text pixels
 * from the left of the letter. null when the font has no such letter.
 * style: one of STYLES.
 */
export function letter(character, style = "large") {
  const upper = character.toUpperCase(), name = SAME[upper] || upper;
  const marked = (MARKED[style] || {})[name];
  if (marked) {
    let width = 0;
    const lines = marked.map((marks) => {
      const pieces = [];
      let at = 0;
      for (const mark of marks) {
        if (mark in EMPTY) { at += EMPTY[mark]; continue; }
        pieces.push({ cell: MARKS[mark], at });
        at += advanceOf(MARKS[mark]);
      }
      width = Math.max(width, at);
      return pieces;
    });
    return { width, lines };
  }
  const shape = (!SINGLE.has(style) && NARROW[name]) || SHAPES[name];
  if (!shape) return null;
  const grid = shape.split("/").map((row) => [...row].map((cell) => cell === "#"));
  const lines = Array.from({ length: LINES }, (_, line) => {
    const upper2 = grid[line * 2], lower = grid[line * 2 + 1], pieces = [];
    upper2.forEach((on, column) => {
      const cell = on ? (lower[column] ? "█" : "▀") : lower[column] ? "▄" : null;
      if (cell) pieces.push({ cell, at: column * BLOCK_ADVANCE });
    });
    return pieces;
  });
  return { width: grid[0].length * BLOCK_ADVANCE, lines };
}

/** Every character the font can draw, for the help text. */
export const CHARACTERS = [...Object.keys(SHAPES), ...Object.keys(SAME)];

/**
 * One sign line.
 *
 * wanted: the characters of the line, left to right: [{cell, at}], `at` being
 *         where the left edge belongs, in text pixels from the left edge of
 *         the picture.
 * span:   the width of the whole picture, which is centred on the sign.
 * Returns {text, blocks: [{x, cell}], width, error}: the text to type, where
 * the game then draws each character (x in text pixels from the middle of the
 * sign), the width of the line, and how far the worst one is from its place.
 */
export function layoutLine(wanted, span) {
  const target = (at) => -Math.floor(span / 2) + at;
  // Runs of characters standing side by side, and the empty stretches between them.
  const runs = [];
  for (const { cell, at } of wanted) {
    const last = runs.at(-1);
    if (last && last.end === at) { last.cells.push({ cell, at }); last.end = at + advanceOf(cell); }
    else runs.push({ start: at, end: at + advanceOf(cell), cells: [{ cell, at }] });
  }
  if (!runs.length) return { text: "", blocks: [], width: 0, error: 0 };
  const gaps = runs.slice(1).map((run, i) => run.start - runs[i].end);
  // A stretch is rarely a whole number of spaces: try the count on either side.
  const choices = gaps.map((gap) => [Math.max(1, Math.floor(gap / SPACE_ADVANCE)), Math.max(1, Math.ceil(gap / SPACE_ADVANCE))]);
  const most = Math.ceil(span / SPACE_ADVANCE) + 2;
  const inked = runs.reduce((sum, run) => sum + run.end - run.start, 0);

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
          for (const { cell, at } of run.cells) {
            const off = Math.abs(x - target(at));
            worst = Math.max(worst, off); total += off;
            blocks.push({ x, cell });
            x += advanceOf(cell);
          }
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
    text += run.cells.map((piece) => piece.cell).join("");
    if (r < best.between.length) text += " ".repeat(best.between[r]);
  });
  text += " ".repeat(best.trailing);
  return { text, blocks: best.blocks, width: best.width, error: best.error };
}

// Two letters on a sign stand one space apart: a whole empty column would not fit.
const LETTER_GAP = SPACE_ADVANCE;
// Characters further than this from their place make a letter look broken.
const MAX_ERROR = 2;

/** Width in text pixels of letters standing side by side on one sign. */
function spanOf(letters) {
  return letters.reduce((sum, one) => sum + one.width, 0) + (letters.length - 1) * LETTER_GAP;
}

/** The four lines of a sign showing these letters (see `letter`) side by side. */
export function signLines(letters) {
  const span = spanOf(letters);
  return Array.from({ length: LINES }, (_, line) => {
    const wanted = [];
    let left = 0;
    for (const one of letters) {
      for (const { cell, at } of one.lines[line]) wanted.push({ cell, at: left + at });
      left += one.width + LETTER_GAP;
    }
    return layoutLine(wanted, span);
  });
}

/**
 * Text -> signs: [{characters, lines}]; lines is null for a character the font
 * does not have. Outside the large styles neighbouring letters share a sign
 * wherever the pair fits and comes out straight.
 */
export function signsFor(text, style = "large") {
  const characters = [...text].filter((character) => character !== "\n" && character !== "\r");
  const pairs = !SINGLE.has(style), signs = [];
  for (let i = 0; i < characters.length; i++) {
    const first = letter(characters[i], style);
    if (!first) { signs.push({ characters: characters[i], lines: null }); continue; }
    // A space stays a sign of its own, so every word starts on a fresh sign.
    const pairable = pairs && i + 1 < characters.length && characters[i] !== " " && characters[i + 1] !== " ";
    const second = pairable ? letter(characters[i + 1], style) : null;
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
