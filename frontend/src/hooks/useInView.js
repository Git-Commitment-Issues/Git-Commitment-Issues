import { useEffect, useRef, useState } from 'react'

/**
 * useInView — reports when the attached element first scrolls into view.
 * Fires once (then disconnects) so entrance animations play on reveal, not on
 * mount. Returns [ref, inView].
 *
 * @param {object} [opts]
 * @param {number} [opts.threshold=0.25]  fraction visible before triggering
 * @param {string} [opts.rootMargin='0px 0px -10% 0px']  shrink/grow trigger box
 */
export function useInView({ threshold = 0.25, rootMargin = '0px 0px -10% 0px' } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    // No IntersectionObserver (or SSR) — just show it (async, not in effect body).
    if (typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => setInView(true))
      return () => cancelAnimationFrame(id)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, rootMargin])

  return [ref, inView]
}
