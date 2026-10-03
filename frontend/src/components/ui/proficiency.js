import { CircleCheck, CircleDot, TriangleAlert } from 'lucide-react'

/**
 * Proficiency levels for AnaRead reading-comprehension skills.
 * Each level maps to a Badge tone + lucide icon so proficiency reads the same
 * everywhere in the app. Kept in its own module (no component exports) so the
 * component file stays fast-refresh friendly.
 */
export const PROFICIENCY = {
  proficient: { label: 'Proficient', tone: 'success', icon: CircleCheck },
  developing: { label: 'Developing', tone: 'primary', icon: CircleDot },
  'needs-practice': {
    label: 'Needs Practice',
    tone: 'error',
    icon: TriangleAlert,
  },
}

/** Ordered list of level keys. */
export const PROFICIENCY_LEVELS = Object.keys(PROFICIENCY)
