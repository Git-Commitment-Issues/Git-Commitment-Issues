import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'
import './StatCard.css'

/**
 * StatCard — a single headline metric for the dashboard.
 *
 * Props:
 *   icon:   lucide-react icon component
 *   label:  metric name
 *   value:  the primary number/string
 *   hint:   small supporting text (e.g. "of 32 students")
 *   tone:   'primary' | 'accent' | 'success' | 'error'  (icon tint)
 */
export function StatCard({ icon: Icon, label, value, hint, tone = 'primary' }) {
  return (
    <Card className="stat-card">
      <span className={cn('stat-card__icon', `stat-card__icon--${tone}`)}>
        <Icon aria-hidden="true" />
      </span>
      <div className="stat-card__body">
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value}</p>
        {hint ? <p className="stat-card__hint">{hint}</p> : null}
      </div>
    </Card>
  )
}
