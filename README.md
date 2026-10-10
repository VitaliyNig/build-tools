# Build Tools

A static site of small browser tools, served by GitHub Pages from the repository
root. The hub page (`index.html`) lists the tools; each tool lives in its own
folder. There is no build step and no backend: plain HTML, CSS and ES modules.

| Tool | Folder | What it does |
|------|--------|--------------|
| **Graffiti** | `graffiti/` | Minecraft pixel-art generator: an image as a vertical wall of blocks |
| **Palette** | `palette/` | Blocks and decorations by colour, block gradients, shareable palettes |
| **Image2Banners** | `image2banners/` | Image to Minecraft banner art; web port of the app by MARSTeamMC |
| **GeoToSchematic** | external link | KML/GeoJSON outlines to schematics, by reyysun ([site](https://reyysun.github.io/geo-to-schematic/)) |
| **Big Signs** | `bigsigns/` | Big letters for Minecraft signs, one per sign, Latin and Cyrillic; after an idea by SuperFromND ([site](https://superfromnd.gitlab.io/bigsigns/)) |

```
index.html     hub page, built from shared/tools.js
shared/        theme (base.css), tool layout (tool.css), language switch (i18n.js),
               zoom/pan view (panzoom.js), tool registry (tools.js)
shared/mc/     Minecraft block palettes used by Graffiti and Palette: bundled
               versions, the client-JAR importer and colour maths
graffiti/      the Graffiti tool (formerly Pixel; `pixel/` only redirects to it)
palette/       the Palette tool
image2banners/ the Image2Banners tool
tools/         build-palettes.mjs, a Node script that rebuilds the bundled palettes
.nojekyll      turns GitHub's Jekyll processing off
```

## Publishing on GitHub Pages
1. Push the repository to GitHub as `build-tools`.
2. **Settings → Pages → Build and deployment**: source *Deploy from a branch*,
   branch `main`, folder `/ (root)`.
3. The hub is served at `https://<user>.github.io/build-tools/`, Graffiti at `.../graffiti/`.

All links are relative, so the site works under any repository name.

## Running the site locally
ES modules and the worker only load over HTTP, so opening `index.html` from disk
does not work. Any static file server will do, for example from the project root:

```bash
py -m http.server 8765
```

Then open `http://localhost:8765/`.

## Adding a tool
1. Create `<tool>/index.html`. Link `../shared/base.css` for the shared theme
   (and `../shared/tool.css` for the viewport + controls layout), and use
   `../shared/i18n.js` for the shared English/Russian language switch.
2. Add an entry to `TOOLS` in `shared/tools.js` — the hub card is built from it.

A tool hosted on another site needs only the entry: give its full URL as `href`
and set `external: true`, and the card opens it in a new tab.

## Graffiti
Turn a photo or image into a Minecraft **wall** of real blocks: set the canvas
size in blocks, edit the image (including 4-point perspective correction to
straighten an angled photo), map it to actual blocks, then preview and export a
schematic you can paste in-game. Everything runs in the browser; images and JARs
are never uploaded.

### Features
- **Canvas size in blocks** — width × height, up to 1024 × 1024.
- **Image editor** — brightness / contrast / saturation, white balance and
  shadows/highlights; includes 90° rotation.
- **Perspective correction** — drag 4 corner handles onto the subject; the photo
  is warped to a straight rectangle.
- **Minecraft version palettes** — 26.3, 1.21.4 (default) and 1.12.2 are bundled;
  **Add JAR…** reads the blocks and textures of any other version from its
  client `*.jar`.
- **Nearest-block matching** in CIE-Lab, with optional Floyd–Steinberg dithering
  and texture-aware matching against each block's 16×16 pattern.
- **Block filter** — enable/disable blocks by category.
- **Preview + material list** — the mosaic is drawn with the real block textures,
  plus a per-block count table.
- **Export** — a schematic for the result's Minecraft version and a PNG mockup.
- English and Russian interface.

### Typical workflow
1. **Load Image…** (or drop a file on the canvas).
2. Set the **Canvas** width/height in blocks.
3. (Optional) tick **Enable 4-point correction** and drag the red corners onto the
   real corners of your subject. Mouse wheel zooms; drag empty space to pan.
4. Pick the **Palette** version you will build in. Adjust the image controls;
   optionally **Choose blocks…**, set **Dithering** and **Texture influence**.
5. **Generate** → the *Result* tab shows the block grid and material counts.
6. Export the schematic and/or **Export PNG mockup**. The Export panel shows the
   generated result's MC version. To change it, select another palette and click
   **Generate** again.

### Export formats
The schematic is a one-block-thick wall (Width × Height × 1) and its format
follows the version of the palette the result was generated with:

| Minecraft | File | Format | Loads in |
|-----------|------|--------|----------|
| 1.13 and newer | `graffiti.schem` | Sponge Schematic v2 | WorldEdit 7+, FAWE, Litematica, Axiom |
| 1.12 and older | `graffiti.schematic` | MCEdit (numeric block ids) | WorldEdit 6, Schematica |

Sponge v2 is used rather than v3 because every reader of v3 also reads v2.
Versions before 1.13 cannot load `.schem`, and their blockstate names are model
variants rather than block ids, so `shared/mc/legacy.js` maps them to id:data
pairs.

In-game with WorldEdit: put the file in WorldEdit's `schematics` folder, then
`//schem load graffiti` (`//schematic load graffiti` on 1.12) and `//paste`.
Use a palette of the same version as the world: blocks the game does not know
are replaced with air.

Both formats were checked structurally with an independent NBT parser, not by
pasting in every game version. The 1.12 id table in particular is hand-written;
if a block comes out wrong in 1.12, fix its entry in `shared/mc/legacy.js`.

### Adding a Minecraft version
**Add JAR…** parses a client JAR (for example `1.21.4.jar` from
`.minecraft/versions/1.21.4/`) in the browser and keeps the palette in IndexedDB,
so it is stored per browser and per device, and is lost when site data is cleared.

- Only complete opaque cubes with an untinted, unrotated north face are
  included; plants, fluids, transparent blocks, stairs and slabs are skipped.
- JARs without an embedded `version.json` (1.12 and earlier) are labelled from
  the filename, so keep the version number in it.
- For versions before 1.13, variants missing from `shared/mc/legacy.js` are
  skipped, because they could not be exported.
- Versions before 1.8 have no blockstate files and cannot be imported.

Imported versions are shared between Graffiti and Palette.

To bundle a version with the site instead, run the builder on its client JAR
(Node 22+, no dependencies); it uses the same importer as the site:

```bash
node tools/build-palettes.mjs path/to/1.21.4.jar
```

It writes `<version>.json` (blocks, their other sides, fronts and decorations,
with average colours), `<version>.png` (block tiles, north side),
`<version>.faces.png` (the other sides that look different),
`<version>.fronts.png` (blocks that are not cubes but fill the square seen from
the north: shulker boxes, open trapdoors without holes, the composter; and
other looks of a cube: the filled chiseled bookshelf, the inside of a mushroom
block) and
`<version>.deco.png` (decoration tiles, 32×32, with transparency) into `shared/mc/palettes/` and adds the version to `index.json`.
Atlases hold 32 tiles per row, in list order; block tiles are 16×16.

### Browser support
Needs a current browser: module workers, `DecompressionStream`/`CompressionStream`
and `createImageBitmap` (Chrome/Edge 103+, Firefox 114+, Safari 16.4+). Developed
and tested in Chromium only.

### Layout
```
graffiti/
  index.html              page (layout from ../shared/tool.css)
  app.js                  UI: controls, edit canvas, result view, export
  worker.js               generation off the UI thread
  strings.js              UI strings (en/ru)
  core/                   UI-independent logic, no DOM access
    pipeline.js           source image + settings -> block grid
    imageops.js           adjustments, rotation
    warp.js               perspective correction
    resample.js           Lanczos / box resize
    quantize.js           nearest block, dithering, material counts
    texture.js            texture-aware matching
    schematic.js          .schem and .schematic writers

shared/mc/                shared with Palette
  palettes.js             bundled palettes + JARs imported into IndexedDB
  palettes/               bundled versions (see "Adding a Minecraft version")
  palette.js              palette arrays, subsets, atlas cutting
  color.js                sRGB -> CIE-Lab
  zip.js, jar.js          client JAR reader and palette importer
  render.js               isometric picture of a block model, for decorations
  legacy.js               pre-1.13 numeric block ids
```

### Notes
- Palette colours are flat texture averages; in-game shading/biome tints aren't
  modelled, so results are an approximation.
- Images larger than 4096 px on a side are downscaled on load; PNG export is
  capped at 8192 px per side; transparent image areas become white.
- Falling blocks (sand, gravel, concrete powder) are in the palette and will drop
  from an unsupported wall; disable them in **Choose blocks…** if needed.
- `shared/mc/palettes/*.png` contain Minecraft block textures, which are Mojang's
  assets. To publish without them, delete the palette files, empty the list in
  `shared/mc/palettes/index.json`, and let users import their own client JAR.

## Palette
Finds Minecraft blocks by colour. It combines what
[blockcolors.app](https://blockcolors.app/), [HueBlocks](https://1280px.github.io/hueblocks/)
and [Block Palettes](https://www.blockpalettes.com/) each do, as an original
implementation on top of the palettes Graffiti already uses, so it works with any
game version, including ones imported from a client JAR.

- **By colour** — pick a colour or type a HEX code and get the closest
  **blocks** and, separately, the closest **decorations**: plants, leaves and
  glass, and blocks with a shape of their own (anvils, hoppers, cauldrons,
  stairs, slabs, trapdoors), drawn as small 3D pictures. Search by name narrows the list.
- **Harmonies** — a colour wheel with draggable points. Pick a rule (analogous,
  complementary, split complementary, triad, square, compound, shades,
  monochromatic) and the points move together as you drag one; **Custom**
  frees every point. Each colour of
  the scheme is a column with its HEX code and the closest blocks under it.
  The wheel is HSV: hue is the angle, saturation the distance from the centre,
  and a slider sets the brightness.
- **Gradient** — a colour bar with a tag under each of its two to eight
  colours and a length, in blocks, for every part between them. The result is
  the row of blocks closest to the bar. Colours blend in OkLab (evenly spaced
  steps) or plain sRGB; **No repeats** uses every block once; rows can be kept
  below to compare settings. The interface follows HueBlocks.
- **My Palette** — click blocks to collect them. Save palettes in the browser,
  copy the block names, or copy a link that opens the same palette for anyone.
  A click on a collected block searches for similar ones, and **Use my palette
  as colours** turns the collection into gradient stops.
- **Block sides** — many blocks look different from the top, the side and the
  bottom. Those other sides are listed as tiles of their own ("Oak Log Top",
  "Crafting Table Bottom"), and the **Side** filter narrows everything to the
  side you will see: sides for a wall, top for a floor. Blocks that look the
  same all round stay in every setting.
- **Filters** — hide falling blocks (sand, gravel, concrete powder), hide
  technical blocks (command blocks, bedrock, spawners), and prefer plain
  textures over busy ones of the same average colour.

Blocks are full opaque cubes. Blocks drawn with exactly the same picture
(copper and waxed copper, a log and its wood block, a double slab and the block
it is made from) share one tile, marked with how many others it stands for;
its tooltip names them all and a search finds it by any of the names. Decorations are everything else that
has a model: plants and see-through or biome-tinted cubes are drawn flat (biome
tints use the plains colours), other shapes are rendered from their model the
way the inventory shows them. Not listed: blocks the game assembles from parts
depending on their neighbours (fences, walls, glass panes), blocks drawn by code
rather than a model (chests, beds, signs, banners), doors, buttons and levers.
There is no shared gallery: that needs a server, and this site has none.

```
palette/
  index.html, style.css   page and layout
  app.js                  UI: matching, gradient, my palette, saved palettes, links
  core.js                 ranking, filters, OkLab gradients (no DOM access)
  strings.js              UI strings (en/ru)
```

## Big Signs
Turns a word into Minecraft signs with one big letter each. A sign line of the
block characters `█ ▀ ▄` gives two rows of "pixels", so the four lines of a sign
hold a letter 8 rows tall. `▌`, the left half of a block, gives thin stems. For every sign the tool shows the four lines to copy
and paste into it.

The idea, and the trick itself, come from
[Big Sign Letters](https://superfromnd.gitlab.io/bigsigns/) by **SuperFromND**.
This tool is written from scratch around it:
- **Whole words** — type a text and get every sign in order, instead of picking
  letters one at a time.
- **Latin, Cyrillic, digits and punctuation**, in a font of its own, with
  arrows, a few pictograms (heart, star, creeper, house, sword…) and
  typographic marks, which a row of buttons types for you.
- **Exact padding.** The game centres each line separately, and a space (4 px)
  is narrower than a block (9 px), so a letter only comes out straight when
  every line is padded with the right number of spaces. The tool tries the
  paddings and keeps the one that puts the blocks closest to their columns;
  no block ends up more than 2 px off.
- **Two letters on a sign**, in two more styles, with a single space between
  the letters. *Narrow* is the same kind of letter in four columns where it
  allows; a sign line holds 90 px, so two wide letters (Ж, Ш, Ы…) in a row
  still get a sign each. *Thin* draws stems with the half-wide `▌` (4 px, the
  thickness of the bars), which makes letters lighter and narrow enough for
  any two to share a sign. The large and the narrow style also come *with thin
  strokes*: stems stay a block thick, slanted strokes and inner stems are `▌`.
- **More styles.** *Tiny*: thin stems one bar apart, three or four letters to a
  sign. *Stencil*: a plate of blocks with the letter cut out of it. *Frames*:
  thin double lines made of the box characters `═ ║ ╔ ╗ ╚ ╝`, up to three
  letters to a sign, and *thin frames*, the same letters in the single lines
  `─ │ ┌ ┐ └ ┘`. And **slanted**, for any style: every line stands 3 px to
  the right of the one below it.
- **Pixel-exact preview**, drawn from the widths of the game's default font.
- **Hanging signs** too: their lines hold 60 px instead of 90 and stand closer
  together, so fewer letters fit and the widest do not fit at all.

```
bigsigns/
  index.html, style.css   page
  app.js                  UI: text input, sign cards, copy buttons
  strings.js              UI strings (en/ru)
  core.js                 the font, and the padding of sign lines
```

## Image2Banners
Converts an image into banner art: for every banner slot (1 block wide, 2 blocks
tall) it searches for the banner patterns that best reproduce that part of the
picture, and for the blocks behind it. Everything runs in the browser.

This is a web port of [Image2Banners](https://github.com/MARSTeamMC/Image2Banners)
by **MARSTeamMC**, which is an Electron + Python desktop app. The matching
algorithm, the JSON format and the structure export are theirs; the banner
pattern textures in `image2banners/assets/` come from their repository. Their code is licensed under
the BSD 2-Clause License, reproduced in `image2banners/LICENSE-Image2Banners.txt`.

### Features
- **Minecraft version** — the bundled versions or your own client JAR, as in
  Graffiti. It decides which blocks and patterns are used, the syntax of the
  `/give` command and the format of the structure file.
- **Banner matching** — up to 6 patterns per banner (what a loom allows), or more
  with **More than 6 patterns** for banners obtained by command.
- **Blocks behind banners**, chosen by colour, and **layered banners** (a banner
  one block higher overlapping the one below).
- **Banner recipes** — click a banner to see the crafting steps, the block behind
  it and a `/give` command: item components (1.20.5+), item NBT (1.13 – 1.20.4)
  or the numeric form of 1.8 – 1.12.
- **Hide banners** to look at the blocks alone.
- **Save** as PNG, as JSON (reload it later instead of regenerating), as a
  structure `.nbt` for a structure block or as a Sponge `.schem` for WorldEdit,
  FAWE, Litematica and Axiom (both for Minecraft 1.13 and newer). For older
  versions the schematic is an MCEdit `.schematic` (WorldEdit 6, Schematica).
- Multi-threaded: one worker per CPU thread.

Following the usual advice for creative-mode building, all options are on by
default; turn off **More than 6 patterns** and **Use banner pattern items** for
banners you want to craft in survival.

### Loading the structure in-game
Put the `.nbt` file in `saves/<world>/generated/i2b/structures/`, then in a
structure block (Load mode) enter `i2b:<file name>` without `.nbt`. Structure
blocks do not display the real size of art larger than 32×32 blocks. The file
is written for the chosen Minecraft version: its data version, its block names
and its way of storing banner patterns (changed in 1.20.5).

### Fidelity to the original
The banner matching was checked against a reference built from the same
libraries the original uses (scikit-image, OpenCV, Pillow): identical patterns
on the test image. Intentional differences:
- Blocks come from the palette of the chosen Minecraft version (full cubes with
  that version's textures) instead of the original's fixed list, so the blocks
  behind banners differ from the desktop app's. Other sides of a block are used
  where the block can be turned to show them: the end of a log, the top of a
  barrel, the back of a furnace. Shulker boxes, open trapdoors and the composter
  are used too, in versions from 1.13 on.
- The original appends the last pattern once more when a layer brings no
  improvement; the port does not, so the saved list matches the preview.
- The saved PNG is drawn from the final data (crisp blocks, banners placed as in
  game) rather than from the progressive preview.
- JSON files of the desktop app open here; blocks this version lacks are
  replaced. Files saved here name blocks with their states
  (`barrel[facing=up,open=false]`), which the desktop app may not know.

### Layout
```
image2banners/
  index.html, style.css   page; layout from ../shared/tool.css
  app.js                  UI: controls, preview, recipes, export, worker pool
  worker.js               processes banner slots off the UI thread
  assets.js               loads the pattern atlas, joins it with a version's blocks
  strings.js              UI strings (en/ru), dye and pattern names
  assets/                 patterns.png (41 patterns x 16 dyes, 20x39 tiles), meta.json
  core/
    generate.js           banner and block matching for one slot
    similarity.js         CIEDE2000 + SSIM hybrid score
    color.js              sRGB -> CIE-Lab, CIEDE2000
    model.js              art data, JSON import/export, rendering, /give commands
    nbt.js                structure (.nbt) and schematic (.schem, .schematic) writers
    png.js                exact PNG decoder for the atlases
```
