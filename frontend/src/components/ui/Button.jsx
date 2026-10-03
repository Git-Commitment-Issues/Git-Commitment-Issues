import { cn } from '@/lib/cn'
import './Button.css'

/**
 * Button — the primary interactive primitive.
 *
 * Props:
 *   variant: 'primary' | 'accent' | 'ghost' | 'outline' | 'danger'  (default 'primary')
 *   size:    'sm' | 'md' | 'lg'                                      (default 'md')
 *   icon:    a lucide-react icon component (optional, rendered leading)
 *   iconRight: a lucide-react icon component (optional, rendered trailing)
 *   fullWidth: boolean
 *
 * Any lucide icon is passed as a component and sized here, so callers never
 * hand-write SVG markup.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  className,
  children,
  type = 'button',
  ...props
}) {
  const iconOnly = !children && (Icon || IconRight)

  return (
    <button
      type={type}
      className={cn(
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        fullWidth && 'btn--full',
        iconOnly && 'btn--icon-only',
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="btn__icon" aria-hidden="true" /> : null}
      {children ? <span className="btn__label">{children}</span> : null}
      {IconRight ? <IconRight className="btn__icon" aria-hidden="true" /> : null}
    </button>
  )
}
