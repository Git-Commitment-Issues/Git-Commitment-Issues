import { useEffect, useRef, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { routeRank } from '@/config/routeOrder'
import './PageTransition.css'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// How long the staggered exit runs before we swap in the new page. Keep in
// sync with the exit animation + per-child stagger in PageTransition.css.
const EXIT_MS = 420

/**
 * PageTransition — direction-aware route choreography for the teacher portal.
 *
 * Direction comes from each page's position in the app (see routeOrder.js),
 * not the browser history. Moving to a page that sits further right slides
 * forward; moving to one that sits further left slides backward.
 *
 *   forward  → current page swipes OUT to the right, new page enters FROM the
 *              left.
 *   backward → current page swipes OUT to the left, new page enters FROM the
 *              right.
 *
 * Each is staggered top → bottom across the page's components. The outgoing
 * page stays mounted during the exit by holding its captured outlet element.
 */
export function PageTransition() {
  const location = useLocation()
  const outlet = useOutlet()
  const lastPathRef = useRef(location.pathname)

  const [display, setDisplay] = useState({
    element: outlet,
    key: location.pathname,
    phase: 'entering',
    direction: 'forward',
  })

  useEffect(() => {
    let raf = 0
    let timer = 0

    // Same route (e.g. a query/state change) — refresh the element in place.
    if (location.pathname === display.key) {
      if (outlet !== display.element) {
        raf = requestAnimationFrame(() =>
          setDisplay((d) => ({ ...d, element: outlet })),
        )
      }
      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(timer)
      }
    }

    // Direction = where the new page sits relative to the current one in the
    // app's left→right order. Lower rank means we're moving "back" (left).
    const fromRank = routeRank(lastPathRef.current)
    const toRank = routeRank(location.pathname)
    const direction = toRank < fromRank ? 'backward' : 'forward'
    lastPathRef.current = location.pathname

    if (prefersReducedMotion()) {
      raf = requestAnimationFrame(() =>
        setDisplay({
          element: outlet,
          key: location.pathname,
          phase: 'entering',
          direction,
        }),
      )
    } else {
      // Play the exit (in the detected direction), then swap in + enter.
      raf = requestAnimationFrame(() =>
        setDisplay((d) => ({ ...d, phase: 'exiting', direction })),
      )
      timer = window.setTimeout(() => {
        setDisplay({
          element: outlet,
          key: location.pathname,
          phase: 'entering',
          direction,
        })
      }, EXIT_MS)
    }

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
    // outlet identity changes with the route; pathname is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, outlet])

  return (
    <div
      key={display.key}
      className={`page-transition page-transition--${display.phase} page-transition--${display.direction}`}
    >
      {display.element}
    </div>
  )
}
