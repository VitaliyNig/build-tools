// UI strings. Values are [en, ru]; functions receive the message arguments.

export const STRINGS = {
  back: ["← Build Tools", "← Build Tools"],
  subtitle: ["Minecraft blocks by colour", "Блоки Minecraft по цвету"],
  version: ["Version", "Версия"],
  addJar: ["Add JAR…", "Добавить JAR…"],
  imported: ["imported", "из JAR"],
  noFalling: ["No falling blocks", "Без падающих"],
  noFallingTip: ["Hide sand, gravel and concrete powder.", "Скрыть песок, гравий и сухой бетон."],
  noTechnical: ["No technical blocks", "Без технических"],
  noTechnicalTip: [
    "Hide command blocks, bedrock, spawners and other blocks you cannot normally build with.",
    "Скрыть командные блоки, бедрок, спавнеры и другие блоки, которыми обычно не строят.",
  ],
  smooth: ["Prefer plain textures", "Предпочитать ровные текстуры"],
  smoothTip: [
    "Rank flat blocks above busy ones of the same average colour.",
    "Ставить однотонные блоки выше пёстрых с тем же средним цветом.",
  ],

  tabMatch: ["By colour", "По цвету"],
  tabGradient: ["Gradient", "Градиент"],
  search: ["Search blocks…", "Поиск блоков…"],
  matchingBlocks: ["Matching Blocks", "Подходящие блоки"],
  decorations: ["Decorations", "Декорации"],
  matchHint: [
    "Click a block to add it to your palette. Click a block in your palette to find similar ones.",
    "Клик по блоку добавляет его в палитру. Клик по блоку в палитре ищет похожие.",
  ],
  nothing: ["Nothing found.", "Ничего не найдено."],

  steps: ["Blocks", "Блоков"],
  unique: ["No repeats", "Без повторов"],
  withDeco: ["Include decorations", "С декорациями"],
  addStopTip: ["Add a colour", "Добавить цвет"],
  stopsFromPalette: ["Use my palette as colours", "Взять цвета из моей палитры"],
  addGradient: ["Add all to my palette", "Добавить всё в мою палитру"],
  gradientHint: [
    "Colours are blended in OkLab, so the steps look evenly spaced.",
    "Цвета смешиваются в OkLab, поэтому шаги выглядят равномерными.",
  ],

  myPalette: ["My Palette", "Моя палитра"],
  mineHint: ["Empty. Click blocks to add them.", "Пусто. Кликайте по блокам, чтобы добавить."],
  paletteName: ["Palette name", "Название палитры"],
  save: ["Save", "Сохранить"],
  share: ["Copy link", "Скопировать ссылку"],
  copyNames: ["Copy names", "Скопировать названия"],
  clear: ["Clear", "Очистить"],
  saved: ["Saved Palettes", "Сохранённые палитры"],
  savedHint: ["Saved in this browser only.", "Хранятся только в этом браузере."],
  untitled: ["Untitled", "Без названия"],
  missing: [(id) => `${id} (not in this version)`, (id) => `${id} (нет в этой версии)`],

  statusLoading: ["Loading palette…", "Загрузка палитры…"],
  statusReady: [
    (v, blocks, deco) => `${v}: ${blocks} blocks, ${deco} decorations.`,
    (v, blocks, deco) => `${v}: ${blocks} блоков, ${deco} декораций.`,
  ],
  statusAdded: [(name) => `Added ${name}.`, (name) => `Добавлено: ${name}.`],
  statusRemoved: [(name) => `Removed ${name}.`, (name) => `Убрано: ${name}.`],
  statusSaved: [(name) => `Saved “${name}”.`, (name) => `Сохранено: «${name}».`],
  statusLink: ["Link copied.", "Ссылка скопирована."],
  statusNames: ["Block names copied.", "Названия блоков скопированы."],
  statusShared: [(n) => `Opened a shared palette of ${n} blocks.`, (n) => `Открыта палитра по ссылке: ${n} блоков.`],
  statusJar: [(p) => `Reading JAR… ${p}`, (p) => `Чтение JAR… ${p}`],
  errPalette: [(m) => `Palette failed: ${m}`, (m) => `Ошибка палитры: ${m}`],
  errJar: [(m) => `JAR import failed: ${m}`, (m) => `Ошибка импорта JAR: ${m}`],
  errJarNoBlocks: [
    "No supported full blocks found in the JAR. A client JAR is required.",
    "В JAR не найдено поддерживаемых полных блоков. Нужен клиентский JAR.",
  ],
};
