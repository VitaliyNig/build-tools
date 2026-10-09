# Build Tools

A static site of small browser tools, served by GitHub Pages from the repository
root. The hub page (`index.html`) lists the tools; each tool lives in its own
folder. There is no build step and no backend: plain HTML, CSS and ES modules.

| Tool | Folder | What it does |
|------|--------|--------------|
| **Pixel** | `pixel/` | Minecraft pixel-art generator |
| **GeoToSchematic** | external link | KML/GeoJSON outlines to schematics, by reyysun ([site](https://reyysun.github.io/geo-to-schematic/)) |

```
index.html     hub page, built from shared/tools.js
shared/        theme (base.css), language switch (i18n.js), tool registry (tools.js)
pixel/         the Pixel tool
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
   and use `../shared/i18n.js` for the shared English/Russian language switch.
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
  index.html, style.css   page and layout
  app.js                  UI: controls, edit canvas, result view, export
  worker.js               generation off the UI thread
  palettes.js             bundled palettes + JARs imported into IndexedDB
  panzoom.js              zoom/pan view
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
