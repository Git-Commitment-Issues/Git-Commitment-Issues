import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PanelLeftClose, X, QrCode } from 'lucide-react'
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
  const { t } = useTranslation()
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
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          <PanelLeftClose className="sidebar__collapse-icon" aria-hidden="true" />
        </button>
        {/* Mobile close control */}
        <button
          type="button"
          className="sidebar__close"
          onClick={onCloseMobile}
          aria-label={t('topbar.closeNav')}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <nav className="sidebar__nav">
        <ul className="sidebar__list">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon, descriptionKey, end }) => {
            const label = t(labelKey)
            return (
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
                  <span className="sidebar__link-desc">{t(descriptionKey)}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="sidebar__foot">
        {/* Takes teachers to the real assessment QR generator. Students scan
            the generated code and enter their existing LRN to continue. */}
        <NavLink
          className="sidebar__help"
          to="/assessments"
          onClick={onCloseMobile}
          title={t('nav.generateStudentQr')}
        >
          <QrCode className="sidebar__link-icon" aria-hidden="true" />
          <span className="sidebar__link-label">{t('nav.generateStudentQr')}</span>
        </NavLink>
      </div>
    </aside>
  )
}
