import { cn } from '@/lib/cn'
import './Card.css'

/**
 * Card — the primary surface container.
 *
 * Composition:
 *   <Card>
 *     <Card.Header title="..." subtitle="..." action={<Button/>} />
 *     <Card.Body>...</Card.Body>
 *   </Card>
 *
 * Props:
 *   as:       element/component to render as (default 'section')
 *   padded:   boolean — apply inner padding (default true)
 *   raised:   boolean — use the raised surface + shadow
 *   interactive: boolean — hover affordance for clickable cards
 */
export function Card({
  as: Tag = 'section',
  padded = true,
  raised = false,
  interactive = false,
  className,
  children,
  ...props
}) {
  return (
    <Tag
      className={cn(
        'card',
        padded && 'card--padded',
        raised && 'card--raised',
        interactive && 'card--interactive',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

function CardHeader({ title, subtitle, action, className, children }) {
  return (
    <header className={cn('card__header', className)}>
      <div className="card__header-text">
        {title ? <h3 className="card__title">{title}</h3> : null}
        {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
        {children}
      </div>
      {action ? <div className="card__header-action">{action}</div> : null}
    </header>
  )
}

function CardBody({ className, children }) {
  return <div className={cn('card__body', className)}>{children}</div>
}

Card.Header = CardHeader
Card.Body = CardBody
