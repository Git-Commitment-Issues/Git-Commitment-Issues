import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '@/components/ui'
import { useTheme } from '@/theme/useTheme'

/**
 * ThemeToggle — flips between light and dark. Shows the icon for the theme you
 * would switch *to*, and announces the target in its accessible label.
 */
export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <IconButton
      icon={isDark ? Sun : Moon}
      label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      onClick={toggleTheme}
      aria-pressed={isDark}
    />
  )
}
