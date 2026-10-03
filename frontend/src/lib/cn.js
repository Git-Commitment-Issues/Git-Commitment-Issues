/**
 * Tiny classname joiner. Filters out falsy values so you can write:
 *   cn('card', isActive && 'card--active', className)
 */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
