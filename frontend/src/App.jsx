import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { AppLayout } from "@/components/layout"
import { useSession } from "@/session/useSession"
import { LoginPage } from "@/pages/LoginPage"
// Import the landing page directly (not via the pages barrel) so the lazy
// imports below can actually code-split the secondary routes into their own
// chunks. Importing through the barrel would pull every page into this chunk.
import { DashboardPage } from "@/pages/DashboardPage"
import "./pages/pages.css"

/* --- Teacher portal pages (lazy) ----------------------------------------- */
const StudentsPage = lazy(() =>
  import("@/pages/StudentsPage").then((m) => ({ default: m.StudentsPage })),
)
const StudentDetailPage = lazy(() =>
  import("@/pages/StudentDetailPage").then((m) => ({
    default: m.StudentDetailPage,
  })),
)
const AssessmentsPage = lazy(() =>
  import("@/pages/AssessmentsPage").then((m) => ({
    default: m.AssessmentsPage,
  })),
)
const AssessmentCreatePage = lazy(() =>
  import("@/pages/AssessmentCreatePage").then((m) => ({
    default: m.AssessmentCreatePage,
  })),
)
const AssessmentSharePage = lazy(() =>
  import("@/pages/AssessmentSharePage").then((m) => ({
    default: m.AssessmentSharePage,
  })),
)
const ReviewPage = lazy(() =>
  import("@/pages/ReviewPage").then((m) => ({ default: m.ReviewPage })),
)
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
)
const NotFoundPage = lazy(() =>
  import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
)

/* --- Learner pages (lazy) ------------------------------------------------- */
const LearnerHomePage = lazy(() =>
  import("@/pages/LearnerHomePage").then((m) => ({
    default: m.LearnerHomePage,
  })),
)
const LearnerAssessmentPage = lazy(() =>
  import("@/pages/LearnerAssessmentPage").then((m) => ({
    default: m.LearnerAssessmentPage,
  })),
)

/* --- Public (unauthenticated) student take flow (lazy) ------------------- */
const StudentPage = lazy(() =>
  import("@/pages/StudentPage").then((m) => ({ default: m.StudentPage })),
)

/** Lightweight fallback while a lazy route chunk loads. */
function RouteFallback() {
  return (
    <div style={{ padding: "var(--space-6)", color: "var(--color-text-muted)" }}>
      Loading…
    </div>
  )
}

/**
 * TeacherApp — the full teacher portal (dashboard, roster, authoring, review,
 * settings). Only mounted for users whose role is "teacher".
 */
function TeacherApp() {
  return (
    <Routes>
      {/* Public student view (QR target) — outside the teacher layout. */}
      <Route
        path="/s"
        element={
          <Suspense fallback={<RouteFallback />}>
            <StudentPage />
          </Suspense>
        }
      />
      <Route
        path="/s/:code"
        element={
          <Suspense fallback={<RouteFallback />}>
            <StudentPage />
          </Suspense>
        }
      />

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
          path="assessments/new"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AssessmentCreatePage />
            </Suspense>
          }
        />
        <Route
          path="assessments/:code/review"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ReviewPage />
            </Suspense>
          }
        />
        <Route
          path="assessments/:code"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AssessmentSharePage />
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
  )
}

/**
 * LearnerApp — the learner's own surface ONLY: their assessment list and the
 * detail/take/results view for their own assessments. Deliberately has no
 * access to the teacher portal (no dashboard, roster, authoring, or review),
 * so a signed-in learner can never reach teacher-only features.
 */
function LearnerApp() {
  return (
    <Routes>
      <Route
        index
        element={
          <Suspense fallback={<RouteFallback />}>
            <LearnerHomePage />
          </Suspense>
        }
      />
      <Route
        path="me/assessments/:assessmentId"
        element={
          <Suspense fallback={<RouteFallback />}>
            <LearnerAssessmentPage />
          </Suspense>
        }
      />
      {/* Any other path for a learner returns them to their home. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const { user, loading } = useSession()

  // While restoring a persisted session, show a neutral placeholder so we don't
  // flash the login screen for an already-signed-in user.
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          color: "var(--color-text-muted)",
        }}
      >
        Loading…
      </div>
    )
  }

  // Unauthenticated: show the sign-in screen (no portal chrome).
  if (!user) {
    return <LoginPage />
  }

  // Role-based surface: learners get ONLY their own assessments + feedback;
  // teachers get the full portal. This is the gate that keeps students out of
  // teacher-only features.
  const isLearner = user.role === "learner"

  return (
    <>
      {/* Skip link for keyboard users — jumps past the nav to the content. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {isLearner ? <LearnerApp /> : <TeacherApp />}
    </>
  )
}