import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Sparkles, Check, PencilLine } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import {
  Card,
  Badge,
  Button,
  Input,
  EmptyState,
  VerdictBadge,
} from '@/components/ui'
import { repository } from '@/services'
import { useAsync } from '@/hooks/useAsync'
import {
  skillLabel,
  finalVerdict,
  VERDICT_LIST,
  STATUS,
} from '@/domain/constants'
import './ReviewPage.css'

/**
 * ReviewPage — teacher review & corrections (spec module 6). For each question
 * the teacher sees the learner's answer, the AI verdict + evidence (empty until
 * the backend produces them), and can override the verdict with an optional
 * note. Final verdict = COALESCE(teacher_override, ai_verdict).
 */
export function ReviewPage() {
  const { assessmentId } = useParams()
  const { data, loading, reload } = useAsync(
    () => repository.getAssessment(assessmentId),
    [assessmentId],
  )

  if (loading) {
    return (
      <div className="stack">
        <Link to="/assessments" className="detail__back">
          <ArrowLeft aria-hidden="true" /> Back
        </Link>
        <Card>
          <div className="review__loading">Loading…</div>
        </Card>
      </div>
    )
  }

  if (!data?.assessment) {
    return (
      <div className="stack">
        <Link to="/assessments" className="detail__back">
          <ArrowLeft aria-hidden="true" /> Back
        </Link>
        <Card>
          <EmptyState title="Assessment not found" />
        </Card>
      </div>
    )
  }

  const { assessment, answers } = data
  const submitted = assessment.status === STATUS.completed.key

  return (
    <div className="stack">
      <Link to={`/assessments/${assessment.id}`} className="detail__back">
        <ArrowLeft aria-hidden="true" /> Back to assessment
      </Link>

      <PageHeader
        eyebrow="Review &amp; corrections"
        title={assessment.title}
        subtitle="Check each answer against the passage. The AI verdict appears once the backend grades it; your override always wins."
      />

      {/* Passage reference */}
      <Card>
        <div className="review__passage-head">
          <BookOpen aria-hidden="true" />
          <h2 className="review__passage-title">Passage</h2>
        </div>
        <p className="review__passage">{assessment.passage_text}</p>
      </Card>

      {!submitted ? (
        <Card>
          <EmptyState
            variant="awaiting"
            icon={Sparkles}
            title="No submission yet"
            message="This learner hasn’t submitted. Once they do, their answers appear here for review."
          />
        </Card>
      ) : (
        <div className="review__answers">
          {answers.map((answer, i) => (
            <AnswerReview
              key={answer.id}
              index={i}
              answer={answer}
              onSaved={reload}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* One answer with override controls                                          */
/* -------------------------------------------------------------------------- */

function AnswerReview({ index, answer, onSaved }) {
  const [note, setNote] = useState(answer.override_note ?? '')
  const [saving, setSaving] = useState(null) // the verdict being saved
  const current = finalVerdict(answer)

  const override = async (verdict) => {
    setSaving(verdict)
    try {
      await repository.overrideAnswer(answer.id, {
        teacher_override: verdict,
        override_note: note.trim() || null,
      })
      onSaved()
    } finally {
      setSaving(null)
    }
  }

  return (
    <Card>
      <div className="review__q-head">
        <span className="review__q-num">Question {index + 1}</span>
        <Badge tone="neutral">{skillLabel(answer.skill)}</Badge>
        {current ? (
          <span className="review__final">
            Final: <VerdictBadge verdict={current} />
          </span>
        ) : null}
      </div>

      <p className="review__q-text">{answer.question_text}</p>

      {answer.expected_ideas ? (
        <p className="review__expected">
          Expected ideas: {answer.expected_ideas}
        </p>
      ) : null}

      {/* Learner's answer */}
      <div className="review__block">
        <span className="review__block-label">Learner’s answer</span>
        <p className="review__answer-text">
          {answer.answer_text ? `“${answer.answer_text}”` : 'No answer given.'}
        </p>
      </div>

      {/* AI verdict + evidence — empty until the backend produces them */}
      <div className="review__block">
        <span className="review__block-label">
          <Sparkles aria-hidden="true" /> AI assessment
        </span>
        {answer.ai_verdict ? (
          <div className="review__ai">
            <VerdictBadge verdict={answer.ai_verdict} />
            {answer.evidence ? (
              <p className="review__evidence">Evidence: {answer.evidence}</p>
            ) : null}
          </div>
        ) : (
          <p className="review__ai-pending">
            Awaiting AI evaluation. You can still set a verdict yourself below.
          </p>
        )}
      </div>

      {/* Teacher override */}
      <div className="review__override">
        <span className="review__block-label">
          <PencilLine aria-hidden="true" /> Your verdict
        </span>
        <div className="review__verdicts">
          {VERDICT_LIST.map((v) => {
            const active = answer.teacher_override === v.key
            return (
              <button
                key={v.key}
                type="button"
                className={`review__verdict review__verdict--${v.tone} ${
                  active ? 'review__verdict--active' : ''
                }`}
                onClick={() => override(v.key)}
                disabled={saving != null}
                aria-pressed={active}
              >
                {active ? <Check aria-hidden="true" /> : null}
                {v.label}
              </button>
            )
          })}
        </div>
        <Input
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add context for this correction"
        />
      </div>
    </Card>
  )
}
