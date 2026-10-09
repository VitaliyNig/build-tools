// Language preference shared by the hub and every tool.

export const LANGS = { en: "English", ru: "Русский" };
const KEY = "tools.lang";

export function getLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved in LANGS) return saved;
  } catch { /* storage unavailable */ }
  return (navigator.language || "").toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function setLang(lang) {
  try { localStorage.setItem(KEY, lang); } catch { /* storage unavailable */ }
  document.documentElement.lang = lang;
}

/** Fill a <select> with the languages and call onChange(lang) on selection. */
export function bindLanguageSelect(select, onChange) {
  for (const [code, label] of Object.entries(LANGS)) select.add(new Option(label, code));
  select.value = getLang();
  document.documentElement.lang = select.value;
  select.addEventListener("change", () => { setLang(select.value); onChange(select.value); });
}
