import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  Check,
  BookOpen,
  ListChecks,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Card, Badge, Button } from '@/components/ui'
import { QRCode, CountUp } from '@/components/data'
import { getByCode } from '@/data/assessmentStore'
import { COMPREHENSION_SKILLS } from '@/data/mockData'
import './AssessmentSharePage.css'

const skillLabel = (key) =>
  COMPREHENSION_SKILLS.find((s) => s.key === key)?.label ?? key

/**
 * AssessmentSharePage — a created assessment's detail + share screen.
 * Shows the join code and a QR that opens the student view, plus the passage,
 * questions, and any responses students have submitted.
 */
export function AssessmentSharePage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const assessment = getByCode(code)

  if (!assessment) {
    return (
      <div className="stack">
        <Link to="/assessments" className="text-link">
          <ArrowLeft aria-hidden="true" /> Back to assessments
        </Link>
        <Card>
          <div className="empty-state">
            <h3>Assessment not found</h3>
            <p>This code doesn’t match a saved assessment on this device.</p>
          </div>
        </Card>
      </div>
    )
  }

  const studentUrl = `${window.location.origin}/s/${assessment.code}`

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
      <button
        type="button"
        className="text-link"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft aria-hidden="true" /> Back to assessments
      </button>

      <PageHeader
        eyebrow="Assessment"
        title={assessment.title}
        actions={
          <Badge tone="primary">
            <CountUp value={assessment.responses.length} /> responses
          </Badge>
        }
      />

      {/* Share / QR */}
      <Card raised className="share">
        <div className="share__qr">
          <QRCode value={studentUrl} size={200} />
        </div>
        <div className="share__info">
          <h2 className="share__heading">Students join with this code</h2>
          <div className="share__code">{assessment.code}</div>
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
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          <Button variant="ghost" icon={Users} className="share__preview">
            <Link to={`/s/${assessment.code}`}>Open student view</Link>
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
            <p className="share__passage">{assessment.passage}</p>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header title={`Questions (${assessment.questions.length})`} />
          <Card.Body>
            <ol className="share__questions">
              {assessment.questions.map((q, i) => (
                <li key={q.id} className="share__question">
                  <div className="share__q-head">
                    <span className="share__q-num">{i + 1}</span>
                    <Badge tone="neutral">{skillLabel(q.skill)}</Badge>
                  </div>
                  <p className="share__q-text">{q.prompt}</p>
                </li>
              ))}
            </ol>
          </Card.Body>
        </Card>
      </div>

      {/* Responses */}
      <Card>
        <Card.Header
          title="Responses"
          subtitle="Students who have submitted this assessment"
        />
        <Card.Body>
          {assessment.responses.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__icon">
                <ListChecks aria-hidden="true" />
              </span>
              <h3>No responses yet</h3>
              <p>
                Share the code or QR. Submissions will appear here. AI scoring
                will fill in once the AI backend is connected.
              </p>
            </div>
          ) : (
            <ul className="row-list">
              {assessment.responses.map((r, i) => (
                <li key={i} className="share__response">
                  <span className="share__response-name">{r.studentName}</span>
                  <Badge tone="success" dot>
                    Submitted
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}
