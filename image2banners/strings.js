// UI strings. Values are [en, ru]; functions receive the message arguments.

export const STRINGS = {
  back: ["← Build Tools", "← Build Tools"],
  subtitle: ["Images to Minecraft banner art", "Изображения в арт из баннеров Minecraft"],
  dropHint: [
    "Load an image (or a saved JSON), or drop a file here.",
    "Загрузите изображение (или сохранённый JSON) либо перетащите файл сюда.",
  ],
  fit: ["Fit", "Вписать"],
  hideBanners: ["Hide banners", "Скрыть баннеры"],
  showBanners: ["Show banners", "Показать баннеры"],
  toggleBannersTip: [
    "Show only the blocks behind the banners; point at a block to see its name. The saved image is the same as the view.",
    "Показать только блоки позади баннеров; наведите на блок, чтобы увидеть название. Изображение сохраняется таким же, как на экране.",
  ],
  zoomHint: ["scroll = zoom, drag = pan, click = banner recipe", "колесо — масштаб, перетаскивание — сдвиг, клик — рецепт баннера"],
  load: ["Select Image / JSON…", "Выбрать изображение / JSON…"],

  version: ["Minecraft version", "Версия Minecraft"],
  addJar: ["Add JAR…", "Добавить JAR…"],
  imported: ["imported", "из JAR"],
  versionHint: [
    "Blocks, patterns and the command are chosen for this version. Add a client JAR for any other version.",
    "Блоки, узоры и команда подбираются под эту версию. Для другой версии добавьте клиентский JAR.",
  ],
  size: ["Art size (blocks)", "Размер арта (блоки)"],
  width: ["Width", "Ширина"],
  height: ["Height", "Высота"],
  sizeHint: [
    "A banner is 1 block wide and 2 blocks tall, so an even height fits best.",
    "Баннер занимает 1 блок в ширину и 2 в высоту, поэтому лучше чётная высота.",
  ],

  options: ["Options", "Настройки"],
  optBlocks: ["Generate blocks", "Генерация блоков"],
  optBlocksTip: [
    "Pick blocks of matching colour to place behind the banners.",
    "Подбирать блоки нужного цвета позади баннеров.",
  ],
  optLayering: ["Layer banners", "Наслаивание баннеров"],
  optLayeringTip: [
    "Also try a banner one block higher, so its lower half overlaps the banner below.",
    "Пробовать баннер на блок выше: его нижняя часть накладывается на баннер под ним.",
  ],
  optBig: ["More than 6 patterns", "Баннеры с 6+ узорами"],
  optBigTip: [
    "Allow banners with more than six patterns. They cannot be crafted in survival, only obtained with commands.",
    "Разрешить баннеры с более чем шестью узорами. В выживании их не скрафтить, только получить командой.",
  ],
  optItems: ["Use banner pattern items", "Использовать шаблоны узоров"],
  optItemsTip: [
    "Allow patterns that need an item: skull, flower, globe, snout and so on.",
    "Разрешить узоры, для которых нужен предмет: череп, цветок, глобус, рыло и т. д.",
  ],
  threads: ["Threads", "Потоки"],
  threadsTip: [
    "How many CPU threads to use. The maximum is fastest.",
    "Сколько потоков процессора использовать. Максимум — быстрее всего.",
  ],
  compare: ["Compare method", "Метод сравнения"],
  compareTip: [
    "Balance between colour match (100) and structure match (0). Recommended: 90.",
    "Баланс между совпадением цвета (100) и структуры (0). Рекомендуется 90.",
  ],

  generate: ["Generate Banners", "Сгенерировать баннеры"],
  cancel: ["Cancel", "Отмена"],

  save: ["Save", "Сохранение"],
  savePng: ["Save as image", "Сохранить как изображение"],
  saveJson: ["Save as JSON", "Сохранить как JSON"],
  saveJsonTip: [
    "Reload it later instead of generating again. Compatible with the Image2Banners desktop app.",
    "Его можно загрузить позже вместо повторной генерации. Совместим с десктопным Image2Banners.",
  ],
  saveNbt: ["Save as NBT", "Сохранить как NBT"],
  saveNbtTip: [
    "For a structure block: put the file in saves/<world>/generated/i2b/structures/ and load i2b:<file name> (without .nbt). Structure blocks do not show the real size of art larger than 32×32.",
    "Для структурного блока: положите файл в saves/<мир>/generated/i2b/structures/ и загрузите i2b:<имя файла> (без .nbt). Структурный блок не показывает реальный размер арта больше 32×32.",
  ],
  saveSchem: ["Save as SCHEM", "Сохранить как SCHEM"],
  saveSchemTip: [
    "Sponge schematic for WorldEdit, FAWE, Litematica or Axiom: put it in the schematics folder and run //schem load <file name>. The art faces north: banners are on the north side of the wall.",
    "Схема Sponge для WorldEdit, FAWE, Litematica или Axiom: положите файл в папку schematics и выполните //schem load <имя файла>. Арт смотрит на север: баннеры с северной стороны стены.",
  ],
  saveSchematic: ["Save as SCHEMATIC", "Сохранить как SCHEMATIC"],
  saveSchematicTip: [
    "MCEdit schematic for WorldEdit 6, Schematica or MCEdit: put it in the schematics folder and run //schematic load <file name>. The art faces north: banners are on the north side of the wall.",
    "Схема MCEdit для WorldEdit 6, Schematica или MCEdit: положите файл в папку schematics и выполните //schematic load <имя файла>. Арт смотрит на север: баннеры с северной стороны стены.",
  ],
  saveNbtOld: [
    "Structure files are for Minecraft 1.13 and newer. For this version save a schematic.",
    "Файл структуры — для Minecraft 1.13 и новее. Для этой версии сохраните схему.",
  ],
  credit: ["Web port of", "Веб-порт"],
  creditBy: ["by MARSTeamMC, licensed under", "от MARSTeamMC, лицензия"],

  detailsHint: [
    "Generate, then click a banner to see how to craft it.",
    "Сгенерируйте арт и кликните по баннеру, чтобы увидеть, как его скрафтить.",
  ],
  detailsBanner: [(x, y) => `Banner at (${x}, ${y})`, (x, y) => `Баннер (${x}, ${y})`],
  detailsBlock: [(x, y) => `Block at (${x}, ${y})`, (x, y) => `Блок (${x}, ${y})`],
  blockHint: ["Block behind this cell.", "Блок позади этой клетки."],
  giveCommand: ["Command to get the banner, version:", "Команда для получения баннера, версия:"],
  commandModern: ["1.20.5 and newer", "1.20.5 и новее"],
  commandLegacy: ["1.13 – 1.20.4", "1.13 – 1.20.4"],
  commandOld: ["1.8 – 1.12", "1.8 – 1.12"],
  commandMissing: [
    (names) => `Not in these versions, left out of the command: ${names}.`,
    (names) => `Нет в этих версиях, в команду не вошли: ${names}.`,
  ],
  copy: ["Copy", "Копировать"],
  copied: ["Copied", "Скопировано"],
  stepsTitle: ["Crafting steps", "Шаги крафта"],
  stepsHint: [
    "Start with the base banner, then apply each dye and pattern in a loom, in order.",
    "Начните с базового баннера, затем по порядку наносите краситель и узор на ткацком станке.",
  ],
  baseBanner: [(colour) => `${colour} Banner`, (colour) => `${colour} баннер`],
  needsItem: ["needs a pattern item", "нужен шаблон узора"],

  statusStart: ["Load an image to begin.", "Загрузите изображение, чтобы начать."],
  statusAssets: ["Loading textures…", "Загрузка текстур…"],
  statusImage: [(w, h) => `Loaded ${w}×${h}px image.`, (w, h) => `Загружено изображение ${w}×${h}px.`],
  statusJson: [(w, h) => `Loaded banner art ${w}×${h} blocks.`, (w, h) => `Загружен арт ${w}×${h} блоков.`],
  statusProgress: [(n, total) => `Generating… ${n} / ${total} banners`, (n, total) => `Генерация… ${n} / ${total} баннеров`],
  statusDone: [
    (w, h, banners, s) => `Done: ${w}×${h} blocks, ${banners} banners, ${s} s.`,
    (w, h, banners, s) => `Готово: ${w}×${h} блоков, ${banners} баннеров, ${s} с.`,
  ],
  statusCancelled: ["Cancelled.", "Отменено."],
  statusVersion: [(v, n) => `Minecraft ${v}: ${n} blocks.`, (v, n) => `Minecraft ${v}: ${n} блоков.`],
  statusVersionArt: [
    (v, n) => `Minecraft ${v}: ${n} blocks. Blocks missing in this version were replaced; generate again for the best match.`,
    (v, n) => `Minecraft ${v}: ${n} блоков. Блоки, которых нет в этой версии, заменены; сгенерируйте заново для лучшего результата.`,
  ],
  statusJar: [(p) => `Reading JAR… ${p}`, (p) => `Чтение JAR… ${p}`],
  statusJarDone: [(v, n) => `Minecraft ${v} added: ${n} blocks.`, (v, n) => `Minecraft ${v} добавлен: ${n} блоков.`],
  errJar: [(m) => `JAR import failed: ${m}`, (m) => `Ошибка импорта JAR: ${m}`],
  errJarNoBlocks: [
    "No supported full blocks found in the JAR. A client JAR is required.",
    "В JAR не найдено поддерживаемых полных блоков. Нужен клиентский JAR.",
  ],
  errJarMetadata: [
    "A Minecraft client JAR with valid version metadata is required.",
    "Нужен клиентский Minecraft JAR с корректными метаданными версии.",
  ],
  statusSaved: [(name) => `Saved ${name}.`, (name) => `Сохранено: ${name}.`],
  errFile: ["Could not read this file.", "Не удалось прочитать файл."],
  errJson: [
    "This JSON is not banner art saved by Image2Banners.",
    "Этот JSON не является артом, сохранённым в Image2Banners.",
  ],
  errAssets: [(m) => `Could not load textures: ${m}`, (m) => `Не удалось загрузить текстуры: ${m}`],
  errGenerate: [(m) => `Generation failed: ${m}`, (m) => `Ошибка генерации: ${m}`],
};

export const DYE_NAMES = {
  white: ["White", "Белый"], orange: ["Orange", "Оранжевый"], magenta: ["Magenta", "Пурпурный"],
  light_blue: ["Light Blue", "Голубой"], yellow: ["Yellow", "Жёлтый"], lime: ["Lime", "Лаймовый"],
  pink: ["Pink", "Розовый"], gray: ["Gray", "Серый"], light_gray: ["Light Gray", "Светло-серый"],
  cyan: ["Cyan", "Бирюзовый"], purple: ["Purple", "Фиолетовый"], blue: ["Blue", "Синий"],
  brown: ["Brown", "Коричневый"], green: ["Green", "Зелёный"], red: ["Red", "Красный"],
  black: ["Black", "Чёрный"],
};

// In-game (heraldic) pattern names, as shown in the loom.
export const PATTERN_NAMES = {
  stripe_bottom: "Base", stripe_top: "Chief", stripe_left: "Pale Dexter", stripe_right: "Pale Sinister",
  stripe_center: "Pale", stripe_middle: "Fess", stripe_downright: "Bend", stripe_downleft: "Bend Sinister",
  small_stripes: "Paly", cross: "Saltire", straight_cross: "Cross",
  diagonal_left: "Per Bend Sinister", diagonal_right: "Per Bend", diagonal_up_left: "Per Bend Inverted",
  diagonal_up_right: "Per Bend Sinister Inverted", half_vertical: "Per Pale",
  half_vertical_right: "Per Pale Inverted", half_horizontal: "Per Fess",
  half_horizontal_bottom: "Per Fess Inverted", square_bottom_left: "Base Dexter Canton",
  square_bottom_right: "Base Sinister Canton", square_top_left: "Chief Dexter Canton",
  square_top_right: "Chief Sinister Canton", triangle_bottom: "Chevron", triangle_top: "Inverted Chevron",
  triangles_bottom: "Base Indented", triangles_top: "Chief Indented", circle: "Roundel", rhombus: "Lozenge",
  border: "Bordure", curly_border: "Bordure Indented", bricks: "Field Masoned", gradient: "Gradient",
  gradient_up: "Base Gradient", creeper: "Creeper Charge", skull: "Skull Charge", flower: "Flower Charge",
  mojang: "Thing", globe: "Globe", piglin: "Snout", flow: "Flow", guster: "Guster",
};

export const PATTERN_ITEMS = new Set(["creeper", "skull", "flower", "mojang", "globe", "piglin", "flow", "guster"]);
