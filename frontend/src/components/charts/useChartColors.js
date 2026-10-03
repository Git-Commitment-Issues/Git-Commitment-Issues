import { useEffect, useState } from 'react'
import { useTheme } from '@/theme/useTheme'

/**
 * Reads the palette from CSS custom properties so Recharts (which needs real
 * color strings, not var()) stays in sync with the active theme. Re-reads
 * whenever the theme changes.
 */
export function useChartColors() {
  const { theme } = useTheme()
  const [colors, setColors] = useState(() => read())

  useEffect(() => {
    // Next frame so the data-theme attribute + vars have applied.
    const id = requestAnimationFrame(() => setColors(read()))
    return () => cancelAnimationFrame(id)
  }, [theme])

  return colors
}

function read() {
  if (typeof window === 'undefined') return FALLBACK
  const s = getComputedStyle(document.documentElement)
  const get = (name, fallback) => s.getPropertyValue(name).trim() || fallback
  return {
    primary: get('--color-primary', '#3bb8d0'),
    accent: get('--color-accent', '#7a4fdb'),
    success: get('--color-success', '#22d16b'),
    error: get('--color-error', '#ff4d4d'),
    text: get('--color-text', '#f5f7f9'),
    textMuted: get('--color-text-muted', '#868d96'),
    border: get('--color-border', '#2c2f35'),
    surface: get('--color-surface', '#141518'),
    surfaceRaised: get('--color-surface-raised', '#1c1e22'),
  }
}

const FALLBACK = {
  primary: '#3bb8d0',
  accent: '#7a4fdb',
  success: '#22d16b',
  error: '#ff4d4d',
  text: '#f5f7f9',
  textMuted: '#868d96',
  border: '#2c2f35',
  surface: '#141518',
  surfaceRaised: '#1c1e22',
}
