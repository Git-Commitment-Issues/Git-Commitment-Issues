import { cn } from '@/lib/cn'
import dragonWelcome from '@/assets/dragon-welcome.svg'
import dragonReading from '@/assets/dragon-reading-a-book.svg'
import dragonStar from '@/assets/happy-dragon-holding-a-star.svg'
import dragonSkeptical from '@/assets/dragon-skeptical.svg'
import './Mascot.css'

/**
 * Mascot — the pahina dragon, used to add personality to pages. Decorative, so
 * it's hidden from assistive tech. Pick a variant by its label; size with the
 * `size` prop. Images keep their intrinsic aspect ratio.
 *
 * Props:
 *   variant: 'welcome' | 'reading' | 'star' | 'skeptical'
 *   size:    'sm' | 'md' | 'lg'  (default 'md')
 *   float:   gentle idle bob animation (default false)
 */
const SRC = {
  welcome: dragonWelcome,
  reading: dragonReading,
  star: dragonStar,
  skeptical: dragonSkeptical,
}

export function Mascot({ variant = 'welcome', size = 'md', float = false, className }) {
  const src = SRC[variant] ?? SRC.welcome
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('mascot', `mascot--${size}`, float && 'mascot--float', className)}
    />
  )
}
