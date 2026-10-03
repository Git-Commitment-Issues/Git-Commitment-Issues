import { cn } from '@/lib/cn'
import { useTheme } from '@/theme/useTheme'
import './Logo.css'

// Theme-specific logo marks live in /public and are swapped at runtime.
const LOGO_SRC = {
  dark: '/pahina-logo-dark.svg',
  light: '/pahina-logo-light.svg',
}

/**
 * Logo — the pahina. brand lockup: the theme-aware logo mark (SVG asset in
 * /public) plus the lowercase wordmark with an accent dot.
 *
 * Props:
 *   compact: boolean — render the mark only (used by the collapsed sidebar)
 */
export function Logo({ compact = false, className }) {
  const { theme } = useTheme()
  const src = LOGO_SRC[theme] ?? LOGO_SRC.dark

  return (
    <span className={cn('logo', className)} aria-label="pahina">
      <img className="logo__mark" src={src} alt="" aria-hidden="true" />
      {!compact ? (
        <span className="logo__word" aria-hidden="true">
          pahina<span className="logo__word-accent">.</span>
        </span>
      ) : null}
    </span>
  )
}
