import { cn } from '@/lib/cn'
import './Avatar.css'

/**
 * Derive up-to-two uppercase initials from a full name.
 * "Juan Dela Cruz" -> "JC", "Maria" -> "M".
 */
function initialsFrom(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Pick a deterministic brand tint from the name so each person keeps a stable
 * color across renders (purely cosmetic; both options meet contrast on the fill).
 */
const TINTS = ['tint-primary', 'tint-accent', 'tint-success']
function tintFor(name = '') {
  let sum = 0
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i)
  return TINTS[sum % TINTS.length]
}

/**
 * Avatar — initials-based identity marker.
 *
 * Props:
 *   name:  full name (used for initials + accessible label)
 *   src:   optional image URL (falls back to initials if absent)
 *   size:  'sm' | 'md' | 'lg'  (default 'md')
 */
export function Avatar({ name = '', src, size = 'md', className, ...props }) {
  return (
    <span
      className={cn('avatar', `avatar--${size}`, !src && tintFor(name), className)}
      role="img"
      aria-label={name || 'User'}
      {...props}
    >
      {src ? (
        <img className="avatar__img" src={src} alt="" />
      ) : (
        <span className="avatar__initials" aria-hidden="true">
          {initialsFrom(name)}
        </span>
      )}
    </span>
  )
}
