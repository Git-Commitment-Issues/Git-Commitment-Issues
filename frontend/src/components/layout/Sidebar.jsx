import { NavLink } from 'react-router-dom'
import { PanelLeftClose, X, GraduationCap } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { NAV_ITEMS } from '@/config/navigation'
import { cn } from '@/lib/cn'
import './Sidebar.css'

/**
 * Sidebar — primary navigation rail.
 *
 * Behaviour:
 *   - Desktop: fixed rail; `collapsed` shrinks it to icons only.
 *   - Mobile: slides in as an overlay drawer controlled by `mobileOpen`.
 *
 * Props:
 *   collapsed:        boolean (desktop icon-only mode)
 *   mobileOpen:       boolean (drawer visible on small screens)
 *   onToggleCollapse: () => void
 *   onCloseMobile:    () => void
 */
export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}) {
  return (
    <aside
      className={cn(
        'sidebar',
        collapsed && 'sidebar--collapsed',
        mobileOpen && 'sidebar--mobile-open',
      )}
      aria-label="Primary"
    >
      <div className="sidebar__head">
        <Logo compact={collapsed} />
        {/* Desktop collapse control */}
        <button
          type="button"
          className="sidebar__collapse"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <PanelLeftClose className="sidebar__collapse-icon" aria-hidden="true" />
        </button>
        {/* Mobile close control */}
        <button
          type="button"
          className="sidebar__close"
          onClick={onCloseMobile}
          aria-label="Close navigation"
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <nav className="sidebar__nav">
        <ul className="sidebar__list">
          {NAV_ITEMS.map(({ to, label, icon: Icon, description, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onCloseMobile}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn('sidebar__link', isActive && 'sidebar__link--active')
                }
              >
                <Icon className="sidebar__link-icon" aria-hidden="true" />
                <span className="sidebar__link-label">{label}</span>
                <span className="sidebar__link-desc">{description}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar__foot">
        {/* Opens the public student view in a new tab (for preview / demo). */}
        <a
          className="sidebar__help"
          href="/s"
          target="_blank"
          rel="noreferrer"
          title="Open the student view"
        >
          <GraduationCap className="sidebar__link-icon" aria-hidden="true" />
          <span className="sidebar__link-label">Student view</span>
        </a>
      </div>
    </aside>
  )
}
