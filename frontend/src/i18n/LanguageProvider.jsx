import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { LanguageContext } from "./LanguageContext"
// Importing the config here guarantees i18next is initialized before any
// consumer calls useTranslation().
import i18n, { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, getInitialLanguage } from "./index"

/**
 * LanguageProvider — owns the active UI language, mirroring ThemeProvider.
 * Persists the choice to localStorage, keeps <html lang> in sync, and drives
 * i18next's active language so every t() call re-renders on a switch.
 */
export function LanguageProvider({ children }) {
  const { i18n: instance } = useTranslation()
  const [language, setLanguageState] = useState(getInitialLanguage)

  useEffect(() => {
    const active = language === "fil" ? "fil" : "en"
    document.documentElement.setAttribute("lang", active)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, active)
    const engine = instance ?? i18n
    if (engine.language !== active) engine.changeLanguage(active)
  }, [language, instance])

  const setLanguage = useCallback((next) => {
    setLanguageState(next === "fil" ? "fil" : DEFAULT_LANGUAGE)
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === "en" ? "fil" : "en"))
  }, [])

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage }),
    [language, setLanguage, toggleLanguage],
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
