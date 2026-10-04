import { useTranslation } from 'react-i18next'
import { Badge } from './Badge'
import { PROFICIENCY } from './proficiency'

/**
 * ProficiencyBadge — domain primitive for AnaRead reading-comprehension levels.
 *
 * The AI assessment reports a level per comprehension skill (Main Idea,
 * Inference, Vocabulary in Context, etc). This maps each level to a consistent
 * tone + icon so proficiency reads the same everywhere in the app. The label is
 * localized, falling back to the English taxonomy label.
 *
 * Props:
 *   level: 'proficient' | 'developing' | 'needs-practice'
 */
export function ProficiencyBadge({ level = 'developing', ...props }) {
  const { t } = useTranslation()
  const key = PROFICIENCY[level] ? level : 'developing'
  const config = PROFICIENCY[key]
  return (
    <Badge tone={config.tone} icon={config.icon} {...props}>
      {t(`proficiency.${key}`, config.label)}
    </Badge>
  )
}
