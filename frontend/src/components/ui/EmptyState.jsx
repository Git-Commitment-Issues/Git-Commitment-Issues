/**
 * EmptyState — a neutral placeholder for "nothing here yet" / "not found".
 * Reuses the existing `.empty-state` CSS classes already used across pages
 * (see StudentDetailPage / pages.css), so it introduces no new visual design.
 *
 * Props:
 *   icon:    optional lucide-react icon component
 *   title:   heading text
 *   message: supporting text
 *   variant: optional modifier (e.g. "awaiting") -> `.empty-state--awaiting`
 *   children: optional actions rendered below the message
 */
export function EmptyState({ icon: Icon, title, message, variant, children }) {
  const cls = variant ? `empty-state empty-state--${variant}` : "empty-state"
  return (
    <div className={cls}>
      {Icon ? (
        <span className="empty-state__icon">
          <Icon aria-hidden="true" />
        </span>
      ) : null}
      {title ? <h3>{title}</h3> : null}
      {message ? <p>{message}</p> : null}
      {children}
    </div>
  )
}