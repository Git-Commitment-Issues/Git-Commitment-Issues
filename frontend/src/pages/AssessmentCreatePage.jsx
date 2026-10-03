import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  ClipboardList,
  FileUp,
  Lock,
} from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Button, Card, Input, Badge } from '@/components/ui'
import { COMPREHENSION_SKILLS } from '@/data/mockData'
import { createAssessment } from '@/data/assessmentStore'
import './AssessmentCreatePage.css'

const newQuestion = () => ({ prompt: '', skill: COMPREHENSION_SKILLS[0].key })

/**
 * AssessmentCreatePage — a working, frontend-only form to create a reading
 * assessment. Saves to localStorage and generates a join code, then sends the
 * teacher to the share screen.
 *
 * The PDF/AI upload block is a seam: it's inert until an AI backend exists, so
 * it never fabricates extracted text. Enable it by wiring the backend later.
 */
export function AssessmentCreatePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [passage, setPassage] = useState('')
  const [questions, setQuestions] = useState([newQuestion()])
  const [error, setError] = useState(null)

  const setQuestion = (i, patch) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  const addQuestion = () => setQuestions((qs) => [...qs, newQuestion()])
  const removeQuestion = (i) =>
    setQuestions((qs) => qs.filter((_, idx) => idx !== i))

  const canSave =
    title.trim() && passage.trim() && questions.every((q) => q.prompt.trim())

  const onSave = () => {
    if (!canSave) {
      setError('Add a title, a passage, and fill in every question.')
      return
    }
    const assessment = createAssessment({ title, passage, questions })
    navigate(`/assessments/${assessment.code}`)
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
        eyebrow="New assessment"
        title="Create an assessment"
        subtitle="Add a reading passage and a few questions. You'll get a join code and QR for students."
      />

      {/* PDF / AI upload seam — inert until a backend is connected */}
      <Card className="create__ai">
        <div className="create__ai-main">
          <span className="create__ai-icon">
            <FileUp aria-hidden="true" />
          </span>
          <div>
            <h3 className="create__ai-title">
              Generate from a PDF or photo
              <Badge tone="neutral" icon={Lock}>
                Needs AI backend
              </Badge>
            </h3>
            <p className="create__ai-desc">
              Upload printed material and let AI pull out the passage and
              questions. This turns on automatically once the AI service is
              connected — until then, build the assessment below.
            </p>
          </div>
        </div>
        <Button variant="outline" icon={FileUp} disabled>
          Upload material
        </Button>
      </Card>

      <Card>
        <Card.Header title="Details" />
        <Card.Body>
          <div className="stack">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Lighthouse Keeper"
            />
            <div className="field">
              <label className="field__label" htmlFor="passage">
                Passage
              </label>
              <textarea
                id="passage"
                className="create__passage"
                rows={9}
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                placeholder="Paste the reading passage students will see…"
              />
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          title="Questions"
          subtitle="Tag each question with the skill it targets."
        />
        <Card.Body>
          <div className="stack">
            {questions.map((q, i) => (
              <div className="create__q" key={i}>
                <div className="create__q-head">
                  <span className="create__q-num">Question {i + 1}</span>
                  <button
                    type="button"
                    className="create__q-remove"
                    onClick={() => removeQuestion(i)}
                    disabled={questions.length === 1}
                    aria-label={`Remove question ${i + 1}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
                <Input
                  label="Question"
                  value={q.prompt}
                  onChange={(e) => setQuestion(i, { prompt: e.target.value })}
                  placeholder="e.g. What is the main idea of the passage?"
                />
                <div className="field">
                  <label className="field__label" htmlFor={`skill-${i}`}>
                    Skill
                  </label>
                  <div className="field__control">
                    <select
                      id={`skill-${i}`}
                      className="create__select"
                      value={q.skill}
                      onChange={(e) => setQuestion(i, { skill: e.target.value })}
                    >
                      {COMPREHENSION_SKILLS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" icon={Plus} onClick={addQuestion}>
              Add question
            </Button>
          </div>
        </Card.Body>
      </Card>

      {error ? <p className="create__error" role="alert">{error}</p> : null}

      <div className="create__actions">
        <Button variant="ghost" onClick={() => navigate('/assessments')}>
          Cancel
        </Button>
        <Button icon={ClipboardList} onClick={onSave}>
          Create &amp; get code
        </Button>
      </div>
    </div>
  )
}
