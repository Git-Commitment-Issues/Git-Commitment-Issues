import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
// Import the landing page directly (not via the pages barrel) so the lazy
// imports below can actually code-split the secondary routes into their own
// chunks. Importing through the barrel would pull every page into this chunk.
import { DashboardPage } from '@/pages/DashboardPage'
import './pages/pages.css'

// Lazy-load secondary routes so the initial bundle stays lean. Each page is
// code-split and fetched on first navigation.
const StudentsPage = lazy(() =>
  import('@/pages/StudentsPage').then((m) => ({ default: m.StudentsPage })),
)
const StudentDetailPage = lazy(() =>
  import('@/pages/StudentDetailPage').then((m) => ({
    default: m.StudentDetailPage,
  })),
)
const AssessmentsPage = lazy(() =>
  import('@/pages/AssessmentsPage').then((m) => ({
    default: m.AssessmentsPage,
  })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)

/** Lightweight fallback while a lazy route chunk loads. */
function RouteFallback() {
  return (
    <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <>
      {/* Skip link for keyboard users — jumps past the nav to the content. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route
            path="students"
            element={
              <Suspense fallback={<RouteFallback />}>
                <StudentsPage />
              </Suspense>
            }
          />
          <Route
            path="students/:studentId"
            element={
              <Suspense fallback={<RouteFallback />}>
                <StudentDetailPage />
              </Suspense>
            }
          />
          <Route
            path="assessments"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AssessmentsPage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<RouteFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route
            path="404"
            element={
              <Suspense fallback={<RouteFallback />}>
                <NotFoundPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </>
  )
}
