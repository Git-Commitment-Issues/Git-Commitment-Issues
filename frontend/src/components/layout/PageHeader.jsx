import './PageHeader.css'

/**
 * PageHeader — the title block at the top of each page.
 * Large display title with tight tracking + an optional eyebrow and actions.
 *
 * Props:
 *   eyebrow: small uppercase label above the title (optional)
 *   title:   page title (required)
 *   subtitle: supporting line under the title (optional)
 *   actions: node rendered on the trailing side (buttons, etc.)
 */
export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="page-header__title">{title}</h1>
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  )
}
