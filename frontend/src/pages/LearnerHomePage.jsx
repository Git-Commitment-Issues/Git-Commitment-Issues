import { Link } from "react-router-dom"
import { BookOpen, Bell, CheckCircle2, Clock } from "lucide-react"
import { Logo } from "@/components/brand/Logo"
import { ThemeToggle } from "@/components/layout"
import { Card, Badge, Button, ProficiencyBadge, EmptyState } from "@/components/ui"
import { useSession } from "@/session/useSession"
import { useAsync } from "@/hooks/useAsync"
import { repository } from "@/services"
import { diagnosisToLevel, statusInfo } from "@/domain/constants"
import "./LearnerHomePage.css"

/**
 * Page chrome for the signed-in learner. Deliberately minimal: just the brand
 * and a theme toggle plus a sign-out — NO teacher sidebar or teacher nav, so a
 * learner can only ever reach their own assessments and feedback.
 */
function LearnerShell({ userName, onLogout, children }) {
  return (
    <div className="learner">
      <header className="learner__bar">
        <Logo />
        <div className="learner__bar-right">
          <span className="learner__who">{userName}</span>
          <ThemeToggle />
          <Button variant="ghost" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="learner__main" id="main-content">
        <div className="learner__container">{children}</div>
      </main>
    </div>
  )
}

/** One assessment row in the learner's list. */
function AssessmentRow({ item }) {
  const a = item.assessment
  const status = statusInfo(a.status)
  const scored = a.comprehension_score != null
  return (
    <li className="learner-row">
      <Link to={`/me/assessments/${a.id}`} className="learner-row__link">
        <span className="learner-row__meta">
          <span className="learner-row__title">{a.title}</span>
          <span className="learner-row__sub">
            <Clock aria-hidden="true" /> {a.scheduled_for}
          </span>
        </span>

        <span className="learner-row__status">
          {item.has_correction_alert ? (
            <Badge tone="accent" icon={Bell}>
              New feedback
            </Badge>
          ) : null}
          {a.status === "completed" ? (
            scored ? (
              <ProficiencyBadge level={diagnosisToLevel(a.diagnosis)} />
            ) : (
              <Badge tone="primary" dot>
                Checking…
              </Badge>
            )
          ) : (
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          )}
        </span>
      </Link>
    </li>
  )
}

/**
 * LearnerHomePage — the learner's whole app: the assessments assigned to them
 * (upcoming) and the ones they've completed (previous), with a badge when a
 * teacher has left new feedback. This is the entire learner surface by design —
 * no class dashboard, roster, or authoring tools.
 */
export function LearnerHomePage() {
  const { user, logout } = useSession()
  const { data, loading } = useAsync(() => repository.listMyAssessments(), [])

  const upcoming = data?.upcoming ?? []
  const previous = data?.previous ?? []
  const alert = data?.alert ?? false

  return (
    <LearnerShell userName={user?.name ?? "Learner"} onLogout={logout}>
      <div className="stack">
        <header className="learner__header">
          <p className="learner__eyebrow">Welcome{user?.name ? `, ${user.name}` : ""}</p>
          <h1 className="learner__title">Your assessments</h1>
          <p className="learner__subtitle">
            Take the reading checks assigned to you, then review your results and
            your teacher’s feedback.
          </p>
        </header>

        {alert ? (
          <Card raised className="learner__alert">
            <Bell aria-hidden="true" />
            <span>Your teacher left new feedback on one of your assessments.</span>
          </Card>
        ) : null}

        <Card>
          <Card.Header
            title="To do"
            subtitle="Assessments assigned to you that aren’t finished yet"
          />
          <Card.Body>
            {loading ? (
              <EmptyState title="Loading…" />
            ) : upcoming.length > 0 ? (
              <ul className="row-list">
                {upcoming.map((item) => (
                  <AssessmentRow key={item.assessment.id} item={item} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="All caught up"
                message="You have no assessments waiting right now."
              />
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            title="Completed"
            subtitle="Your previous assessments and results"
          />
          <Card.Body>
            {loading ? (
              <EmptyState title="Loading…" />
            ) : previous.length > 0 ? (
              <ul className="row-list">
                {previous.map((item) => (
                  <AssessmentRow key={item.assessment.id} item={item} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="Nothing completed yet"
                message="Once you finish an assessment, your results appear here."
              />
            )}
          </Card.Body>
        </Card>
      </div>
    </LearnerShell>
  )
}

export { LearnerShell }