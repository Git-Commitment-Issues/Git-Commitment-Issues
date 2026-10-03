import { cn } from '@/lib/cn'
import './Logo.css'

/**
 * Logo — the pahina. wordmark.
 *
 * The mark is a book-spread glyph built from theme tokens (not a raster asset),
 * so it recolors automatically with the active theme. The wordmark is all
 * lowercase with an accent dot, set in the display family with tight tracking.
 *
 * Props:
 *   compact: boolean — render the mark only (used by the collapsed sidebar)
 */
export function Logo({ compact = false, className }) {
  return (
    <span className={cn('logo', className)} aria-label="pahina">
      <span className="logo__mark" aria-hidden="true">
        <span className="logo__page logo__page--left" />
        <span className="logo__page logo__page--right" />
      </span>
      {!compact ? (
        <span className="logo__word" aria-hidden="true">
          pahina<span className="logo__word-accent">.</span>
        </span>
      ) : null}
    </span>
  )
}
