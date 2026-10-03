import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// easeOutExpo — glides to a very soft stop; smoother than cubic for counters.
const ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/**
 * useCountUp — animate a number from 0 up to `target` once, on mount.
 * Honors reduced-motion (jumps straight to the target).
 *
 * @param {number} target     the final value
 * @param {object} [opts]
 * @param {number} [opts.duration=1800]  ms (slower = smoother)
 * @param {number} [opts.decimals=0]     decimal places to show
 * @returns {number} the current (rounded) display value
 */
export function useCountUp(target, { duration = 1800, decimals = 0 } = {}) {
  const safeTarget = Number.isFinite(target) ? target : 0
  const [value, setValue] = useState(() =>
    prefersReducedMotion() ? safeTarget : 0,
  )
  const rafRef = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      // Snap to target on the next frame (async, so no setState-in-effect).
      rafRef.current = requestAnimationFrame(() => setValue(safeTarget))
      return () => cancelAnimationFrame(rafRef.current)
    }
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const next = safeTarget * ease(p)
      const factor = 10 ** decimals
      setValue(Math.round(next * factor) / factor)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [safeTarget, duration, decimals])

  return value
}
