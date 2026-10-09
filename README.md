# Build Tools

A static site of small browser tools, served by GitHub Pages from the repository
root. The hub page (`index.html`) lists the tools; each tool lives in its own
folder. There is no build step and no backend: plain HTML, CSS and ES modules.

| Tool | Folder | What it does |
|------|--------|--------------|
| **Pixel** | `pixel/` | Minecraft pixel-art generator |
| **Image2Banners** | `image2banners/` | Image to Minecraft banner art; web port of the app by MARSTeamMC |
| **GeoToSchematic** | external link | KML/GeoJSON outlines to schematics, by reyysun ([site](https://reyysun.github.io/geo-to-schematic/)) |

```
index.html     hub page, built from shared/tools.js
shared/        theme (base.css), tool layout (tool.css), language switch (i18n.js),
               zoom/pan view (panzoom.js), tool registry (tools.js)
pixel/         the Pixel tool
image2banners/ the Image2Banners tool
.nojekyll      turns GitHub's Jekyll processing off
```

## Publishing on GitHub Pages
1. Push the repository to GitHub as `build-tools`.
2. **Settings → Pages → Build and deployment**: source *Deploy from a branch*,
   branch `main`, folder `/ (root)`.
3. The hub is served at `https://<user>.github.io/build-tools/`, Pixel at `.../pixel/`.

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

## Pixel
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
| 1.13 and newer | `pixelart.schem` | Sponge Schematic v2 | WorldEdit 7+, FAWE, Litematica, Axiom |
| 1.12 and older | `pixelart.schematic` | MCEdit (numeric block ids) | WorldEdit 6, Schematica |

Sponge v2 is used rather than v3 because every reader of v3 also reads v2.
Versions before 1.13 cannot load `.schem`, and their blockstate names are model
variants rather than block ids, so `pixel/core/legacy.js` maps them to id:data
pairs.

In-game with WorldEdit: put the file in WorldEdit's `schematics` folder, then
`//schem load pixelart` (`//schematic load pixelart` on 1.12) and `//paste`.
Use a palette of the same version as the world: blocks the game does not know
are replaced with air.

Both formats were checked structurally with an independent NBT parser, not by
pasting in every game version. The 1.12 id table in particular is hand-written;
if a block comes out wrong in 1.12, fix its entry in `pixel/core/legacy.js`.

### Adding a Minecraft version
**Add JAR…** parses a client JAR (for example `1.21.4.jar` from
`.minecraft/versions/1.21.4/`) in the browser and keeps the palette in IndexedDB,
so it is stored per browser and per device, and is lost when site data is cleared.

- Only complete opaque cubes with an untinted, unrotated north face are
  included; plants, fluids, transparent blocks, stairs and slabs are skipped.
- JARs without an embedded `version.json` (1.12 and earlier) are labelled from
  the filename, so keep the version number in it.
- For versions before 1.13, variants missing from `pixel/core/legacy.js` are
  skipped, because they could not be exported.
- Versions before 1.8 have no blockstate files and cannot be imported.

To bundle a version with the site instead, add `<version>.json` and
`<version>.png` to `pixel/palettes/` and list it in `pixel/palettes/index.json`.
The JSON holds `version`, `data_version`, `cols` and `blocks` (`id`, `name`,
`category`, average `rgb`); the PNG is an atlas of 16×16 tiles, `cols` per row,
in block order.

### Browser support
Needs a current browser: module workers, `DecompressionStream`/`CompressionStream`
and `createImageBitmap` (Chrome/Edge 103+, Firefox 114+, Safari 16.4+). Developed
and tested in Chromium only.

### Layout
```
pixel/
  index.html              page (layout from ../shared/tool.css)
  app.js                  UI: controls, edit canvas, result view, export
  worker.js               generation off the UI thread
  palettes.js             bundled palettes + JARs imported into IndexedDB
  strings.js              UI strings (en/ru)
  palettes/               bundled versions (index.json, <version>.json, <version>.png)
  core/                   UI-independent logic, no DOM access
    pipeline.js           source image + settings -> block grid
    imageops.js           adjustments, rotation
    warp.js               perspective correction
    resample.js           Lanczos / box resize
    color.js              sRGB -> CIE-Lab
    palette.js            palette arrays, subsets, atlas cutting
    quantize.js           nearest block, dithering, material counts
    texture.js            texture-aware matching
    schematic.js          .schem and .schematic writers
    legacy.js             pre-1.13 numeric block ids
    zip.js, jar.js        client JAR reader and palette importer
```

### Notes
- Palette colours are flat texture averages; in-game shading/biome tints aren't
  modelled, so results are an approximation.
- Images larger than 4096 px on a side are downscaled on load; PNG export is
  capped at 8192 px per side; transparent image areas become white.
- Falling blocks (sand, gravel, concrete powder) are in the palette and will drop
  from an unsupported wall; disable them in **Choose blocks…** if needed.
- `pixel/palettes/*.png` contain Minecraft block textures, which are Mojang's
  assets. To publish without them, delete the palette files, empty the list in
  `pixel/palettes/index.json`, and let users import their own client JAR.

## Image2Banners
Converts an image into banner art: for every banner slot (1 block wide, 2 blocks
tall) it searches for the banner patterns that best reproduce that part of the
picture, and for the blocks behind it. Everything runs in the browser.

This is a web port of [Image2Banners](https://github.com/MARSTeamMC/Image2Banners)
by **MARSTeamMC**, which is an Electron + Python desktop app. The matching
algorithm, the JSON format and the structure export are theirs; the textures in
`image2banners/assets/` come from their repository. Their code is licensed under
the BSD 2-Clause License, reproduced in `image2banners/LICENSE-Image2Banners.txt`.

### Features
- **Banner matching** — up to 6 patterns per banner (what a loom allows), or more
  with **More than 6 patterns** for banners obtained by command.
- **Blocks behind banners**, chosen by colour, and **layered banners** (a banner
  one block higher overlapping the one below).
- **Banner recipes** — click a banner to see the crafting steps, the block behind
  it and a `/give` command (1.20.5+ syntax).
- **Save** as PNG, as JSON (reload it later instead of regenerating) or as a
  structure `.nbt` for a structure block.
- Multi-threaded: one worker per CPU thread.

Following the usual advice for creative-mode building, all options are on by
default; turn off **More than 6 patterns** and **Use banner pattern items** for
banners you want to craft in survival.

### Loading the structure in-game
Put the `.nbt` file in `saves/<world>/generated/i2b/structures/`, then in a
structure block (Load mode) enter `i2b:<file name>` without `.nbt`. Structure
blocks do not display the real size of art larger than 32×32 blocks. The file
is written for Minecraft 1.21.7 (data version 4440).

### Fidelity to the original
The port was checked against a reference built from the same libraries the
original uses (scikit-image, OpenCV, Pillow): identical patterns and blocks on
the test image, and a byte-identical structure file. Intentional differences:
- The original appends the last pattern once more when a layer brings no
  improvement; the port does not, so the saved list matches the preview.
- Block-state properties for crafter faces are applied (in the original the
  generic `top` rule shadowed them).
- The saved PNG is drawn from the final data (crisp blocks, banners placed as in
  game) rather than from the progressive preview.
- JSON files are interchangeable with the desktop app.

### Layout
```
image2banners/
  index.html, style.css   page; layout from ../shared/tool.css
  app.js                  UI: controls, preview, recipes, export, worker pool
  worker.js               processes banner slots off the UI thread
  assets.js               loads the texture atlases
  strings.js              UI strings (en/ru), dye and pattern names
  assets/                 patterns.png (41 patterns x 16 dyes, 20x39 tiles),
                          blocks.png (16x16 tiles, 32 per row), meta.json
  core/
    generate.js           banner and block matching for one slot
    similarity.js         CIEDE2000 + SSIM hybrid score
    color.js              sRGB -> CIE-Lab, CIEDE2000
    model.js              art data, JSON import/export, rendering, /give command
    nbt.js                structure file writer
    png.js                exact PNG decoder for the atlases
```
