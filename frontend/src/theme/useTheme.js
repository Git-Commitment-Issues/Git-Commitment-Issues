import { useContext } from 'react'
import { ThemeContext } from './ThemeContext'

/** Access the active theme and its setters from anywhere in the tree. */
export function useTheme() {
  return useContext(ThemeContext)
}
