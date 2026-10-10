// UI strings: [English, Russian]. Functions take the values to insert.
export const STRINGS = {
  back: ["← Build Tools", "← Build Tools"],
  subtitle: ["Big letters for Minecraft signs", "Большие буквы для табличек Minecraft"],
  placeholder: ["Type a word…", "Введите слово…"],
  clear: ["Clear", "Очистить"],
  style: ["Font", "Шрифт"],
  sample: ["ABCD", "АБВГ"],
  style_large: ["large — one letter to a sign", "крупный — одна буква на табличку"],
  style_largeMixed: ["large with thin strokes — one letter to a sign", "крупный с тонкими штрихами — одна буква на табличку"],
  style_narrow: ["narrow — two letters to a sign", "узкий — две буквы на табличку"],
  style_narrowMixed: ["narrow with thin strokes — two letters to a sign", "узкий с тонкими штрихами — две буквы на табличку"],
  style_thin: ["thin — two letters to a sign", "тонкий — две буквы на табличку"],
  style_tiny: ["tiny — up to four letters to a sign", "мелкий — до четырёх букв на табличку"],
  style_stencil: ["stencil — one letter to a sign", "трафарет — одна буква на табличку"],
  style_box: ["frames — up to three letters to a sign", "рамочный — до трёх букв на табличку"],
  italic: ["italic", "курсив"],
  italicTip: [
    "Every line of the sign stands 3 px to the right of the one below it. Works with any font; letters in italic are wider, so fewer of them share a sign.",
    "Каждая строка таблички стоит на 3 px правее той, что под ней. Работает с любым шрифтом; курсивные буквы шире, поэтому на табличку их помещается меньше.",
  ],
  styleHint_tiny: [
    "The smallest letters: thin stems one bar apart. Three or four fit on a sign, wide ones (Ш, Ж, М, Ю, Щ) take more room.",
    "Самые маленькие буквы: тонкие палки на расстоянии одной перекладины. На табличку помещаются три-четыре, широкие (Ш, Ж, М, Ю, Щ) занимают больше места.",
  ],
  styleHint_stencil: [
    "A plate of blocks with the letter cut out of it. Dye the sign text to colour the plate; with glow ink it reads as a lit sign. The letter is two rows shorter than a large one, so that the plate closes around it.",
    "Плашка из блоков, в которой вырезана буква. Покрасьте текст таблички, чтобы плашка стала цветной; со светящимися чернилами получится светящаяся вывеска. Буква на два ряда ниже крупной, чтобы плашка замыкалась вокруг неё.",
  ],
  styleHint_box: [
    "Letters of thin double lines, drawn with the box characters ═ ║ ╔ ╗ ╚ ╝. Latin letters come out best; Cyrillic Ж, Ф, Ы, Д, Ю are approximate.",
    "Буквы из тонких двойных линий, нарисованные рамочными символами ═ ║ ╔ ╗ ╚ ╝. Лучше всего выходит латиница; кириллические Ж, Ф, Ы, Д, Ю условные.",
  ],
  styleHint_large: [
    "One big letter fills the sign.",
    "Одна большая буква на всю табличку.",
  ],
  styleHint_largeMixed: [
    "Large letters whose slanted strokes are the half-wide ▌: И, Й, К, М, Я, N, R, V, W, X, Y, Z. The rest are as in the large style.",
    "Крупные буквы, у которых наклонные штрихи сделаны половинным ▌: И, Й, К, М, Я, N, R, V, W, X, Y, Z. Остальные — как в крупном стиле.",
  ],
  styleHint_narrowMixed: [
    "Narrow letters with the half-wide ▌ for slanted strokes and inner stems. This also makes Ж, М, Ш, Ы, Ю, Ф and W narrow enough to share a sign.",
    "Узкие буквы с половинным ▌ для наклонных штрихов и внутренних палок. Заодно Ж, М, Ш, Ы, Ю, Ф и W становятся достаточно узкими, чтобы делить табличку.",
  ],
  styleHint_thin: [
    "Stems are drawn with the half-wide ▌, as thick as the bars, so letters are lighter and any two fit on a sign.",
    "Вертикальные палки рисуются половинным ▌ той же толщины, что перекладины: буквы легче, и на табличку помещаются любые две.",
  ],
  styleHint_narrow: [
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
