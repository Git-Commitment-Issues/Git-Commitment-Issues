import { Bell, Menu, Search } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Avatar, IconButton } from "@/components/ui"
import { ThemeToggle } from "./ThemeToggle"
import "./Topbar.css"

/**
 * Topbar — persistent header above the content area.
 *
 * Holds: mobile menu trigger, a quick-search field, the theme toggle, a
 * notifications indicator, and the signed-in user's avatar. Clicking the user
 * button opens the profile page (sign-out now lives there).
 *
 * Props:
 *   onOpenMobileNav: () => void
 *   user: { name: string, role: string }
 */
export function Topbar({ onOpenMobileNav, user }) {
  const navigate = useNavigate()

  return (
    <header className="topbar">
      <div className="topbar__left">
        <IconButton
          icon={Menu}
          label="Open navigation"
          className="topbar__menu"
          onClick={onOpenMobileNav}
        />

        <div className="topbar__search" role="search">
          <Search className="topbar__search-icon" aria-hidden="true" />
          <input
            className="topbar__search-input"
            type="search"
            placeholder="Search students, assessments…"
            aria-label="Search students and assessments"
          />
        </div>
      </div>

      <div className="topbar__right">
        <ThemeToggle />
        <IconButton icon={Bell} label="Notifications" badge />

        <button
          type="button"
          className="topbar__user"
          onClick={() => navigate("/profile")}
          title="View profile"
        >
          <Avatar name={user.name} size="sm" />
          <span className="topbar__user-meta">
            <span className="topbar__user-name">{user.name}</span>
            <span className="topbar__user-role">{user.role}</span>
          </span>
        </button>
      </div>
    </header>
  )
}