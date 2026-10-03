import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'
import { CountUp } from './CountUp'
import './StatCard.css'

/**
 * StatCard — a single headline metric for the dashboard. The value counts up
 * on entrance, and the card lifts on hover.
 *
 * Props:
 *   icon:   lucide-react icon component
 *   label:  metric name
 *   value:  the primary number/string
 *   hint:   small supporting text (e.g. "of 32 students")
 *   tone:   'primary' | 'accent' | 'success' | 'error'  (icon tint)
 *   countUp: animate the value upward (default true)
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'primary',
  countUp = true,
}) {
  return (
    <Card className="stat-card">
      <span className={cn('stat-card__icon', `stat-card__icon--${tone}`)}>
        <Icon aria-hidden="true" />
      </span>
      <div className="stat-card__body">
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">
          {countUp ? <CountUp value={value} /> : value}
        </p>
        {hint ? <p className="stat-card__hint">{hint}</p> : null}
      </div>
    </Card>
  )
}
