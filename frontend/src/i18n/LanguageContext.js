import { createContext } from "react"

/**
 * Language context shape (mirrors the theme context for consistency):
 *   language: 'en' | 'fil'            — the active language code
 *   setLanguage: (next) => void       — explicitly set a language
 *   toggleLanguage: () => void        — flip between English and Filipino
 */
export const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
})
