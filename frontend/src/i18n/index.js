import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import en from "./locales/en.json"
import fil from "./locales/fil.json"

/**
 * i18n setup for pahina. Two hand-authored dictionaries (English + Filipino);
 * no runtime machine translation, so UI copy is deterministic and reviewable.
 *
 * The active language is persisted exactly like the theme (localStorage), and
 * the <html lang> attribute is kept in sync by the LanguageProvider.
 */

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "fil", label: "Filipino", short: "FIL" },
]

export const DEFAULT_LANGUAGE = "en"
export const LANGUAGE_STORAGE_KEY = "anaread-lang"

/** Resolve the initial language: a persisted choice, else the default. */
export function getInitialLanguage() {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored === "en" || stored === "fil") return stored
  return DEFAULT_LANGUAGE
}

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fil: { translation: fil },
  },
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  // React already escapes output, so i18next must not double-escape.
  interpolation: { escapeValue: false },
  // Missing keys fall back to English rather than rendering null/empty.
  returnNull: false,
  returnEmptyString: false,
})

export default i18next
