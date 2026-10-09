// Registry of tools shown on the hub page. To add a tool: create a folder next
// to `graffiti/` with its own index.html and append an entry here. A tool hosted on
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
    id: "graffiti",
    href: "graffiti/",
    title: { en: "Graffiti", ru: "Graffiti" },
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
    id: "palette",
    href: "palette/",
    title: { en: "Palette", ru: "Palette" },
    description: {
      en: "Find Minecraft blocks and decorations by colour, build block gradients, and collect a palette you can save or share by link. Works with any game version.",
      ru: "Подбор блоков и декораций Minecraft по цвету, градиенты из блоков и своя палитра, которую можно сохранить или отправить ссылкой. Работает с любой версией игры.",
    },
    tags: ["Minecraft", "Colours"],
    icon: ["#b02e26", "#f9801d", "#fed83d", "#80c71f", "#f9801d", "#fed83d", "#80c71f", "#3ab3da",
      "#fed83d", "#80c71f", "#3ab3da", "#3c44aa", "#80c71f", "#3ab3da", "#3c44aa", "#8932b8"],
  },
  {
    id: "image2banners",
    href: "image2banners/",
    title: { en: "Image2Banners", ru: "Image2Banners" },
    description: {
      en: "Converts an image into Minecraft banner art: patterns for every banner, matching blocks behind them, crafting steps, /give commands and a structure file. Web port of the app by MARSTeamMC.",
      ru: "Превращает изображение в арт из баннеров Minecraft: узоры для каждого баннера, подходящие блоки позади, шаги крафта, команды /give и файл структуры. Веб-порт программы от MARSTeamMC.",
    },
    tags: ["Minecraft", "Banners", "MARSTeamMC"],
    icon: ["#f9fffe", "#b02e26", "#b02e26", "#f9fffe", "#f9fffe", "#fed83d", "#fed83d", "#f9fffe",
      "#f9fffe", "#3c44aa", "#3c44aa", "#f9fffe", "#f9fffe", "#1d1d21", "#1d1d21", "#f9fffe"],
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
  {
    id: "bigsigns",
    href: "https://superfromnd.gitlab.io/bigsigns/",
    external: true,
    title: { en: "Big Sign Letters", ru: "Big Sign Letters" },
    description: {
      en: "Text to copy onto a Minecraft sign, line by line, to make one large letter, digit or symbol per sign for decoration. A tool by SuperFromND.",
      ru: "Текст для копирования на табличку Minecraft построчно: на каждой табличке получается одна большая буква, цифра или символ для декора. Инструмент от SuperFromND.",
    },
    tags: ["Minecraft", "Signs", "SuperFromND"],
    // A letter "A" on a sign.
    icon: ["#a8825a", "#1d1d21", "#1d1d21", "#a8825a", "#1d1d21", "#a8825a", "#a8825a", "#1d1d21",
      "#1d1d21", "#1d1d21", "#1d1d21", "#1d1d21", "#1d1d21", "#a8825a", "#a8825a", "#1d1d21"],
  },
];
