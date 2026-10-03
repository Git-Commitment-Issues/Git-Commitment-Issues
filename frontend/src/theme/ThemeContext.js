import { createContext } from 'react'

/**
 * Theme context shape:
 *   theme: 'light' | 'dark'           — the active, resolved theme
 *   setTheme: (next) => void          — explicitly set a theme
 *   toggleTheme: () => void           — flip between light and dark
 */
export const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
})
