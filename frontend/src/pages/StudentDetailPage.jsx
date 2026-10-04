import { Link, useNavigate, useParams } from "react-router-dom"
import { Trans, useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
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
          <ArrowLeft aria-hidden="true" /> {t("studentDetail.backToStudents")}
        </button>
        <Card padded>
          <EmptyState title={t("common.loading")} />
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
        <ArrowLeft aria-hidden="true" /> {t("studentDetail.backToStudents")}
      </button>

      <PageHeader
        title={t("studentDetail.title", { id: studentId })}
        subtitle={
          latest
            ? t("studentDetail.latestBatch", {
                code: latest.access_code,
                count: completedCount,
              })
            : t("studentDetail.noCompleted")
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
            <span className="detail__stat-label">
              {t("studentDetail.latestComprehension")}
            </span>
          </div>
          <div className="detail__stat">
            <span className="detail__stat-value">{completedCount}</span>
            <span className="detail__stat-label">
              {t("studentDetail.assessmentsCompleted")}
            </span>
          </div>
          <div className="detail__stat">
            <span className="detail__stat-value">
              {latestDiagnosis
                ? t(
                    `diagnosis.${latestDiagnosis}`,
                    diagnosisInfo(latestDiagnosis).label,
                  )
                : "—"}
            </span>
            <span className="detail__stat-label">
              {t("studentDetail.latestDiagnosis")}
            </span>
          </div>
        </div>
      </div>

      <section className="grid-2">
        <Card>
          <Card.Header
            title={t("studentDetail.assessmentHistory")}
            subtitle={t("studentDetail.assessmentHistorySub")}
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
                title={t("studentDetail.noHistory")}
                message={t("studentDetail.noHistorySub")}
              />
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            title={t("studentDetail.latestDiagnosis")}
            action={
              <Badge tone="accent" icon={Target}>
                {t("studentDetail.diagnosis")}
              </Badge>
            }
          />
          <Card.Body>
            {latestDiagnosis ? (
              <p className="detail__recommendation">
                <Trans
                  i18nKey="studentDetail.recommendation"
                  values={{
                    level: t(
                      `diagnosis.${latestDiagnosis}`,
                      diagnosisInfo(latestDiagnosis).label,
                    ),
                    score: latestScore != null ? `${latestScore}%` : "—",
                  }}
                  components={{ 1: <strong />, 2: <strong /> }}
                />
              </p>
            ) : (
              <EmptyState
                title={t("studentDetail.notEvaluated")}
                message={t("studentDetail.notEvaluatedSub")}
              />
            )}
          </Card.Body>
        </Card>
      </section>
    </div>
  )
}