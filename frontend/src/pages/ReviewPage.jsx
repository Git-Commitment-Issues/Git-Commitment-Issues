import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BookOpen, Sparkles, Check, PencilLine } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import {
  Card,
  Badge,
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
  const { t } = useTranslation()
  const { code } = useParams()
  const { data, loading, reload } = useAsync(
    () => repository.getAssessmentByCode(code),
    [code],
  )

  if (loading) {
    return (
      <div className="stack">
        <Link to="/assessments" className="detail__back">
          <ArrowLeft aria-hidden="true" /> {t('review.back')}
        </Link>
        <Card>
          <div className="review__loading">{t('common.loading')}</div>
        </Card>
      </div>
    )
  }

  if (!data?.assessment) {
    return (
      <div className="stack">
        <Link to="/assessments" className="detail__back">
          <ArrowLeft aria-hidden="true" /> {t('review.back')}
        </Link>
        <Card>
          <EmptyState title={t('review.notFound')} />
        </Card>
      </div>
    )
  }

  const { assessment, answers } = data
  const submitted = assessment.status === STATUS.completed.key

  return (
    <div className="stack">
      <Link to={`/assessments/${assessment.access_code}`} className="detail__back">
        <ArrowLeft aria-hidden="true" /> {t('review.backToAssessment')}
      </Link>

      <PageHeader
        eyebrow={t('review.eyebrow')}
        title={assessment.title}
        subtitle={t('review.subtitle')}
      />

      {/* Passage reference */}
      <Card>
        <div className="review__passage-head">
          <BookOpen aria-hidden="true" />
          <h2 className="review__passage-title">{t('review.passage')}</h2>
        </div>
        <p className="review__passage">{assessment.passage_text}</p>
      </Card>

      {!submitted ? (
        <Card>
          <EmptyState
            variant="awaiting"
            icon={Sparkles}
            title={t('review.noSubmission')}
            message={t('review.noSubmissionSub')}
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
  const { t } = useTranslation()
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
        <span className="review__q-num">
          {t('review.question', { number: index + 1 })}
        </span>
        <Badge tone="neutral">
          {t(`skills.${answer.skill}`, skillLabel(answer.skill))}
        </Badge>
        {current ? (
          <span className="review__final">
            {t('review.final')} <VerdictBadge verdict={current} />
          </span>
        ) : null}
      </div>

      <p className="review__q-text">{answer.question_text}</p>

      {answer.expected_ideas ? (
        <p className="review__expected">
          {t('review.expectedIdeas', { ideas: answer.expected_ideas })}
        </p>
      ) : null}

      {/* Learner's answer */}
      <div className="review__block">
        <span className="review__block-label">{t('review.learnerAnswer')}</span>
        <p className="review__answer-text">
          {answer.answer_text ? `“${answer.answer_text}”` : t('review.noAnswer')}
        </p>
      </div>

      {/* AI verdict + evidence — empty until the backend produces them */}
      <div className="review__block">
        <span className="review__block-label">
          <Sparkles aria-hidden="true" /> {t('review.aiAssessment')}
        </span>
        {answer.ai_verdict ? (
          <div className="review__ai">
            <VerdictBadge verdict={answer.ai_verdict} />
            {answer.evidence ? (
              <p className="review__evidence">
                {t('review.aiEvidence', { evidence: answer.evidence })}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="review__ai-pending">{t('review.aiPending')}</p>
        )}
      </div>

      {/* Teacher override */}
      <div className="review__override">
        <span className="review__block-label">
          <PencilLine aria-hidden="true" /> {t('review.yourVerdict')}
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
                {t(`verdict.${v.key}`, v.label)}
              </button>
            )
          })}
        </div>
        <Input
          label={t('review.noteLabel')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('review.notePlaceholder')}
        />
      </div>
    </Card>
  )
}
