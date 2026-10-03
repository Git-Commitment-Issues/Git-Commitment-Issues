import { cn } from '@/lib/cn'
import './IconButton.css'

/**
 * IconButton — compact, square control for toolbars and top bars.
 * Requires an accessible `label` (rendered as aria-label) since it has no text.
 *
 * Props:
 *   icon:  a lucide-react icon component (required)
 *   label: accessible name (required)
 *   badge: boolean — show a small dot indicator (e.g. unread notifications)
 */
export function IconButton({
  icon: Icon,
  label,
  badge = false,
  className,
  ...props
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('icon-btn', className)}
      {...props}
    >
      <Icon className="icon-btn__glyph" aria-hidden="true" />
      {badge ? <span className="icon-btn__badge" aria-hidden="true" /> : null}
    </button>
  )
}
