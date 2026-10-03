import { Moon, Sun } from 'lucide-react'
import { IconButton } from '@/components/ui'
import { useTheme } from '@/theme/useTheme'

/**
 * ThemeToggle — flips between light and dark. Shows the icon for the theme you
 * would switch *to*, and announces the target in its accessible label.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <IconButton
      icon={isDark ? Sun : Moon}
      label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
      aria-pressed={isDark}
    />
  )
}
