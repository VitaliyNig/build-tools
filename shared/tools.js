// Registry of tools shown on the hub page. To add a tool: create a folder next
// to `pixel/` with its own index.html and append an entry here. A tool hosted on
// another site only needs an entry with its full URL and `external: true`.

export const SITE = {
  title: { en: "Build Tools", ru: "Build Tools" },
  tagline: {
    en: "Small tools that run entirely in your browser. Nothing is uploaded.",
    ru: "Небольшие инструменты, которые работают прямо в браузере. Ничего никуда не загружается.",
  },
};

export const TOOLS = [
  {
    id: "pixel",
    href: "pixel/",
    title: { en: "Pixel", ru: "Pixel" },
    description: {
      en: "Turn an image into a Minecraft wall of real blocks: perspective correction, block palettes per game version, preview and .schem export.",
      ru: "Превращает изображение в стену из настоящих блоков Minecraft: коррекция перспективы, палитры блоков по версиям игры, предпросмотр и экспорт .schem.",
    },
    tags: ["Minecraft", "Pixel art"],
    // 4x4 pixel grid drawn as the card icon.
    icon: ["#5b8731", "#6fa03c", "#5b8731", "#7cb342", "#8d6e4a", "#5b8731", "#79553a", "#6fa03c",
      "#79553a", "#8d6e4a", "#6b4a32", "#79553a", "#6b4a32", "#79553a", "#8d6e4a", "#6b4a32"],
  },
  {
    id: "geo-to-schematic",
    // Hosted elsewhere: `external` makes the card open the site in a new tab.
    href: "https://reyysun.github.io/geo-to-schematic/",
    external: true,
    title: { en: "GeoToSchematic", ru: "GeoToSchematic" },
    description: {
      en: "Converts KML and GeoJSON outlines into Minecraft schematics for BuildTheEarth: block choice, offsets, terrain height, .schem (1.13+) and .schematic (1.12.2) output. A tool by reyysun.",
      ru: "Конвертирует контуры KML и GeoJSON в схемы Minecraft для BuildTheEarth: выбор блока, смещение, учёт рельефа, вывод в .schem (1.13+) и .schematic (1.12.2). Инструмент от reyysun.",
    },
    tags: ["Minecraft", "BuildTheEarth", "reyysun"],
    icon: ["#1b3f8f", "#2f7fd6", "#2f7fd6", "#1b3f8f", "#2f7fd6", "#3fa34d", "#57c7e3", "#2f7fd6",
      "#2f7fd6", "#57c7e3", "#3fa34d", "#2f7fd6", "#1b3f8f", "#2f7fd6", "#2f7fd6", "#1b3f8f"],
  },
];
