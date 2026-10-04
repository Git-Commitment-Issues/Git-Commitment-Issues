import { useEffect, useState } from "react"
import { ClassroomProvider } from "@/session/ClassroomProvider"
import { useSession } from "@/session/useSession"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { PageTransition } from "./PageTransition"
import "./AppLayout.css"

// Fallback shown before a session is resolved, so the shell still has a sane
// user label if rendered before login (normally the auth gate prevents this).
const PLACEHOLDER_USER = {
  name: "Ms. Elena Reyes",
  role: "Teacher · Grade 8 English",
}

/**
 * AppLayout — the shell every authenticated page renders inside.
 * Owns the responsive navigation state (desktop collapse + mobile drawer),
 * provides the active-classroom selection to the teacher portal, and renders
 * the active route via the direction-aware <PageTransition /> (new design).
 */
export function AppLayout() {
  const { user } = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close the mobile drawer with Escape for keyboard users.
  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mobileOpen])

  // Use the signed-in user when available; otherwise fall back to the
  // placeholder so the shell still renders a label.
  const topbarUser = user
    ? { name: user.name, role: "Teacher" }
    : PLACEHOLDER_USER

  return (
    <ClassroomProvider>
      <div className="app-shell">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          onCloseMobile={() => setMobileOpen(false)}
        />

        {/* Scrim behind the mobile drawer */}
        {mobileOpen ? (
          <button
            type="button"
            className="app-shell__scrim"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <div className="app-shell__main">
          <Topbar
            user={topbarUser}
            onOpenMobileNav={() => setMobileOpen(true)}
          />
          <main className="app-shell__content" id="main-content" tabIndex={-1}>
            <div className="app-shell__container">
              {/* New design: direction-aware route transition (renders the
                  active route via useOutlet internally). */}
              <PageTransition />
            </div>
          </main>
        </div>
      </div>
    </ClassroomProvider>
  )
}