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
// The styles: large letters, one to a sign; narrow ones of the same kind, two to
// a sign; either of these with thin strokes mixed in; thin ones, whose stems are
// all the half-wide ▌; tiny ones, three or four to a sign; a stencil, the letter
// cut out of a plate of blocks; and frame letters made of box-drawing characters,
// in double or in single lines.
// Any of them can be slanted.

export const ROWS = 8, LINES = 4;
// Widths in the default Minecraft font, in text pixels: what a character
// advances the pen by, and how much of that is drawn.
export const BLOCK_ADVANCE = 9, BLOCK_INK = 8, SPACE_ADVANCE = 4;
// ▌ is the left half of a block: half the ink, and the pen moves on just past it.
export const STEM_ADVANCE = 5, STEM_INK = 4;
export const LINE_WIDTH = 90;     // the widest line a sign accepts
export const LINE_PITCH = 10;     // from the top of one line to the top of the next
// The kinds of sign: the widest line each accepts, the distance from the top of
// one line to the top of the next, and the size of its face, all in text pixels.
// A hanging sign is smaller but its text is drawn larger, so less fits on it.
export const SIGNS = {
  standing: { width: LINE_WIDTH, pitch: LINE_PITCH, face: [96, 48] },
  hanging: { width: 60, pitch: 9, face: [56, 40] },
};
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
  "#": ".#.#./.#.#./#####/.#.#./.#.#./#####/.#.#./.#.#.",
  "%": "##..#/##..#/...#./..#../..#../.#.../#..##/#..##",
  "*": "...../..#../#.#.#/.###./.###./#.#.#/..#../.....",
  "&": ".##../#..#./#..#./.##../.#..#/#.#.#/#..#./.##.#",
  "@": ".###./#...#/#.###/#.#.#/#.###/#..../#...#/.###.",
  "№": "#..#../##.#.#/##.#.#/#.##../#.##.#/#..#../#..#../#..#..",
  "$": "..#../.####/#.#../.###./..#.#/..#.#/####./..#..",
  "\"": "#.#/#.#/#.#/.../.../.../.../...",
  "'": "#/#/#/././././.",
  ";": "../##/##/../../.#/.#/#.",
  "<": "...#/..#./.#../#.../#.../.#../..#./...#",
  ">": "#.../.#../..#./...#/...#/..#./.#../#...",
  "[": "##/#./#./#./#./#./#./##",
  "]": "##/.#/.#/.#/.#/.#/.#/##",
  "~": "...../...../.#..#/#.#.#/#..#./...../...../.....",
  "^": "..#../.#.#./#...#/...../...../...../...../.....",
  "°": ".#./#.#/.#./.../.../.../.../...",
  "{": "..#/.#./.#./#../#../.#./.#./..#",
  "}": "#../.#./.#./..#/..#/.#./.#./#..",
  "₽": ".###./.#..#/.#..#/.###./.#.../###../.#.../.#...",
  "→": "....../...#../....#./######/######/....#./...#../......",
  "←": "....../..#.../.#..../######/######/.#..../..#.../......",
  "↑": "..#../.###./#.#.#/..#../..#../..#../..#../..#..",
  "↓": "..#../..#../..#../..#../..#../#.#.#/.###./..#..",
  "↗": "....../..####/....##/...#.#/..#..#/.#..../#...../......",
  "↖": "....../####../##..../#.#.../#..#../....#./.....#/......",
  "↘": "....../#...../.#..../..#..#/...#.#/....##/..####/......",
  "↙": "....../.....#/....#./#..#../#.#.../##..../####../......",
  "↔": "....../.#..#./#....#/######/######/#....#/.#..#./......",
  "↕": "..#../.###./#.#.#/..#../..#../#.#.#/.###./..#..",
  "♥": ".##.##./#######/#######/#######/.#####./..###../...#.../.......",
  "★": "...#.../..###../#######/.#####./..###../.##.##./##...##/.......",
  "☺": ".#####./#.....#/#.#.#.#/#.....#/#.#.#.#/#..#..#/#.....#/.#####.",
  "☻": "......../.##..##./.##..##./...##.../..####../..####../..#..#../........",
  "✓": "......./......#/.....##/....##./#..##../####.../.##..../.......",
  "✗": "...../#...#/##.##/.###./.###./##.##/#...#/.....",
  "⌂": "...#.../..###../.#####./#######/.#####./.##.##./.##.##./.##.##.",
  "⚔": "......#/.....##/....##./#..##../.###.../..##.../.#..#../#......",
  "⛏": ".####../#....#./.....##/....#.#/...#..#/..#..../.#...../#......",
  "◆": "..###../.#####./#######/#######/.#####./..###../...#.../.......",
  "«": "...../..#.#/.#.#./#.#../#.#../.#.#./..#.#/.....",
  "»": "...../#.#../.#.#./..#.#/..#.#/.#.#./#.#../.....",
  "—": "......./......./......./#######/#######/......./......./.......",
  "…": "...../...../...../...../...../...../#.#.#/#.#.#",
  "•": "../../../##/##/../../..",
  "€": "..###/.#.../####./.#.../####./.#.../.#.../..###",
  "¥": "#...#/#...#/.#.#./#####/..#../#####/..#../..#..",
  "元": ".###../....../######/.#.#../.#.#../.#.#../#..#.#/#..###",
  "円": "#####/#.#.#/#.#.#/#####/#...#/#...#/#...#/#..##",
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
  "#": ".../#.#/###/#.#/#.#/###/#.#/...",
  "%": "#..#/#..#/...#/..#./.#../#.../#..#/#..#",
  "*": ".../#.#/.#./###/.#./#.#/.../...",
  "$": ".#./###/#../###/..#/..#/###/.#.",
  "~": "..../..../.#.#/#.#./..../..../..../....",
  "^": ".#./#.#/.../.../.../.../.../...",
  "₽": ".##./.#.#/.#.#/.##./.#../###./.#../.#..",
  "♥": ".#.#./#####/#####/#####/.###./..#../...../.....",
  "★": "..#../..#../#####/.###./.###./#.#.#/#...#/.....",
  "☻": "##..##/##..##/..##../.####./.####./.#..#./....../......",
  "✓": "...../....#/....#/...#./#.#../##.../.#.../.....",
  "⌂": "..#../.###./#####/.###./.#.#./.#.#./.#.#./.....",
  "⚔": "....#/...##/#.##./.##../.##../#..#./...../.....",
  "⛏": ".###./#...#/...##/..#.#/.#.../#..../...../.....",
  "◆": ".###./#####/#####/.###./..#../...../...../.....",
  "—": "...../...../...../#####/#####/...../...../.....",
  "€": ".###/#.../###./#.../###./#.../#.../.###",
  "¥": "#.#/#.#/#.#/###/.#./###/.#./.#.",
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
  "*": ["","_|_","^|^",""],
  "\"": ["|;|","","",""],
  "'": ["|","","",""],
  ";": ["","_","","|"],
  "<": [":|","|","|",":|"],
  ">": ["|",":|",":|","|"],
  "[": ["|^","|","|","|_"],
  "]": ["^|",":|",":|","_|"],
  "~": ["","^_","",""],
  "→": [":;|","__||","^^||",":;|"],
  "←": ["..|","||__","||^^","..|"],
  "↑": [".,.|",".,|||",".,.|",".,.|"],
  "↓": [".,.|",".,.|",".,|||",".,.|"],
  "↗": [".^^|","::||",":,|",";|"],
  "↖": ["|^^","||",":;|","::,|"],
  "↘": [";|",":,|","::||",".__|"],
  "↙": ["::,|",":;|","||","|__"],
  "↔": [".|;;|","|__|","|^^|",".|;;|"],
  "↕": [".,|||",".,.|",".,.|",".,|||"],
  "«": [".|.|","|.|","|.|",".|.|"],
  "»": ["|.|",".|.|",".|.|","|.|"],
  "—": ["","___","",""],
  "…": ["","","","|.|.|"],
  "•": ["","_","^",""],
  "^": [".|","|.|","",""],
  "°": ["|^|",".^","",""],
  "{": [".|^","|","|",".|_"],
  "}": ["^|",":.|",":.|","_|"],
  "#": [":|:|","_|_|_","^|^|^",":|:|"],
  "%": ["^:|",";;;|",";,|","|:_"],
  "&": [".|^|",".|_|","|^:|","|__|"],
  "@": ["|^^|","|.|^|","|.|_|","|__"],
  "№": ["|::|;|^|","|_:|;.^","|:^|;.^","|::|"],
  "$": ["|^|^","|_|_",".:|:|","._|_|"],
  "€": [":|^^","_|_","^|^",":|__"],
  "₽": [":|^^|",":|__|","_|_",":|"],
  "¥": ["|:.|",".|;|","_|_","^|^"],
  "元": [".^^","___",".|;|","|:|_"],
  "円": ["|^|^|","|_|_|","|::.|","|::.|"],
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
  X: [";|:::|", ":^_^", ":_^_", ";|:::|"],
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
  X: ["|:::|", ".^_^", "._^_", "|:::|"],
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
// Tiny letters: thin stems one bar apart, three or four letters to a sign.
// Written with the same marks.
const TINY = {
  A: ["|^|", "|_|", "|:|", "|:|"],
  B: ["|^|", "|_|", "|:|", "|_|"],
  C: ["|^", "|", "|", "|_"],
  D: ["|^", "|:|", "|:|", "|_"],
  E: ["|^", "|_", "|", "|_"],
  F: ["|^", "|_", "|", "|"],
  G: ["|^", "|", "|:|", "|_|"],
  H: ["|:|", "|_|", "|:|", "|:|"],
  I: ["|", "|", "|", "|"],
  J: [".:|", ".:|", "|:|", "|_|"],
  K: ["|:|", "|_", "|^", "|:|"],
  L: ["|", "|", "|", "|_"],
  M: ["^^^", "|;|;|", "|:;|", "|:;|"],
  N: ["|:|", "||;|", "|;||", "|:|"],
  O: ["|^|", "|:|", "|:|", "|_|"],
  P: ["|^|", "|_|", "|", "|"],
  Q: ["|^|", "|:|", "|:|", "|_||"],
  R: ["|^|", "|_|", "|^", "|:|"],
  S: ["|^", "|_", ".:|", "._|"],
  T: ["^^", ".,|", ".,|", ".,|"],
  U: ["|:|", "|:|", "|:|", "|_|"],
  V: ["|:|", "|:|", "|:|", ".,|"],
  W: ["|:;|", "|:;|", "|;|;|", "___"],
  X: ["|:|", "._", ".^", "|:|"],
  Y: ["|:|", "|_|", ".,|", ".,|"],
  Z: ["^^", ":|", "|", "__"],

  0: ["|^|", "|;||", "||;|", "|_|"],
  1: ["^|", ":|", ":|", ":|"],
  2: [".^|", "._|", "|", "|_"],
  3: ["^|", "_|", ":|", "_|"],
  4: ["|:|", "|_|", ".:|", ".:|"],
  5: ["|^", "|_", ".:|", "._|"],
  6: ["|^", "|_", "|:|", "|_|"],
  7: ["|^|", ".:|", ".:|", ".:|"],
  8: ["|^|", "|_|", "|^|", "|_|"],
  9: ["|^|", "|_|", ".:|", "._|"],

  "Б": ["|^", "|_", "|:|", "|_|"],
  "Г": ["|^", "|", "|", "|"],
  "Д": ["|^|", "|:|", "|:|", "__"],
  "Ё": ["|^", "|_", "|", "|_"],
  "Ж": ["|;|;|", "___", "^^^", "|;|;|"],
  "З": ["^|", "_|", ":|", "_|"],
  "И": ["|:|", "|;||", "||;|", "|:|"],
  "Й": [".^", "|;||", "||;|", "|:|"],
  "Л": [".^|", ".|;|", ".|;|", "|:|"],
  "П": ["|^|", "|:|", "|:|", "|:|"],
  "У": ["|:|", "|_|", ".:|", "._|"],
  "Ф": ["|^|", "|_|", ".,|", ".,|"],
  "Ц": ["|:|", "|:|", "|:|", "|_||"],
  "Ч": ["|:|", "|_|", ".:|", ".:|"],
  "Ш": ["|;|;|", "|;|;|", "|;|;|", "___"],
  "Щ": ["|;|;|", "|;|;|", "|;|;|", "___|"],
  "Ъ": ["^|", ":|_", ":|:|", ":|_|"],
  "Ы": ["|::|", "|_:|", "|:|;|", "|_|;|"],
  "Ь": ["|", "|_", "|:|", "|_|"],
  "Э": ["|^|", "._|", ".:|", "|_|"],
  "Ю": ["|;|^|", "|||:|", "|;|:|", "|;|_|"],
  "Я": ["|^|", "|_|", ".^|", "|:|"],

  ".": ["", "", "", "_"],
  ",": ["", "", "", ";|"],
  "!": ["|", "|", "", "|"],
  "?": ["^|", "_|", "", ";|"],
  "-": ["", "_", "", ""],
  "+": ["", "_|_", "", ""],
  ":": ["", "|", "", "|"],
  "/": [":;|", ":|", ";|", "|"],
  "\\": ["|", ";|", ":|", ":;|"],
  "(": [";|", "|", "|", ";|"],
  ")": ["|", ";|", ";|", "|"],
  "=": ["", "^", "_", ""],
  "_": ["", "", "", "__"],
  "|": ["|", "|", "|", "|"],
  "*": ["","_|_","^|^",""],
  "\"": ["|;|","","",""],
  "'": ["|","","",""],
  ";": ["","_","","|"],
  "<": [":|","|","|",":|"],
  ">": ["|",":|",":|","|"],
  "[": ["|^","|","|","|_"],
  "]": ["^|",":|",":|","_|"],
  "~": ["","^_","",""],
  " ": [":", "", "", ""],
};

// Frame letters: the double-line box characters of the font, three cells wide.
// Written with the characters themselves, one cell each; a space is an empty cell.
const BOX = {
  A: ["╔═╗", "╠═╣", "║ ║", "╩ ╩"],
  B: ["╦═╗", "╠═╣", "║ ║", "╩═╝"],
  C: ["╔══", "║", "║", "╚══"],
  D: ["╦═╗", "║ ║", "║ ║", "╩═╝"],
  E: ["╔══", "╠══", "║", "╚══"],
  F: ["╔══", "╠══", "║", "╩"],
  G: ["╔══", "║", "║═╗", "╚═╝"],
  H: ["╦ ╦", "╠═╣", "║ ║", "╩ ╩"],
  I: ["╦", "║", "║", "╩"],
  J: ["  ╦", "  ║", "║ ║", "╚═╝"],
  K: ["╦ ╦", "╠═╝", "╠═╗", "╩ ╩"],
  L: ["╦", "║", "║", "╚══"],
  M: ["╔╦╗", "║║║", "║ ║", "╩ ╩"],
  N: ["╔╗╦", "║║║", "║║║", "╩╚╝"],
  O: ["╔═╗", "║ ║", "║ ║", "╚═╝"],
  P: ["╔═╗", "╠═╝", "║", "╩"],
  Q: ["╔═╗", "║ ║", "║ ║", "╚═╬"],
  R: ["╔═╗", "╠╦╝", "║╚╗", "╩ ╩"],
  S: ["╔══", "╚═╗", "  ║", "══╝"],
  T: ["═╦═", " ║", " ║", " ╩"],
  U: ["╦ ╦", "║ ║", "║ ║", "╚═╝"],
  V: ["╦  ╦", "║  ║", "╚╗╔╝", " ╚╝"],
  W: ["╦ ╦", "║ ║", "║║║", "╚╩╝"],
  X: ["╗ ╔", "╚╦╝", "╔╩╗", "╝ ╚"],
  Y: ["╦ ╦", "╚╦╝", " ║", " ╩"],
  Z: ["══╗", "╔═╝", "║", "╚══"],

  0: ["╔═╗", "║║║", "║║║", "╚═╝"],
  1: ["═╗", " ║", " ║", "═╩═"],
  2: ["╔═╗", "╔═╝", "║", "╚══"],
  3: ["══╗", "══╣", "  ║", "══╝"],
  4: ["╦ ╦", "╚═╣", "  ║", "  ╩"],
  5: ["╔══", "╚═╗", "  ║", "══╝"],
  6: ["╔══", "╠═╗", "║ ║", "╚═╝"],
  7: ["══╗", "  ║", "  ║", "  ╩"],
  8: ["╔═╗", "╠═╣", "║ ║", "╚═╝"],
  9: ["╔═╗", "╚═╣", "  ║", "══╝"],

  "Б": ["╔══", "╠═╗", "║ ║", "╚═╝"],
  "Г": ["╔══", "║", "║", "╩"],
  "Д": [" ╔╗", " ║║", " ║║", "╔╩╩╗"],
  "Ё": ["╔══", "╠══", "║", "╚══"],
  "Ж": ["╗║╔", "╚╬╝", "╔╬╗", "╝║╚"],
  "З": ["══╗", "══╣", "  ║", "══╝"],
  "И": ["╦ ╦", "║╔╣", "╠╝║", "╩ ╩"],
  "Й": ["╦═╦", "║╔╣", "╠╝║", "╩ ╩"],
  "Л": ["╔═╗", "║ ║", "║ ║", "╝ ╩"],
  "П": ["╔═╗", "║ ║", "║ ║", "╩ ╩"],
  "У": ["╦ ╦", "╚═╣", "  ║", "══╝"],
  "Ф": ["╔╦╗", "╚╬╝", " ║", " ╩"],
  "Ц": ["╦ ╦", "║ ║", "║ ║", "╚═╩╗"],
  "Ч": ["╦ ╦", "╚═╣", "  ║", "  ╩"],
  "Ш": ["╦╦╦", "║║║", "║║║", "╚╩╝"],
  "Щ": ["╦╦╦", "║║║", "║║║", "╚╩╩╗"],
  "Ъ": ["═╗", " ╠═╗", " ║ ║", " ╚═╝"],
  "Ы": ["╦  ╦", "╠═╗║", "║ ║║", "╚═╝╩"],
  "Ь": ["╦", "╠═╗", "║ ║", "╚═╝"],
  "Э": ["══╗", " ═╣", "  ║", "══╝"],
  "Ю": ["╦╔═╗", "╠╣ ║", "║║ ║", "╩╚═╝"],
  "Я": ["╔═╗", "╚╦╣", "╔╝║", "╩ ╩"],

  ".": ["", "", "", "▄"],
  ",": ["", "", "", "╝"],
  "!": ["║", "║", "", "▄"],
  "?": ["╔═╗", " ╔╝", " ║", " ▄"],
  "-": ["", "══", "", ""],
  "+": ["", "═╬═", "", ""],
  ":": ["", "▄", "", "▄"],
  "/": ["  ╔", " ╔╝", "╔╝", "╝"],
  "\\": ["╗", "╚╗", " ╚╗", "  ╚"],
  "(": ["╔", "║", "║", "╚"],
  ")": ["╗", "║", "║", "╝"],
  "=": ["", "══", "══", ""],
  "_": ["", "", "", "══"],
  "|": ["║", "║", "║", "║"],
  "#": ["","╬╬","╬╬",""],
  "[": ["╔═","║","║","╚═"],
  "]": ["═╗"," ║"," ║","═╝"],
  "°": ["╔╗","╚╝","",""],
  "—": ["","═══","",""],
  "\"": ["║║","","",""],
  "'": ["║","","",""],
  ";": ["","▄","","╝"],
  " ": ["  ", "", "", ""],
};

// The same letters in single lines: every double-line character has a single-line twin.
const SINGLE_LINE = { "═": "─", "║": "│", "╔": "┌", "╗": "┐", "╚": "└", "╝": "┘", "╠": "├", "╣": "┤", "╦": "┬", "╩": "┴", "╬": "┼" };

const MARKS = { "|": "▌", "^": "▀", "_": "▄", "#": "█" };
const EMPTY = { ".": 5, ":": 9, ";": 4, ",": 2 };
// Where each style looks for a letter written with marks, in order. The tiny
// and the frame fonts borrow the thin shape of a symbol they have none for:
// thin strokes sit better among their letters than blocks do.
const MARKED = { thin: [THIN], largeMixed: [LARGE_MIXED], narrowMixed: [NARROW_MIXED], tiny: [TINY, THIN], box: [THIN], line: [THIN] };

// How the default font draws each character used here: 8 rows of 8 pixels, the
// leftmost pixel the highest bit. The same in every version checked (1.12 - 26.x).
export const INK = {
  "█": [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
  "▀": [0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00],
  "▄": [0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff],
  "▌": [0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0, 0xf0],
  "═": [0x00, 0x00, 0xff, 0x00, 0xff, 0x00, 0x00, 0x00],
  "║": [0x36, 0x36, 0x36, 0x36, 0x36, 0x36, 0x36, 0x36],
  "╔": [0x00, 0x00, 0x3f, 0x30, 0x37, 0x36, 0x36, 0x36],
  "╗": [0x00, 0x00, 0xfe, 0x06, 0xf6, 0x36, 0x36, 0x36],
  "╚": [0x36, 0x36, 0x37, 0x30, 0x3f, 0x00, 0x00, 0x00],
  "╝": [0x36, 0x36, 0xf6, 0x06, 0xfe, 0x00, 0x00, 0x00],
  "╠": [0x36, 0x36, 0x37, 0x30, 0x37, 0x36, 0x36, 0x36],
  "╣": [0x36, 0x36, 0xf6, 0x06, 0xf6, 0x36, 0x36, 0x36],
  "╦": [0x00, 0x00, 0xff, 0x00, 0xf7, 0x36, 0x36, 0x36],
  "╩": [0x36, 0x36, 0xf7, 0x00, 0xff, 0x00, 0x00, 0x00],
  "╬": [0x36, 0x36, 0xf7, 0x00, 0xf7, 0x36, 0x36, 0x36],
  "─": [0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00],
  "│": [0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18],
  "┌": [0x00, 0x00, 0x00, 0x00, 0x1f, 0x18, 0x18, 0x18],
  "┐": [0x00, 0x00, 0x00, 0x00, 0xf8, 0x18, 0x18, 0x18],
  "└": [0x18, 0x18, 0x18, 0x18, 0x1f, 0x00, 0x00, 0x00],
  "┘": [0x18, 0x18, 0x18, 0x18, 0xf8, 0x00, 0x00, 0x00],
  "├": [0x18, 0x18, 0x18, 0x18, 0x1f, 0x18, 0x18, 0x18],
  "┤": [0x18, 0x18, 0x18, 0x18, 0xf8, 0x18, 0x18, 0x18],
  "┬": [0x00, 0x00, 0x00, 0x00, 0xff, 0x18, 0x18, 0x18],
  "┴": [0x18, 0x18, 0x18, 0x18, 0xff, 0x00, 0x00, 0x00],
  "┼": [0x18, 0x18, 0x18, 0x18, 0xff, 0x18, 0x18, 0x18],
};

/** How far a character moves the pen: one pixel past the last column it draws in. */
const advanceOf = (cell) => {
  const columns = INK[cell].reduce((all, row) => all | row, 0);
  let width = 8;
  while (width > 0 && !(columns & (1 << (8 - width)))) width--;
  return width + 1;
};

// How many letters share a sign in each style.
const PER_SIGN = { large: 1, largeMixed: 1, stencil: 1, narrow: 2, narrowMixed: 2, thin: 2, box: 3, line: 3, tiny: 4 };
export const STYLES = Object.keys(PER_SIGN);
// Styles drawn with the narrow shapes of the grid font where a letter has no shape of their own.
const NARROW_BASED = new Set(["narrow", "narrowMixed", "thin", "tiny", "box", "line"]);

/** The grid of a letter of the plain fonts: 8 rows of booleans, or null. */
function gridOf(name, narrow) {
  const shape = (narrow && NARROW[name]) || SHAPES[name];
  return shape ? shape.split("/").map((row) => [...row].map((cell) => cell === "#")) : null;
}

/** A grid as pieces, line by line. */
function gridLetter(grid) {
  const lines = Array.from({ length: LINES }, (_, line) => {
    const upper = grid[line * 2], lower = grid[line * 2 + 1], pieces = [];
    upper.forEach((on, column) => {
      const cell = on ? (lower[column] ? "█" : "▀") : lower[column] ? "▄" : null;
      if (cell) pieces.push({ cell, at: column * BLOCK_ADVANCE });
    });
    return pieces;
  });
  return { width: grid[0].length * BLOCK_ADVANCE, lines };
}

/**
 * A stencil: a plate of blocks with the letter cut out of it. The letter loses
 * two of its eight rows, so that the plate closes above and below it.
 */
function stencil(grid) {
  const rows = grid.map((row) => row.join());
  // Drop from each half a row that repeats its neighbour, which most stems have.
  const drop = (from, to) => {
    for (let i = from; i < to; i++) if (rows[i] === rows[i + 1]) return i;
    return from;
  };
  const gone = new Set([drop(1, 3), drop(4, 6) + 1]);
  const letterRows = grid.filter((_, i) => !gone.has(i));
  const width = grid[0].length + 2, full = Array(width).fill(true);
  const plate = [full, ...letterRows.map((row) => [true, ...row.map((on) => !on), true]), full];
  return gridLetter(plate);
}

/**
 * A letter as the pieces to draw: {width, lines}, lines being four lists of
 * {cell, at} — a character and where its left edge belongs, in text pixels
 * from the left of the letter. null when the font has no such letter.
 * style: one of STYLES.
 * compact: draw from the narrow shapes whatever the style, for a sign too small for the large ones.
 */
export function letter(character, style = "large", compact = false) {
  const upper = character.toUpperCase(), name = SAME[upper] || upper;
  if ((style === "box" || style === "line") && Object.hasOwn(BOX, name)) {
    // One cell per character, whatever its own width.
    const drawn = (cell) => (style === "line" && SINGLE_LINE[cell]) || cell;
    const lines = BOX[name].map((row) => [...row].flatMap((cell, column) => (cell === " " ? [] : [{ cell: drawn(cell), at: column * BLOCK_ADVANCE }])));
    return { width: Math.max(...BOX[name].map((row) => [...row].length)) * BLOCK_ADVANCE, lines };
  }
  const marked = (MARKED[style] || []).find((table) => Object.hasOwn(table, name));
  if (marked) {
    let width = 0;
    const lines = marked[name].map((marks) => {
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
  const grid = gridOf(name, compact || NARROW_BASED.has(style));
  if (!grid) return null;
  return style === "stencil" && name !== " " ? stencil(grid) : gridLetter(grid);
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
 * limit:  the widest line the sign accepts.
 * Returns {text, blocks: [{x, cell}], width, error}: the text to type, where
 * the game then draws each character (x in text pixels from the middle of the
 * sign), the width of the line, and how far the worst one is from its place;
 * the error is Infinity when the line cannot be made narrow enough.
 */
export function layoutLine(wanted, span, limit = LINE_WIDTH) {
  const target = (at) => -Math.floor(span / 2) + at;
  // Runs of characters standing side by side, and the empty stretches between
  // them. A pixel of slack keeps cells together whose character is a pixel short.
  const runs = [];
  for (const { cell, at } of wanted) {
    const last = runs.at(-1);
    if (last && at - last.end >= 0 && at - last.end < 2) { last.cells.push({ cell, at }); last.end = at + advanceOf(cell); }
    else runs.push({ start: at, end: at + advanceOf(cell), cells: [{ cell, at }] });
  }
  if (!runs.length) return { text: "", blocks: [], width: 0, error: 0 };
  const gaps = runs.slice(1).map((run, i) => run.start - runs[i].end);
  // A stretch is rarely a whole number of spaces: try the count on either side.
  const choices = gaps.map((gap) => [Math.max(1, Math.floor(gap / SPACE_ADVANCE)), Math.max(1, Math.ceil(gap / SPACE_ADVANCE))]);
  const most = Math.ceil(span / SPACE_ADVANCE) + 2;
  const inked = runs.reduce((sum, run) => sum + run.cells.reduce((width, piece) => width + advanceOf(piece.cell), 0), 0);

  let best = null;
  const tryWith = (between) => {
    const middle = between.reduce((sum, count) => sum + count, 0);
    for (let leading = 0; leading <= most; leading++) {
      for (let trailing = 0; trailing <= most; trailing++) {
        const width = inked + (leading + middle + trailing) * SPACE_ADVANCE;
        if (width > limit) break;
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

// Letters on a sign stand one space apart: a whole empty column would not fit.
const LETTER_GAP = SPACE_ADVANCE;
// Characters further than this from their place make a letter look broken.
const MAX_ERROR = 2;
// The plate of a stencil is two columns wider than its letter, five as a rule.
const STENCIL_WIDTH = 7 * BLOCK_ADVANCE;
// Italic: every line stands this far to the right of the one below it.
const SLANT = 3;

/** Width in text pixels of letters standing side by side on one sign. */
function spanOf(letters, italic) {
  return letters.reduce((sum, one) => sum + one.width, 0) + (letters.length - 1) * LETTER_GAP + (italic ? (LINES - 1) * SLANT : 0);
}

/** The four lines of a sign showing these letters (see `letter`) side by side, upright or slanted. */
export function signLines(letters, italic = false, limit = LINE_WIDTH) {
  const span = spanOf(letters, italic);
  return Array.from({ length: LINES }, (_, line) => {
    const wanted = [];
    let left = italic ? (LINES - 1 - line) * SLANT : 0;
    for (const one of letters) {
      for (const { cell, at } of one.lines[line]) wanted.push({ cell, at: left + at });
      left += one.width + LETTER_GAP;
    }
    return layoutLine(wanted, span, limit);
  });
}

/**
 * Text -> signs: [{characters, lines, tooWide}]; lines is null for a character
 * the font does not have, and for one too wide for the sign (tooWide). Where
 * the style allows several letters to a sign, as many neighbouring letters
 * share one as fit and come out straight.
 * limit: the widest line the sign accepts, see SIGNS.
 */
export function signsFor(text, style = "large", italic = false, limit = LINE_WIDTH) {
  // Emoji pickers add an invisible mark after some pictograms: it is no character of its own.
  const characters = [...text].filter((character) => character !== "\n" && character !== "\r" && character !== "\ufe0f");
  const signs = [];
  // A stencil of a large letter, with its frame, is wider than a hanging sign.
  const compact = style === "stencil" && limit < STENCIL_WIDTH;
  for (let i = 0; i < characters.length;) {
    const first = letter(characters[i], style, compact);
    if (!first) { signs.push({ characters: characters[i], lines: null }); i++; continue; }
    // A space stays a sign of its own, so every word starts on a fresh sign.
    const group = [first];
    while (characters[i] !== " " && group.length < PER_SIGN[style]) {
      const next = characters[i + group.length];
      const one = next === undefined || next === " " ? null : letter(next, style, compact);
      if (!one) break;
      group.push(one);
    }
    // The longest run that fits and is not crooked; a single letter always goes on.
    let lines = null;
    for (; group.length > 1; group.pop()) {
      if (spanOf(group, italic) > limit) continue;
      const tried = signLines(group, italic, limit);
      if (tried.every((line) => line.error <= MAX_ERROR)) { lines = tried; break; }
    }
    lines ||= signLines(group, italic, limit);
    // A single letter too wide for the sign, or squeezed crooked: its narrow shape may do better.
    const worstOf = (some) => Math.max(...some.map((line) => line.error));
    if (!compact && group.length === 1 && worstOf(lines) > MAX_ERROR) {
      const narrower = signLines([letter(characters[i], style, true)], italic, limit);
      if (worstOf(narrower) < worstOf(lines)) lines = narrower;
    }
    // If not, it cannot be written at all.
    const tooWide = lines.some((line) => line.error === Infinity);
    signs.push({ characters: characters.slice(i, i + group.length).join(""), lines: tooWide ? null : lines, tooWide });
    i += group.length;
  }
  return signs;
}
