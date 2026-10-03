import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, History, Target } from "lucide-react"
import { PageHeader } from "@/components/layout"
import { Card, Avatar, Badge, ProficiencyBadge, EmptyState } from "@/components/ui"
import { useAsync } from "@/hooks/useAsync"
import { repository } from "@/services"
import { diagnosisInfo, diagnosisToLevel } from "@/domain/constants"
import "./StudentDetailPage.css"

/**
 * StudentDetailPage — the individual report view, backed by the student
 * progress API (the learner's completed assessments over time). Uses the
 * existing design primitives; the "assessment history" section renders real
 * completed batches from the backend.
 */
export function StudentDetailPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  const { data, loading } = useAsync(
    () => repository.getStudentProgress(studentId),
    [studentId],
  )

  if (loading) {
    return (
      <div className="stack">
        <button type="button" className="detail__back" onClick={() => navigate(-1)}>
          <ArrowLeft aria-hidden="true" /> Back to students
        </button>
        <Card padded>
          <EmptyState title="Loading…" />
        </Card>
      </div>
    )
  }

  const history = data ?? []
  // The most recent completed assessment anchors the headline stats.
  const latest = history.length > 0 ? history[history.length - 1] : null
  const completedCount = history.length
  const latestScore =
    latest?.comprehension_score != null
      ? Math.round(Number(latest.comprehension_score))
      : null
  const latestDiagnosis = latest?.diagnosis ?? null

  return (
    <div className="stack">
      <button type="button" className="detail__back" onClick={() => navigate(-1)}>
        <ArrowLeft aria-hidden="true" /> Back to students
      </button>

      <PageHeader
        title={`Student #${studentId}`}
        subtitle={
          latest
            ? `Latest batch ${latest.access_code} · ${completedCount} completed`
            : "No completed assessments yet"
        }
        actions={
          latestDiagnosis ? (
            <ProficiencyBadge level={diagnosisToLevel(latestDiagnosis)} />
          ) : null
        }
      />

      <div className="detail__identity">
        <Avatar name={`#${studentId}`} size="lg" />
        <div className="detail__identity-stats">
          <div className="detail__stat">
            <span className="detail__stat-value">
              {latestScore != null ? `${latestScore}%` : "—"}
            </span>
            <span className="detail__stat-label">Latest comprehension</span>
          </div>
          <div className="detail__stat">
            <span className="detail__stat-value">{completedCount}</span>
            <span className="detail__stat-label">Assessments completed</span>
          </div>
          <div className="detail__stat">
            <span className="detail__stat-value">
              {latestDiagnosis ? diagnosisInfo(latestDiagnosis).label : "—"}
            </span>
            <span className="detail__stat-label">Latest diagnosis</span>
          </div>
        </div>
      </div>

      <section className="grid-2">
        <Card>
          <Card.Header
            title="Assessment history"
            subtitle="Completed reading assessments over time"
          />
          <Card.Body>
            {history.length > 0 ? (
              <ul className="row-list">
                {history
                  .slice()
                  .reverse()
                  .map((item) => (
                    <li key={item.access_code} className="support-row">
                      <Link
                        to={`/assessments/${item.access_code}`}
                        className="support-row__link"
                      >
                        <span className="support-row__meta">
                          <span className="support-row__name">{item.title}</span>
                          <span className="support-row__code">
                            {item.scheduled_for}
                          </span>
                        </span>
                        <span>
                          {item.comprehension_score != null
                            ? `${Math.round(Number(item.comprehension_score))}%`
                            : "—"}
                        </span>
                        <ProficiencyBadge level={diagnosisToLevel(item.diagnosis)} />
                      </Link>
                    </li>
                  ))}
              </ul>
            ) : (
              <EmptyState
                variant="awaiting"
                icon={History}
                title="No history yet"
                message="Completed assessments and progress over time appear here once this learner submits."
              />
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            title="Latest diagnosis"
            action={
              <Badge tone="accent" icon={Target}>
                Diagnosis
              </Badge>
            }
          />
          <Card.Body>
            {latestDiagnosis ? (
              <p className="detail__recommendation">
                The most recent evaluation places this learner at{" "}
                <strong>{diagnosisInfo(latestDiagnosis).label}</strong> with a
                comprehension score of{" "}
                <strong>{latestScore != null ? `${latestScore}%` : "—"}</strong>.
                Open the batch review to see per-question verdicts and the AI
                recommendation.
              </p>
            ) : (
              <EmptyState
                title="Not evaluated yet"
                message="A diagnosis appears after the learner completes an assessment and it is graded."
              />
            )}
          </Card.Body>
        </Card>
      </section>
    </div>
  )
}