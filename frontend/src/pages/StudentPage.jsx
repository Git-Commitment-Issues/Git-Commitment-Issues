import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Send, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/layout'
import { Button, Card, Input, Badge } from '@/components/ui'
import { getByCode, submitResponse } from '@/data/assessmentStore'
import { COMPREHENSION_SKILLS } from '@/data/mockData'
import './StudentPage.css'

const skillLabel = (key) =>
  COMPREHENSION_SKILLS.find((s) => s.key === key)?.label ?? key

/** Page chrome for the student experience. Hoisted so it isn't remounted on
 *  every render (which would steal focus from inputs). */
function Shell({ children }) {
  return (
    <div className="student">
      <header className="student__bar">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="student__main" id="main-content">
        <div className="student__container">{children}</div>
      </main>
    </div>
  )
}

/**
 * StudentPage — the public student experience. No teacher login.
 *   /s          → enter a join code
 *   /s/:code    → read the passage, answer questions, submit
 * Responses are saved locally; results stay "awaiting" until an AI backend
 * scores them (we never fabricate a grade here).
 */
export function StudentPage() {
  const { code: codeParam } = useParams()
  const navigate = useNavigate()

  // --- Code entry (when no :code in the URL) ------------------------------
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(null)

  const openByCode = (e) => {
    e.preventDefault()
    const value = codeInput.trim().toUpperCase()
    if (!value) {
      setCodeError('Enter the code your teacher gave you.')
      return
    }
    if (!getByCode(value)) {
      setCodeError('No assessment found for that code.')
      return
    }
    navigate(`/s/${value}`)
  }

  // --- Taking the assessment ---------------------------------------------
  const assessment = codeParam ? getByCode(codeParam) : null
  const [studentName, setStudentName] = useState('')
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [takeError, setTakeError] = useState(null)

  // Code-entry screen
  if (!codeParam) {
    return (
      <Shell>
        <Card raised className="student__join">
          <h1 className="student__join-title">Join an assessment</h1>
          <p className="student__join-sub">
            Enter the code from your teacher’s screen.
          </p>
          <form className="student__join-form" onSubmit={openByCode} noValidate>
            <Input
              label="Access code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. 7K9Q2M"
              error={codeError}
              className="student__code-input"
              autoFocus
            />
            <Button type="submit" icon={ArrowRight} fullWidth>
              Open
            </Button>
          </form>
        </Card>
      </Shell>
    )
  }

  // Unknown code
  if (!assessment) {
    return (
      <Shell>
        <Card>
          <div className="empty-state">
            <h3>Assessment not found</h3>
            <p>Check the code with your teacher and try again.</p>
            <Button variant="outline" onClick={() => navigate('/s')}>
              Enter a different code
            </Button>
          </div>
        </Card>
      </Shell>
    )
  }

  // Submitted confirmation
  if (submitted) {
    return (
      <Shell>
        <Card raised className="student__done">
          <span className="student__done-icon">
            <CheckCircle2 aria-hidden="true" />
          </span>
          <h1 className="student__done-title">All done — nice work</h1>
          <p className="student__done-sub">
            Your answers to “{assessment.title}” were submitted. Your teacher
            will see your results once they’re analyzed.
          </p>
        </Card>
      </Shell>
    )
  }

  const allAnswered =
    studentName.trim() &&
    assessment.questions.every((q) => (answers[q.id] ?? '').trim())

  const onSubmit = () => {
    if (!allAnswered) {
      setTakeError('Enter your name and answer every question.')
      return
    }
    submitResponse(assessment.code, { studentName, answers })
    setSubmitted(true)
  }

  // Take screen
  return (
    <Shell>
      <div className="stack animate-in">
        <header className="student__header">
          <p className="student__eyebrow">Assessment</p>
          <h1 className="student__title">{assessment.title}</h1>
        </header>

        <Input
          label="Your name"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="Type your full name"
        />

        <Card>
          <div className="student__passage-head">
            <BookOpen aria-hidden="true" />
            <h2 className="student__passage-title">Read the passage</h2>
          </div>
          <p className="student__passage">{assessment.passage}</p>
        </Card>

        <ol className="student__questions">
          {assessment.questions.map((q, i) => (
            <li key={q.id}>
              <Card>
                <div className="student__q-head">
                  <span className="student__q-num">Question {i + 1}</span>
                  <Badge tone="neutral">{skillLabel(q.skill)}</Badge>
                </div>
                <p className="student__q-text">{q.prompt}</p>
                <textarea
                  className="student__answer"
                  rows={4}
                  placeholder="Type your answer…"
                  aria-label={`Answer to question ${i + 1}`}
                  value={answers[q.id] ?? ''}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                />
              </Card>
            </li>
          ))}
        </ol>

        {takeError ? (
          <p className="student__error" role="alert">
            {takeError}
          </p>
        ) : null}

        <div className="student__submit">
          <Button icon={Send} onClick={onSubmit} disabled={!allAnswered}>
            Submit answers
          </Button>
        </div>
      </div>
    </Shell>
  )
}
