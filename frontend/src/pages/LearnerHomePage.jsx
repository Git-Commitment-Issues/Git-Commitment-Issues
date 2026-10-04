import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { BookOpen, Bell, CheckCircle2, Clock } from "lucide-react"
import { Logo } from "@/components/brand/Logo"
import { Mascot } from "@/components/brand/Mascot"
import { ThemeToggle, LanguageToggle } from "@/components/layout"
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
  const { t } = useTranslation()
  return (
    <div className="learner">
      <header className="learner__bar">
        <Logo />
        <div className="learner__bar-right">
          <span className="learner__who">{userName}</span>
          <LanguageToggle />
          <ThemeToggle />
          <Button variant="ghost" onClick={onLogout}>
            {t("learner.signOut")}
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
  const { t } = useTranslation()
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
              {t("learner.newFeedback")}
            </Badge>
          ) : null}
          {a.status === "completed" ? (
            scored ? (
              <ProficiencyBadge level={diagnosisToLevel(a.diagnosis)} />
            ) : (
              <Badge tone="primary" dot>
                {t("learner.checking")}
              </Badge>
            )
          ) : (
            <Badge tone={status.tone} dot>
              {t(`status.${a.status}`, status.label)}
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
  const { t } = useTranslation()
  const { user, logout } = useSession()
  const { data, loading } = useAsync(() => repository.listMyAssessments(), [])

  const upcoming = data?.upcoming ?? []
  const previous = data?.previous ?? []
  const alert = data?.alert ?? false

  return (
    <LearnerShell userName={user?.name ?? t("learner.defaultName")} onLogout={logout}>
      <div className="stack">
        <header className="learner__header">
          <div className="learner__header-text">
            <p className="learner__eyebrow">
              {user?.name
                ? t("learner.welcome", { name: user.name })
                : t("learner.welcomeNoName")}
            </p>
            <h1 className="learner__title">{t("learner.yourAssessments")}</h1>
            <p className="learner__subtitle">{t("learner.yourAssessmentsSub")}</p>
          </div>
          <Mascot
            variant="star"
            size="md"
            float
            className="learner__header-mascot"
          />
        </header>

        {alert ? (
          <Card raised className="learner__alert">
            <Bell aria-hidden="true" />
            <span>{t("learner.newFeedbackBanner")}</span>
          </Card>
        ) : null}

        <Card>
          <Card.Header
            title={
              <span className="learner-section__title">
                <span className="learner-section__title-icon learner-section__title-icon--todo">
                  <Clock aria-hidden="true" />
                </span>
                {t("learner.toDo")}
              </span>
            }
            subtitle={t("learner.toDoSub")}
          />
          <Card.Body>
            {loading ? (
              <EmptyState title={t("common.loading")} />
            ) : upcoming.length > 0 ? (
              <ul className="row-list">
                {upcoming.map((item) => (
                  <AssessmentRow key={item.assessment.id} item={item} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title={t("learner.allCaughtUp")}
                message={t("learner.allCaughtUpSub")}
              />
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            title={
              <span className="learner-section__title">
                <span className="learner-section__title-icon learner-section__title-icon--done">
                  <CheckCircle2 aria-hidden="true" />
                </span>
                {t("learner.completed")}
              </span>
            }
            subtitle={t("learner.completedSub")}
          />
          <Card.Body>
            {loading ? (
              <EmptyState title={t("common.loading")} />
            ) : previous.length > 0 ? (
              <ul className="row-list">
                {previous.map((item) => (
                  <AssessmentRow key={item.assessment.id} item={item} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={BookOpen}
                title={t("learner.nothingCompleted")}
                message={t("learner.nothingCompletedSub")}
              />
            )}
          </Card.Body>
        </Card>
      </div>
    </LearnerShell>
  )
}

export { LearnerShell }