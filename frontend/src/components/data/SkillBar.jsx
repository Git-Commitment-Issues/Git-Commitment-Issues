import { scoreToLevel } from '@/data/mockData'
import { cn } from '@/lib/cn'
import './SkillBar.css'

/**
 * SkillBar — labeled horizontal meter for one comprehension skill.
 * The fill color follows the proficiency level derived from the score, so the
 * same green/teal/red language used by ProficiencyBadge applies here too.
 *
 * Rendered as an accessible <meter>-style progressbar.
 *
 * Props:
 *   label: skill name
 *   score: 0-100
 */
export function SkillBar({ label, score }) {
  const level = scoreToLevel(score)
  return (
    <div className="skill-bar">
      <div className="skill-bar__row">
        <span className="skill-bar__label">{label}</span>
        <span className="skill-bar__value">{score}%</span>
      </div>
      <div
        className="skill-bar__track"
        role="progressbar"
        aria-label={`${label} score`}
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className={cn('skill-bar__fill', `skill-bar__fill--${level}`)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
