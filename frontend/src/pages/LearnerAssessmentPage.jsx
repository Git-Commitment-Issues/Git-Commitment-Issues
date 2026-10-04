import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  ArrowLeft,
  BookOpen,
  Send,
  CheckCircle2,
  Sparkles,
  Check,
} from "lucide-react"
import { PageHeader } from "@/components/layout"
import {
  Card,
  Badge,
  Button,
  ProficiencyBadge,
  VerdictBadge,
  EmptyState,
} from "@/components/ui"
import { useAsync } from "@/hooks/useAsync"
import { repository } from "@/services"
import {
  skillLabel,
  finalVerdict,
  diagnosisInfo,
  diagnosisToLevel,
} from "@/domain/constants"
import { LearnerShell } from "./LearnerHomePage"
import { useSession } from "@/session/useSession"
import "./LearnerAssessmentPage.css"

/**
 * LearnerAssessmentPage — a learner viewing ONE of their own assessments.
 *
 * Scoped entirely to the signed-in learner (the backend returns 404 for
 * anything that isn't theirs). Two states:
 *   - not completed  → take it: read the passage, answer, submit.
 *   - completed      → results: score, diagnosis, per-question final verdict
 *                      and evidence, plus the teacher's feedback/corrections.
 *
 * There are no teacher controls here — a learner can only see and act on their
 * own work.
 */
export function LearnerAssessmentPage() {
  const { t } = useTranslation()
  const { assessmentId } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useSession()

  const { data, loading, reload } = useAsync(
    () => repository.getAssessment(assessmentId),
    [assessmentId],
  )

  // Taking state
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [ackDone, setAckDone] = useState(false)

  const assessment = data?.assessment
  const questionRows = data?.answers ?? []

  const body = (() => {
    if (loading) {
      return (
        <Card>
          <EmptyState title={t("common.loading")} />
        </Card>
      )
    }
    if (!assessment) {
      return (
        <Card>
          <EmptyState
            title={t("learnerAssessment.notFound")}
            message={t("learnerAssessment.notFoundSub")}
          />
        </Card>
      )
    }

    const isCompleted = assessment.status === "completed"

    /* ---- Completed: results + teacher feedback ------------------------ */
    if (isCompleted || submitted) {
      const scored = assessment.comprehension_score != null
      return (
        <div className="stack">
          {/* Result summary */}
          <Card raised className="lresult__summary">
            <div className="lresult__score">
              <span className="lresult__score-value">
                {scored
                  ? `${Math.round(Number(assessment.comprehension_score))}%`
                  : "—"}
              </span>
              <span className="lresult__score-label">
                {t("learnerAssessment.comprehensionScore")}
              </span>
            </div>
            <div className="lresult__diag">
              {assessment.diagnosis ? (
                <ProficiencyBadge level={diagnosisToLevel(assessment.diagnosis)} />
              ) : (
                <Badge tone="primary" dot>
                  {t("learner.checking")}
                </Badge>
              )}
              {assessment.diagnosis ? (
                <span className="lresult__diag-text">
                  {t(
                    `diagnosis.${assessment.diagnosis}`,
                    diagnosisInfo(assessment.diagnosis).label,
                  )}
                </span>
              ) : null}
            </div>
          </Card>

          {/* Teacher / AI feedback */}
          {assessment.evaluation || assessment.recommendation ? (
            <Card raised className="lresult__feedback">
              <span className="lresult__feedback-icon">
                <Sparkles aria-hidden="true" />
              </span>
              <div>
                <h3 className="lresult__feedback-title">
                  {t("learnerAssessment.feedback")}
                </h3>
                {assessment.evaluation ? (
                  <p className="lresult__feedback-text">{assessment.evaluation}</p>
                ) : null}
                {assessment.recommendation ? (
                  <p className="lresult__feedback-text">
                    <strong>{t("learnerAssessment.nextStep")}</strong>{" "}
                    {assessment.recommendation}
                  </p>
                ) : null}
              </div>
            </Card>
          ) : assessment.evaluation_error ? (
            <Card>
              <EmptyState
                title={t("learnerAssessment.stillChecking")}
                message={t("learnerAssessment.stillCheckingSub")}
              />
            </Card>
          ) : null}

          {/* Passage */}
          <Card>
            <Card.Header title={t("learnerAssessment.passage")} />
            <Card.Body>
              <p className="lresult__passage">{assessment.passage_text}</p>
            </Card.Body>
          </Card>

          {/* Per-question results */}
          <Card>
            <Card.Header
              title={t("learnerAssessment.yourAnswers", {
                count: questionRows.length,
              })}
            />
            <Card.Body>
              <ol className="lresult__questions">
                {questionRows.map((q, i) => {
                  const verdict = finalVerdict(q)
                  return (
                    <li key={q.id} className="lresult__q">
                      <div className="lresult__q-head">
                        <span className="lresult__q-num">
                          {t("learnerAssessment.question", { number: i + 1 })}
                        </span>
                        <Badge tone="neutral">
                          {t(`skills.${q.skill}`, skillLabel(q.skill))}
                        </Badge>
                        {verdict ? <VerdictBadge verdict={verdict} /> : null}
                      </div>
                      <p className="lresult__q-text">{q.question_text}</p>
                      <p className="lresult__answer">
                        {q.answer_text
                          ? `“${q.answer_text}”`
                          : t("learnerAssessment.noAnswer")}
                      </p>
                      {q.evidence ? (
                        <p className="lresult__evidence">
                          {t("learnerAssessment.evidence", { evidence: q.evidence })}
                        </p>
                      ) : null}
                      {q.override_note ? (
                        <p className="lresult__note">
                          {t("learnerAssessment.teacherNote", {
                            note: q.override_note,
                          })}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ol>
            </Card.Body>
          </Card>

          {/* Acknowledge corrections */}
          {assessment.has_correction_alert && !ackDone ? (
            <div className="lresult__ack">
              <Button
                icon={Check}
                onClick={async () => {
                  try {
                    await repository.markCorrectionsSeen(assessment.id)
                    setAckDone(true)
                    reload()
                  } catch {
                    // Non-fatal; the alert simply remains.
                  }
                }}
              >
                {t("learnerAssessment.markSeen")}
              </Button>
            </div>
          ) : null}
        </div>
      )
    }

    /* ---- Not completed: take it --------------------------------------- */
    const allAnswered = questionRows.every((q) => (answers[q.id] ?? "").trim())

    const onSubmit = async () => {
      setError(null)
      if (!allAnswered) {
        setError(t("learnerAssessment.answerEvery"))
        return
      }
      setSubmitting(true)
      try {
        // Move scheduled -> in_progress (ignore a benign already-started 400).
        try {
          await repository.startAssessment(assessment.id)
        } catch {
          // already in progress is fine
        }
        const payload = questionRows.map((q) => ({
          answer_id: q.id,
          answer_text: answers[q.id] ?? "",
        }))
        await repository.submitAssessment(assessment.id, payload)
        setSubmitted(true)
        reload()
      } catch {
        setError(t("learnerAssessment.submitError"))
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <div className="stack">
        <Card>
          <div className="lresult__passage-head">
            <BookOpen aria-hidden="true" />
            <h2 className="lresult__passage-title">
              {t("learnerAssessment.readPassage")}
            </h2>
          </div>
          <Card.Body>
            <p className="lresult__passage">{assessment.passage_text}</p>
          </Card.Body>
        </Card>

        <ol className="lresult__questions">
          {questionRows.map((q, i) => (
            <li key={q.id}>
              <Card>
                <div className="lresult__q-head">
                  <span className="lresult__q-num">
                    {t("learnerAssessment.question", { number: i + 1 })}
                  </span>
                  <Badge tone="neutral">
                    {t(`skills.${q.skill}`, skillLabel(q.skill))}
                  </Badge>
                </div>
                <p className="lresult__q-text">{q.question_text}</p>
                <textarea
                  className="lresult__input"
                  rows={4}
                  placeholder={t("learnerAssessment.typeAnswer")}
                  aria-label={t("learnerAssessment.answerLabel", { number: i + 1 })}
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                />
              </Card>
            </li>
          ))}
        </ol>

        {error ? (
          <p className="lresult__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="lresult__submit">
          <Button
            icon={submitted ? CheckCircle2 : Send}
            onClick={onSubmit}
            disabled={!allAnswered || submitting}
          >
            {submitting
              ? t("learnerAssessment.submitting")
              : t("learnerAssessment.submitAnswers")}
          </Button>
        </div>
      </div>
    )
  })()

  return (
    <LearnerShell userName={user?.name ?? "Learner"} onLogout={logout}>
      <div className="stack">
        <button
          type="button"
          className="lresult__back"
          onClick={() => navigate("/")}
        >
          <ArrowLeft aria-hidden="true" /> {t("learnerAssessment.backToMyAssessments")}
        </button>

        <PageHeader
          eyebrow={t("learnerAssessment.assessment")}
          title={assessment?.title ?? t("learnerAssessment.assessment")}
        />

        {body}
      </div>
    </LearnerShell>
  )
}