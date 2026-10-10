// Search over the head catalogue: an index of the words in names, tags and
// collections, queried in English or Russian. Russian words are stemmed and
// looked up in the dictionary (dictionary.js), which turns them into the
// English words the catalogue is written in.

// ---------- text ----------
const CYRILLIC = /[а-яё]/;
const LATIN = /[a-z]/;

/** Lower case, ё as е, everything that is not a letter or digit a space. */
export function normalize(text) {
  return text.toLowerCase().replace(/ё/g, "е").replace(/'s\b/g, "").replace(/[^a-z0-9а-яÀ-ɏ]+/g, " ").trim();
}

export const words = (text) => normalize(text).split(" ").filter(Boolean);

// ---------- Russian stemmer (Snowball) ----------
const VOWELS = "аеиоуыэюя";
const PERFECTIVE_1 = ["вшись", "вши", "в"];
const PERFECTIVE_2 = ["ившись", "ывшись", "ивши", "ывши", "ив", "ыв"];
const REFLEXIVE = ["ся", "сь"];
const ADJECTIVE = ["ими", "ыми", "его", "ого", "ему", "ому", "ее", "ие", "ые", "ое", "ей", "ий", "ый", "ой", "ем", "им",
  "ым", "ом", "их", "ых", "ую", "юю", "ая", "яя", "ою", "ею"];
const PARTICIPLE_1 = ["ем", "нн", "вш", "ющ", "щ"];
const PARTICIPLE_2 = ["ивш", "ывш", "ующ"];
const VERB_1 = ["ете", "йте", "ешь", "нно", "ла", "на", "ли", "ем", "ло", "но", "ет", "ют", "ны", "ть", "й", "л", "н"];
const VERB_2 = ["ейте", "уйте", "ила", "ыла", "ена", "ите", "или", "ыли", "ило", "ыло", "ено", "ует", "уют", "ены", "ить",
  "ыть", "ишь", "ей", "уй", "ил", "ыл", "им", "ым", "ен", "ят", "ит", "ыт", "ую", "ю"];
const NOUN = ["иями", "ями", "ами", "ией", "иям", "ием", "иях", "ев", "ов", "ие", "ье", "еи", "ии", "ей", "ой", "ий", "ям",
  "ем", "ам", "ом", "ах", "ях", "ию", "ью", "ия", "ья", "а", "е", "и", "й", "о", "у", "ы", "ь", "ю", "я"];
const SUPERLATIVE = ["ейше", "ейш"];
const DERIVATIONAL = ["ость", "ост"];

/** Start of the region after the first vowel, and of R2, as Snowball defines them. */
function regions(word) {
  const after = (from) => {
    for (let i = from; i < word.length - 1; i++) {
      if (VOWELS.includes(word[i]) && !VOWELS.includes(word[i + 1])) return i + 2;
    }
    return word.length;
  };
  let rv = word.length;
  for (let i = 0; i < word.length; i++) if (VOWELS.includes(word[i])) { rv = i + 1; break; }
  const r1 = after(0);
  return { rv, r2: after(r1) };
}

/** The longest ending from the list that the word has after `start`; with `afterAorYa`, only one that follows а or я. */
function ending(word, start, list, afterAorYa = false) {
  let best = "";
  for (const suffix of list) {
    if (suffix.length <= best.length || !word.endsWith(suffix) || word.length - suffix.length < start) continue;
    if (afterAorYa) {
      const before = word[word.length - suffix.length - 1];
      if ((before !== "а" && before !== "я") || word.length - suffix.length - 1 < start) continue;
    }
    best = suffix;
  }
  return best;
}

const cut = (word, suffix) => word.slice(0, word.length - suffix.length);

export function stemRu(input) {
  let word = input.replace(/ё/g, "е");
  const { rv, r2 } = regions(word);
  if (rv >= word.length) return word;
  // Step 1: a perfective gerund, or else a reflexive ending followed by an adjective, a verb or a noun ending.
  let suffix = ending(word, rv, PERFECTIVE_1, true) || ending(word, rv, PERFECTIVE_2);
  if (suffix) word = cut(word, suffix);
  else {
    suffix = ending(word, rv, REFLEXIVE);
    if (suffix) word = cut(word, suffix);
    const adjective = ending(word, rv, ADJECTIVE);
    if (adjective) {
      word = cut(word, adjective);
      const participle = ending(word, rv, PARTICIPLE_1, true) || ending(word, rv, PARTICIPLE_2);
      if (participle) word = cut(word, participle);
    } else {
      const verb = ending(word, rv, VERB_1, true) || ending(word, rv, VERB_2);
      if (verb) word = cut(word, verb);
      else {
        const noun = ending(word, rv, NOUN);
        if (noun) word = cut(word, noun);
      }
    }
  }
  // Step 2: a final и.
  if (word.endsWith("и") && word.length - 1 >= rv) word = word.slice(0, -1);
  // Step 3: a derivational ending in R2.
  const derivational = ending(word, r2, DERIVATIONAL);
  if (derivational) word = cut(word, derivational);
  // Step 4: нн to н, a superlative ending, or a soft sign.
  if (word.endsWith("нн") && word.length - 1 > rv) return word.slice(0, -1);
  const superlative = ending(word, rv, SUPERLATIVE);
  if (superlative) {
    word = cut(word, superlative);
    return word.endsWith("нн") ? word.slice(0, -1) : word;
  }
  if (word.endsWith("ь") && word.length - 1 >= rv) word = word.slice(0, -1);
  return word;
}

/** A crude English stem: enough for plural forms to meet their singular. */
export function stemEn(word) {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 4 && /(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

// ---------- keyboard layout and transliteration ----------
const QWERTY = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const JCUKEN = "йцукенгшщзхъфывапролджэячсмитьбюё";

/** Text typed with the other keyboard layout, as it was meant: "cnek" → "стул", "сфе" → "cat". */
export function switchLayout(text) {
  const lower = text.toLowerCase();
  const toRussian = !CYRILLIC.test(lower);
  const [from, to] = toRussian ? [QWERTY, JCUKEN] : [JCUKEN, QWERTY];
  return [...lower].map((c) => { const i = from.indexOf(c); return i < 0 ? c : to[i]; }).join("");
}

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y",
  ь: "", э: "e", ю: "yu", я: "ya",
};
/** A Russian word spelled in Latin letters, for names the dictionary does not know. */
export const transliterate = (word) => [...word].map((c) => TRANSLIT[c] ?? c).join("");

// ---------- dictionary ----------
/** Russian stem → the English words it translates, from lines "english русское русское". */
export function parseDictionary(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const [english, ...russian] = line.trim().toLowerCase().split(/\s+/);
    if (!english || !russian.length) continue;
    for (const ru of russian) {
      for (const part of ru.replace(/ё/g, "е").split("-")) {
        if (part.length < 2) continue;
        const stem = stemRu(part);
        if (!map.has(stem)) map.set(stem, new Set());
        map.get(stem).add(english);
      }
    }
  }
  const stems = [...map.keys()].sort();
  return { map, stems };
}

// ---------- sorted word lists ----------
/** Index of the first word in a sorted list that is not less than `prefix`. */
function lowerBound(list, prefix) {
  let lo = 0, hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < prefix) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** The words of a sorted list that start with `prefix`, at most `limit` of them. */
function withPrefix(list, prefix, limit = 400) {
  const out = [];
  for (let i = lowerBound(list, prefix); i < list.length && out.length < limit && list[i].startsWith(prefix); i++) out.push(list[i]);
  return out;
}

// ---------- index ----------
// Where a word is found counts towards the score: in the name it weighs most.
const WHERE = { name: 0, meta: 1 };
const SCORE = { exact: [10, 4], prefix: [6, 2] };

/**
 * Build the index. `heads` are catalogue records; `labels` gives display names
 * for tag, collection and category ids, whose words are searched too.
 */
export function buildIndex(heads, labels = {}) {
  const postings = new Map(); // word → [head numbers in the name, head numbers in tags/collections]
  const add = (word, where, n) => {
    let entry = postings.get(word);
    if (!entry) postings.set(word, entry = [[], []]);
    const list = entry[where];
    if (list[list.length - 1] !== n) list.push(n);
  };
  const labelWords = new Map();
  const wordsOf = (id) => {
    if (!labelWords.has(id)) labelWords.set(id, words(`${labels[id] || ""} ${id.replace(/-/g, " ")}`));
    return labelWords.get(id);
  };
  heads.forEach((head, n) => {
    for (const word of words(head.name)) add(word, WHERE.name, n);
    for (const id of [head.category, ...head.tags, ...head.collections]) {
      if (id) for (const word of wordsOf(id)) add(word, WHERE.meta, n);
    }
  });
  const byId = new Map(heads.map((head, n) => [head.id, n]));
  return { heads, postings, vocabulary: [...postings.keys()].sort(), byId };
}

// ---------- queries ----------
/**
 * The alternatives a query word stands for: [word, weight, prefix allowed].
 * `last` is true for the word being typed, which may be unfinished.
 */
export function alternatives(token, dictionary, last) {
  const out = new Map();
  const put = (word, weight, prefix) => {
    if (!word) return;
    const key = `${word}|${prefix}`;
    if ((out.get(key)?.[1] ?? 0) < weight) out.set(key, [word, weight, prefix]);
  };
  if (CYRILLIC.test(token)) {
    const stem = stemRu(token);
    // Names written in Russian in the catalogue itself.
    put(stem, 1, true);
    for (const english of dictionary.map.get(stem) || []) put(english, 1, true);
    // A word still being typed, or a form the stemmer leaves longer: stems that start with it.
    if (stem.length >= 3) {
      for (const longer of withPrefix(dictionary.stems, stem, 60)) {
        if (longer === stem) continue;
        for (const english of dictionary.map.get(longer)) put(english, last ? 0.7 : 0.5, true);
      }
    }
    // Names nobody translated: try them in Latin letters.
    if (token.length >= 4) put(transliterate(stem), 0.4, true);
  } else {
    put(token, 1, true);
    const stem = stemEn(token);
    if (stem !== token) put(stem, 0.9, true);
  }
  return [...out.values()];
}

/** Score of every head that matches one query word: head number → score. */
function matchToken(index, alts) {
  const scores = new Map();
  for (const [word, weight, prefix] of alts) {
    const found = prefix && word.length >= 2 ? withPrefix(index.vocabulary, word) : index.postings.has(word) ? [word] : [];
    for (const w of found) {
      const kind = w === word ? "exact" : "prefix";
      const [inName, inMeta] = index.postings.get(w);
      for (const [list, where] of [[inName, WHERE.name], [inMeta, WHERE.meta]]) {
        const score = SCORE[kind][where] * weight;
        for (const n of list) if ((scores.get(n) ?? 0) < score) scores.set(n, score);
      }
    }
  }
  return scores;
}

/**
 * Find heads. Returns the head numbers, best first. `filter(head)` narrows
 * the result (category, collection). A number alone also finds the head
 * with that id.
 */
export function search(index, dictionary, query, filter = null) {
  const tokens = words(query);
  const keep = (n) => !filter || filter(index.heads[n]);
  if (!tokens.length) {
    const all = [];
    for (let n = 0; n < index.heads.length; n++) if (keep(n)) all.push(n);
    return all;
  }
  let total = null;
  tokens.forEach((token, i) => {
    const last = i === tokens.length - 1;
    const scores = /^\d+$/.test(token) ? matchNumber(index, token) : matchToken(index, alternatives(token, dictionary, last));
    if (total === null) total = scores;
    else {
      const next = new Map();
      for (const [n, score] of total) if (scores.has(n)) next.set(n, score + scores.get(n));
      total = next;
    }
  });
  const found = [];
  for (const [n, score] of total) if (keep(n)) found.push([n, score]);
  const heads = index.heads;
  found.sort((a, b) => b[1] - a[1] || heads[a[0]].name.length - heads[b[0]].name.length || heads[a[0]].id - heads[b[0]].id);
  return found.map(([n]) => n);
}

/** A number: the head with that id first, then names that contain the number. */
function matchNumber(index, token) {
  const scores = matchToken(index, [[token, 1, false]]);
  const n = index.byId.get(Number(token));
  if (n !== undefined) scores.set(n, 100);
  return scores;
}

/** The query typed in the other keyboard layout, when it finds nothing as typed. */
export function layoutFix(query) {
  return LATIN.test(query) || CYRILLIC.test(query) ? switchLayout(query) : null;
}
