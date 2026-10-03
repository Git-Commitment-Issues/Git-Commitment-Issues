import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './ThemeContext'

const STORAGE_KEY = 'anaread-theme'

/**
 * Resolve the initial theme from, in order:
 *   1. a previously persisted choice in localStorage
 *   2. the OS-level color-scheme preference
 *   3. 'dark' (AnaRead's default brand surface)
 */
function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored

  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)

  // Reflect the active theme onto <html data-theme> and persist the choice.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((next) => {
    setThemeState(next === 'light' ? 'light' : 'dark')
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
