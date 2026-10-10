// UI strings: [English, Russian]. Functions take the values to insert.
export const STRINGS = {
  back: ["← Build Tools", "← Build Tools"],
  subtitle: ["Big letters for Minecraft signs", "Большие буквы для табличек Minecraft"],
  placeholder: ["Type a word…", "Введите слово…"],
  clear: ["Clear", "Очистить"],
  perSign: ["Letters on a sign:", "Букв на табличке:"],
  perSign1: ["one, large", "одна, крупная"],
  perSign2: ["two, narrow", "две, узкие"],
  pairsHint: [
    "Letters are narrower here so that two fit. Wide ones (Ж, Ш, Щ, Ы, Ю, Ф, Д, М, W) only pair with a narrow neighbour; two wide letters in a row get a sign each.",
    "Здесь буквы более узкие, чтобы помещались две. Широкие (Ж, Ш, Щ, Ы, Ю, Ф, Д, М, W) встают в пару только с узкой соседкой; две широкие подряд получают по табличке.",
  ],
  howTo: [
    "Place a sign, then copy each of its four lines and paste it into the same line of the sign (Ctrl+V). Spaces at the start and end of a line matter: they keep the letter straight.",
    "Поставьте табличку, затем скопируйте каждую из четырёх строк и вставьте в ту же строку таблички (Ctrl+V). Пробелы в начале и в конце строки важны: они держат букву ровной.",
  ],
  accuracy: [
    "The pictures follow the widths of Minecraft's default font pixel for pixel. With the “Force Unicode Font” option or a resource pack that changes the font, signs will look different.",
    "Картинки построены по ширинам стандартного шрифта Minecraft пиксель в пиксель. С опцией «Шрифт Юникод» или ресурспаком, меняющим шрифт, таблички будут выглядеть иначе.",
  ],
  credit: ["The idea is from", "Идея взята из"],
  creditBy: ["by SuperFromND.", "от SuperFromND."],
  unknown: [(list) => `No such characters in the font: ${list}`, (list) => `Таких символов в шрифте нет: ${list}`],
  line: [(n) => `Line ${n}`, (n) => `Строка ${n}`],
  copyLine: [(n) => `Copy line ${n}`, (n) => `Скопировать строку ${n}`],
  emptyLine: ["leave empty", "оставить пустой"],
  noGlyph: ["no such character", "нет такого символа"],
  blank: ["empty sign", "пустая табличка"],
  statusStart: ["Type a word to get its signs.", "Введите слово, чтобы получить таблички."],
  statusSigns: [(n) => `Signs: ${n}.`, (n) => `Табличек: ${n}.`],
  statusCopied: [(sign, line) => `Copied: sign “${sign}”, line ${line}.`, (sign, line) => `Скопировано: табличка «${sign}», строка ${line}.`],
  errCopy: ["Could not copy. Select the line and copy it by hand.", "Не удалось скопировать. Выделите строку и скопируйте вручную."],
};
