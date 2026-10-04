import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
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
          <ArrowLeft aria-hidden="true" /> Back to assessments
        </Link>
        <Card>
          <EmptyState title="Loading…" />
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
          <ArrowLeft aria-hidden="true" /> Back to assessments
        </Link>
        <Card>
          <EmptyState
            title="Assessment not found"
            message="This code doesn’t match an assessment in this classroom."
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
        <ArrowLeft aria-hidden="true" /> Back to assessments
      </button>

      <PageHeader
        eyebrow="Assessment"
        title={assessment.title}
        actions={
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <StatusBadge status={assessment.status} />
            <Button variant="outline" icon={PencilLine}>
              <Link to={`/assessments/${assessment.access_code}/review`}>
                Review &amp; grade
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
          <h2 className="share__heading">Students join with this code</h2>
          <div className="share__code">{assessment.access_code}</div>
          <p className="share__hint">
            Scan the QR, or go to <strong>/s</strong> and enter the code.
          </p>
          <div className="share__link-row">
            <code className="share__link">{studentUrl}</code>
            <Button
              variant="outline"
              icon={copied ? Check : Copy}
              onClick={copy}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <Button variant="ghost" icon={Users} className="share__preview">
            <Link to={`/s/${assessment.access_code}`}>Open student view</Link>
          </Button>
        </div>
      </Card>

      <div className="grid-2">
        <Card>
          <Card.Header title="Passage" />
          <Card.Body>
            <div className="share__passage-head">
              <BookOpen aria-hidden="true" />
            </div>
            <p className="share__passage">{assessment.passage_text}</p>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header title={`Questions (${answers.length})`} />
          <Card.Body>
            <ol className="share__questions">
              {answers.map((q, i) => (
                <li key={q.id} className="share__question">
                  <div className="share__q-head">
                    <span className="share__q-num">{i + 1}</span>
                    <Badge tone="neutral">{skillLabel(q.skill)}</Badge>
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
          title="Status"
          subtitle="Where this learner's assessment stands"
        />
        <Card.Body>
          {assessment.status === "completed" ? (
            <ul className="row-list">
              <li className="share__response">
                <span className="share__response-name">
                  {assessment.comprehension_score != null
                    ? `Scored ${Math.round(Number(assessment.comprehension_score))}%`
                    : assessment.evaluation_error
                      ? "Evaluation needs attention"
                      : "Submitted — evaluating…"}
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
                    ? "Needs review"
                    : assessment.comprehension_score != null
                      ? "Graded"
                      : "Pending"}
                </Badge>
              </li>
            </ul>
          ) : (
            <EmptyState
              icon={ListChecks}
              title="No submission yet"
              message="Share the code or QR. Once the learner submits, the AI check runs and results appear in Review."
            />
          )}
        </Card.Body>
      </Card>
    </div>
  )
}