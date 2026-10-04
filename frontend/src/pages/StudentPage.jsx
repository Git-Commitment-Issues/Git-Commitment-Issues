import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowRight, BookOpen, Send, CheckCircle2, Hash } from "lucide-react"
import { Logo } from "@/components/brand/Logo"
import { ThemeToggle } from "@/components/layout"
import { Button, Card, Input, Badge } from "@/components/ui"
import { repository, ApiError } from "@/services"
import { skillLabel } from "@/domain/constants"
import "./StudentPage.css"

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
 * StudentPage — the public student experience (no teacher login).
 *   /s          → enter a join code
 *   /s/:code    → enter your LRN to load YOUR copy, read the passage, answer,
 *                 and submit.
 *
 * Backed by the API: a learner is identified by their Learner Reference Number
 * (LRN); submitting runs through the real start/submit flow and the backend's
 * AI check — we never fabricate a grade here. This flow uses an explicit
 * learner id per request, so it never disturbs a teacher's session on the same
 * browser.
 */
export function StudentPage() {
  const { code: codeParam } = useParams()
  const navigate = useNavigate()

  // --- Code entry (when no :code in the URL) ------------------------------
  const [codeInput, setCodeInput] = useState("")

  const openByCode = (e) => {
    e.preventDefault()
    const value = codeInput.trim().toUpperCase()
    if (!value) return
    navigate(`/s/${value}`)
  }

  // --- Identity + loading the learner's own copy -------------------------
  const [lrn, setLrn] = useState("")
  const [loaded, setLoaded] = useState(null) // { assessment, answers:[AnswerOut], learnerId }
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  // --- Answering ----------------------------------------------------------
  const [answers, setAnswers] = useState({}) // { [answerId]: text }
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [takeError, setTakeError] = useState(null)

  const loadMine = async (e) => {
    e.preventDefault()
    setLoadError(null)
    const value = lrn.trim()
    if (!value) {
      setLoadError("Enter your LRN to open your copy.")
      return
    }
    setLoading(true)
    try {
      // Resolve the learner by LRN, then fetch THEIR copy of this batch.
      const learner = await repository.login({ lrn: value })
      const { assessment, answers: ans } = await repository.getAssessmentByCodeAs(
        codeParam,
        learner.id,
      )
      setLoaded({ assessment, answers: ans, learnerId: learner.id })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setLoadError("No active learner found with that LRN.")
      } else if (err instanceof ApiError && err.status === 404) {
        setLoadError("You don't have a copy of this assessment, or the code is wrong.")
      } else {
        setLoadError("Couldn’t load your assessment. Try again shortly.")
      }
    } finally {
      setLoading(false)
    }
  }

  // --- Code-entry screen --------------------------------------------------
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
              icon={Hash}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. 7K9Q2M"
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

  // --- Submitted confirmation --------------------------------------------
  if (submitted) {
    return (
      <Shell>
        <Card raised className="student__done">
          <span className="student__done-icon">
            <CheckCircle2 aria-hidden="true" />
          </span>
          <h1 className="student__done-title">All done — nice work</h1>
          <p className="student__done-sub">
            Your answers to “{loaded?.assessment?.title}” were submitted. Your
            teacher will see your results once they’re analyzed.
          </p>
        </Card>
      </Shell>
    )
  }

  // --- Identity screen (enter LRN to open your copy) ---------------------
  if (!loaded) {
    return (
      <Shell>
        <Card raised className="student__join">
          <h1 className="student__join-title">Open your assessment</h1>
          <p className="student__join-sub">
            Code <strong>{codeParam}</strong>. Enter your LRN to load your copy.
          </p>
          <form className="student__join-form" onSubmit={loadMine} noValidate>
            <Input
              label="Learner Reference Number"
              value={lrn}
              onChange={(e) => setLrn(e.target.value)}
              placeholder="12-digit LRN"
              inputMode="numeric"
              error={loadError}
              autoFocus
            />
            <Button type="submit" icon={ArrowRight} fullWidth disabled={loading}>
              {loading ? "Opening…" : "Open"}
            </Button>
          </form>
          <button
            type="button"
            className="text-link student__join-switch"
            onClick={() => navigate("/s")}
          >
            Enter a different code
          </button>
        </Card>
      </Shell>
    )
  }

  // --- Take screen --------------------------------------------------------
  const { assessment, answers: questionRows } = loaded
  const alreadyCompleted = assessment.status === "completed"

  const allAnswered = questionRows.every((q) => (answers[q.id] ?? "").trim())

  const onSubmit = async () => {
    setTakeError(null)
    if (!allAnswered) {
      setTakeError("Answer every question before submitting.")
      return
    }
    setSubmitting(true)
    try {
      const payload = questionRows.map((q) => ({
        answer_id: q.id,
        answer_text: answers[q.id] ?? "",
      }))
      await repository.submitAsLearner({
        lrn: lrn.trim(),
        code: codeParam,
        answers: payload,
      })
      setSubmitted(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setTakeError("This assessment was already submitted.")
      } else {
        setTakeError("Couldn’t submit. Check your connection and try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Shell>
      <div className="stack animate-in">
        <header className="student__header">
          <p className="student__eyebrow">Assessment</p>
          <h1 className="student__title">{assessment.title}</h1>
        </header>

        {alreadyCompleted ? (
          <Card>
            <div className="empty-state">
              <h3>Already submitted</h3>
              <p>You’ve already completed this assessment. Ask your teacher if you think this is a mistake.</p>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="student__passage-head">
                <BookOpen aria-hidden="true" />
                <h2 className="student__passage-title">Read the passage</h2>
              </div>
              <p className="student__passage">{assessment.passage_text}</p>
            </Card>

            <ol className="student__questions">
              {questionRows.map((q, i) => (
                <li key={q.id}>
                  <Card>
                    <div className="student__q-head">
                      <span className="student__q-num">Question {i + 1}</span>
                      <Badge tone="neutral">{skillLabel(q.skill)}</Badge>
                    </div>
                    <p className="student__q-text">{q.question_text}</p>
                    <textarea
                      className="student__answer"
                      rows={4}
                      placeholder="Type your answer…"
                      aria-label={`Answer to question ${i + 1}`}
                      value={answers[q.id] ?? ""}
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
              <Button
                icon={Send}
                onClick={onSubmit}
                disabled={!allAnswered || submitting}
              >
                {submitting ? "Submitting…" : "Submit answers"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}