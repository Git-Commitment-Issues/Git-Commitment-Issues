/* =============================================================================
   Route ordering — defines the left→right "position" of each page so page
   transitions can slide in a direction that matches the app's structure
   (not the browser history stack).

   Going to a higher-ranked page = forward (slide right).
   Going to a lower-ranked page  = backward (slide left).

   Ranks are spaced so sub-pages can sit just after their parent section.
   ========================================================================== */

// Ordered list of path prefixes, top-level sections first. More specific
// prefixes must come before their parent so matching picks the deepest one.
const ORDER = [
  { prefix: '/settings', rank: 40 },
  { prefix: '/assessments/new', rank: 31 },
  { prefix: '/assessments/', rank: 32 }, // a specific assessment (deeper than list)
  { prefix: '/assessments', rank: 30 },
  { prefix: '/students/', rank: 21 }, // a specific student (deeper than list)
  { prefix: '/students', rank: 20 },
  { prefix: '/', rank: 10 }, // dashboard (keep last — matches everything)
]

/**
 * Rank a pathname for transition direction. Unknown paths fall back to a high
 * rank so they read as "forward".
 */
export function routeRank(pathname) {
  const match = ORDER.find((o) =>
    o.prefix === '/' ? pathname === '/' : pathname.startsWith(o.prefix),
  )
  return match ? match.rank : 999
}
