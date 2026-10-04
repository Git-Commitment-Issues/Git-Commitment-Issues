import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Trans, useTranslation } from "react-i18next"
import {
  ArrowLeft,
  Copy,
  Check,
  BookOpen,
  ListChecks,
  Users,
  PencilLine,
} from "lucide-react"
import { PageHeader } from "@/components/layout"
import { Card, Badge, Button, EmptyState, StatusBadge } from "@/components/ui"
import { QRCode } from "@/components/data"
import { useAsync } from "@/hooks/useAsync"
import { repository } from "@/services"
import { skillLabel } from "@/domain/constants"
import "./AssessmentSharePage.css"

/**
 * AssessmentSharePage — a scheduled assessment's detail + share screen, keyed
 * by access code and loaded from the backend. Shows the join code and a QR that
 * opens the student view, the passage, the questions, and the evaluation state.
 * The teacher can jump to the review screen to see verdicts and apply overrides.
 */
export function AssessmentSharePage() {
  const { t } = useTranslation()
  const { code } = useParams()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const { data, loading } = useAsync(
    () => repository.getBatchByCode(code),
    [code],
  )

  if (loading) {
    return (
      <div className="stack">
        <Link to="/assessments" className="text-link">
          <ArrowLeft aria-hidden="true" /> {t("assessmentShare.backToAssessments")}
        </Link>
        <Card>
          <EmptyState title={t("common.loading")} />
        </Card>
      </div>
    )
  }

  const assessment = data?.assessment
  const answers = data?.answers ?? []

  if (!assessment) {
    return (
      <div className="stack">
        <Link to="/assessments" className="text-link">
          <ArrowLeft aria-hidden="true" /> {t("assessmentShare.backToAssessments")}
        </Link>
        <Card>
          <EmptyState
            title={t("assessmentShare.notFound")}
            message={t("assessmentShare.notFoundSub")}
          />
        </Card>
      </div>
    )
  }

  const studentUrl = `${window.location.origin}/s/${assessment.access_code}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(studentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard may be blocked; the link is still shown to copy manually.
    }
  }

  return (
    <div className="stack">
      <button type="button" className="text-link" onClick={() => navigate(-1)}>
        <ArrowLeft aria-hidden="true" /> {t("assessmentShare.backToAssessments")}
      </button>

      <PageHeader
        eyebrow={t("assessmentShare.eyebrow")}
        title={assessment.title}
        actions={
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <StatusBadge status={assessment.status} />
            <Button variant="outline" icon={PencilLine}>
              <Link to={`/assessments/${assessment.access_code}/review`}>
                {t("assessmentShare.reviewGrade")}
              </Link>
            </Button>
          </div>
        }
      />

      {/* Share / QR */}
      <Card raised className="share">
        <div className="share__qr">
          <QRCode value={studentUrl} size={200} />
        </div>
        <div className="share__info">
          <h2 className="share__heading">{t("assessmentShare.joinWithCode")}</h2>
          <div className="share__code">{assessment.access_code}</div>
          <p className="share__hint">
            <Trans
              i18nKey="assessmentShare.scanHint"
              components={{ 1: <strong /> }}
            />
          </p>
          <div className="share__link-row">
            <code className="share__link">{studentUrl}</code>
            <Button
              variant="outline"
              icon={copied ? Check : Copy}
              onClick={copy}
            >
              {copied ? t("assessmentShare.copied") : t("assessmentShare.copyLink")}
            </Button>
          </div>
          <Button variant="ghost" icon={Users} className="share__preview">
            <Link to={`/s/${assessment.access_code}`}>
              {t("assessmentShare.openStudentView")}
            </Link>
          </Button>
        </div>
      </Card>

      <div className="grid-2">
        <Card>
          <Card.Header title={t("assessmentShare.passage")} />
          <Card.Body>
            <div className="share__passage-head">
              <BookOpen aria-hidden="true" />
            </div>
            <p className="share__passage">{assessment.passage_text}</p>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            title={t("assessmentShare.questions", { count: answers.length })}
          />
          <Card.Body>
            <ol className="share__questions">
              {answers.map((q, i) => (
                <li key={q.id} className="share__question">
                  <div className="share__q-head">
                    <span className="share__q-num">{i + 1}</span>
                    <Badge tone="neutral">
                      {t(`skills.${q.skill}`, skillLabel(q.skill))}
                    </Badge>
                  </div>
                  <p className="share__q-text">{q.question_text}</p>
                </li>
              ))}
            </ol>
          </Card.Body>
        </Card>
      </div>

      {/* Evaluation state */}
      <Card>
        <Card.Header
          title={t("assessmentShare.statusTitle")}
          subtitle={t("assessmentShare.statusSub")}
        />
        <Card.Body>
          {assessment.status === "completed" ? (
            <ul className="row-list">
              <li className="share__response">
                <span className="share__response-name">
                  {assessment.comprehension_score != null
                    ? t("assessmentShare.scored", {
                        score: Math.round(Number(assessment.comprehension_score)),
                      })
                    : assessment.evaluation_error
                      ? t("assessmentShare.evalNeedsAttention")
                      : t("assessmentShare.submittedEvaluating")}
                </span>
                <Badge
                  tone={
                    assessment.evaluation_error
                      ? "error"
                      : assessment.comprehension_score != null
                        ? "success"
                        : "primary"
                  }
                  dot
                >
                  {assessment.evaluation_error
                    ? t("assessmentShare.needsReview")
                    : assessment.comprehension_score != null
                      ? t("assessmentShare.graded")
                      : t("assessmentShare.pending")}
                </Badge>
              </li>
            </ul>
          ) : (
            <EmptyState
              icon={ListChecks}
              title={t("assessmentShare.noSubmission")}
              message={t("assessmentShare.noSubmissionSub")}
            />
          )}
        </Card.Body>
      </Card>
    </div>
  )
}