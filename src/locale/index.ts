import i18next from "i18next";
import zh from "./zh.json";
import en from "./en.json";

export type Locale = "zh" | "en";

export type LanguageChoice = "auto" | "zh" | "en";

export type TranslationKey = keyof typeof zh;

const STORAGE_KEY = "mad-toolbox:language";

const LANGUAGE_BY_CHOICE: Record<LanguageChoice, Locale> = {
  auto: "zh",
  zh: "zh",
  en: "en"
};

function detectSystemLocale(): Locale {
  const tag = (navigator.language || navigator.languages?.[0] || "en")
    .replace("_", "-")
    .toLowerCase();
  return tag.startsWith("zh") ? "zh" : "en";
}

export function resolveChoice(choice: LanguageChoice): Locale {
  return choice === "auto" ? detectSystemLocale() : LANGUAGE_BY_CHOICE[choice];
}

function readStoredChoice(): LanguageChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "zh" || value === "en" ? value : "auto";
  } catch {
    return "auto";
  }
}

void i18next.init({
  resources: {
    zh: { translation: zh },
    en: { translation: en }
  },
  lng: resolveChoice(readStoredChoice()),
  fallbackLng: "en",
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false }
});

export function languageChoice(): LanguageChoice {
  return readStoredChoice();
}

export function currentLanguage(): Locale {
  return i18next.language?.startsWith("zh") ? "zh" : "en";
}

export function setLanguageChoice(choice: LanguageChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {}
  void i18next.changeLanguage(resolveChoice(choice));
  document.documentElement.lang = currentLanguage();
}

export function onLanguageChanged(listener: () => void): () => void {
  i18next.on("languageChanged", listener);
  return () => i18next.off("languageChanged", listener);
}

function joinList(items: readonly (string | number)[]): string {
  return items.map(String).join(currentLanguage() === "zh" ? "、" : ", ");
}

export function t(
  key: TranslationKey,
  params?: Record<string, string | number | readonly (string | number)[]>
): string {
  if (!params) return i18next.t(key, { defaultValue: key }) as string;
  const flat = Object.fromEntries(
    Object.entries(params).map(([name, value]) => [
      name,
      Array.isArray(value) ? joinList(value) : value
    ])
  );
  return i18next.t(key, { ...flat, defaultValue: key }) as string;
}

document.documentElement.lang = currentLanguage();
