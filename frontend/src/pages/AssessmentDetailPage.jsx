import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, QrCode, ClipboardCheck, Hash, BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import {
  Card,
  Badge,
  Button,
  EmptyState,
  StatusBadge,
} from '@/components/ui'
import { repository } from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { skillLabel } from '@/domain/constants'
import './AssessmentDetailPage.css'

/**
 * AssessmentDetailPage — one assessment copy: its passage, questions, status,
 * access code (with a link to the QR session), and an entry to review answers.
 * Results stay empty until a learner submits and the AI/teacher grades.
 */
export function AssessmentDetailPage() {
  const { assessmentId } = useParams()

  const { data, loading } = useAsync(
    () => repository.getAssessment(assessmentId),
    [assessmentId],
  )

  if (loading) {
    return (
      <div className="stack">
        <Link to="/assessments" className="detail__back">
          <ArrowLeft aria-hidden="true" /> Back to assessments
        </Link>
        <Card>
          <div className="adetail__loading">Loading…</div>
        </Card>
      </div>
    )
  }

  if (!data?.assessment) {
    return (
      <div className="stack">
        <Link to="/assessments" className="detail__back">
          <ArrowLeft aria-hidden="true" /> Back to assessments
        </Link>
        <Card>
          <EmptyState
            title="Assessment not found"
            message="This assessment may have been removed."
          />
        </Card>
      </div>
    )
  }

  const { assessment, answers } = data
  const hasSubmission = answers.some((a) => a.answer_text != null)

  return (
    <div className="stack">
      <Link to="/assessments" className="detail__back">
        <ArrowLeft aria-hidden="true" /> Back to assessments
      </Link>

      <PageHeader
        eyebrow={assessment.category || 'Assessment'}
        title={assessment.title}
        actions={
          <div className="adetail__header-actions">
            <Button variant="outline" icon={QrCode}>
              <Link to={`/assessments/${assessment.id}/review`}>
                Review answers
              </Link>
            </Button>
          </div>
        }
      />

      <div className="adetail__meta">
        <StatusBadge status={assessment.status} />
        <Badge tone="primary" icon={Hash}>
          {assessment.access_code}
        </Badge>
      </div>

      {/* Access / QR session card */}
      <Card raised className="adetail__share">
        <div className="adetail__share-text">
          <h3 className="adetail__share-title">Share with learners</h3>
          <p className="adetail__share-desc">
            Learners open this assessment with access code{' '}
            <strong>{assessment.access_code}</strong> — scan the QR code or type
            the code after signing in.
          </p>
        </div>
        <Button icon={QrCode}>
          <Link to={`/assessments/${assessment.id}/review`} state={{ showQr: true }}>
            Open session &amp; QR
          </Link>
        </Button>
      </Card>

      <div className="grid-2">
        <Card>
          <div className="adetail__section-head">
            <BookOpen className="adetail__section-icon" aria-hidden="true" />
            <h2 className="adetail__section-title">Passage</h2>
          </div>
          <Card.Body>
            <p className="adetail__passage">{assessment.passage_text}</p>
          </Card.Body>
        </Card>

        <Card>
          <div className="adetail__section-head">
            <ClipboardCheck
              className="adetail__section-icon"
              aria-hidden="true"
            />
            <h2 className="adetail__section-title">
              Questions ({answers.length})
            </h2>
          </div>
          <Card.Body>
            <ol className="adetail__questions">
              {answers.map((a, i) => (
                <li key={a.id} className="adetail__question">
                  <div className="adetail__q-head">
                    <span className="adetail__q-num">{i + 1}</span>
                    <Badge tone="neutral">{skillLabel(a.skill)}</Badge>
                  </div>
                  <p className="adetail__q-text">{a.question_text}</p>
                  {a.expected_ideas ? (
                    <p className="adetail__q-ideas">
                      Expected: {a.expected_ideas}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card.Body>
        </Card>
      </div>

      {!hasSubmission ? (
        <Card>
          <EmptyState
            variant="awaiting"
            icon={ClipboardCheck}
            title="No responses yet"
            message="Once this learner submits, their answers and the AI evaluation appear in the review view."
          />
        </Card>
      ) : null}
    </div>
  )
}
