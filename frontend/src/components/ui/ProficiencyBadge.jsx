import { Badge } from './Badge'
import { PROFICIENCY } from './proficiency'

/**
 * ProficiencyBadge — domain primitive for AnaRead reading-comprehension levels.
 *
 * The AI assessment reports a level per comprehension skill (Main Idea,
 * Inference, Vocabulary in Context, etc). This maps each level to a consistent
 * tone + icon so proficiency reads the same everywhere in the app.
 *
 * Props:
 *   level: 'proficient' | 'developing' | 'needs-practice'
 */
export function ProficiencyBadge({ level = 'developing', ...props }) {
  const config = PROFICIENCY[level] ?? PROFICIENCY.developing
  return (
    <Badge tone={config.tone} icon={config.icon} {...props}>
      {config.label}
    </Badge>
  )
}
