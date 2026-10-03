import { cn } from '@/lib/cn'
import './Badge.css'

/**
 * Badge — compact status / category pill.
 *
 * Props:
 *   tone: 'neutral' | 'primary' | 'accent' | 'success' | 'error'  (default 'neutral')
 *   icon: optional leading lucide-react icon component
 *   dot:  boolean — show a leading status dot instead of an icon
 */
export function Badge({
  tone = 'neutral',
  icon: Icon,
  dot = false,
  className,
  children,
  ...props
}) {
  return (
    <span className={cn('badge', `badge--${tone}`, className)} {...props}>
      {dot ? <span className="badge__dot" aria-hidden="true" /> : null}
      {Icon ? <Icon className="badge__icon" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
