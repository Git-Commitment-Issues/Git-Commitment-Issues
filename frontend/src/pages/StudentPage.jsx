import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowRight, BookOpen, Send, CheckCircle2, Hash } from "lucide-react"
import { Trans, useTranslation } from "react-i18next"
import { Logo } from "@/components/brand/Logo"
import { Mascot } from "@/components/brand/Mascot"
import { ThemeToggle, LanguageToggle } from "@/components/layout"
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
        <div className="student__bar-right">
          <LanguageToggle />
          <ThemeToggle />
        </div>
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
  const { t } = useTranslation()
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
      setLoadError(t("student.errorNoLrn"))
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
        setLoadError(t("student.errorNoLearner"))
      } else if (err instanceof ApiError && err.status === 404) {
        setLoadError(t("student.errorNoCopy"))
      } else {
        setLoadError(t("student.errorLoad"))
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
          <h1 className="student__join-title">{t("student.joinTitle")}</h1>
          <p className="student__join-sub">{t("student.joinSub")}</p>
          <form className="student__join-form" onSubmit={openByCode} noValidate>
            <Input
              label={t("student.accessCode")}
              icon={Hash}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder={t("student.accessCodePlaceholder")}
              className="student__code-input"
              autoFocus
            />
            <Button type="submit" icon={ArrowRight} fullWidth>
              {t("common.open")}
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
          <Mascot
            variant="star"
            size="lg"
            float
            className="student__done-mascot"
          />
          <span className="student__done-badge">
            <CheckCircle2 aria-hidden="true" />
            {t("student.submitted")}
          </span>
          <h1 className="student__done-title">{t("student.allDone")}</h1>
          <p className="student__done-sub">
            {t("student.submittedSub", { title: loaded?.assessment?.title })}
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
          <h1 className="student__join-title">{t("student.openYourAssessment")}</h1>
          <p className="student__join-sub">
            <Trans
              i18nKey="student.codeInstruction"
              values={{ code: codeParam }}
              components={{ 1: <strong /> }}
            />
          </p>
          <form className="student__join-form" onSubmit={loadMine} noValidate>
            <Input
              label={t("student.lrnLabel")}
              value={lrn}
              onChange={(e) => setLrn(e.target.value)}
              placeholder={t("student.lrnPlaceholder")}
              inputMode="numeric"
              error={loadError}
              autoFocus
            />
            <Button type="submit" icon={ArrowRight} fullWidth disabled={loading}>
              {loading ? t("common.opening") : t("common.open")}
            </Button>
          </form>
          <button
            type="button"
            className="text-link student__join-switch"
            onClick={() => navigate("/s")}
          >
            {t("student.enterDifferentCode")}
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
      setTakeError(t("student.answerEvery"))
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
        setTakeError(t("student.errorAlreadySubmitted"))
      } else {
        setTakeError(t("student.errorSubmit"))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Shell>
      <div className="stack animate-in">
        <header className="student__header">
          <div className="student__header-text">
            <p className="student__eyebrow">{t("student.assessment")}</p>
            <h1 className="student__title">{assessment.title}</h1>
          </div>
          <Mascot
            variant="reading"
            size="md"
            float
            className="student__header-mascot"
          />
        </header>

        {alreadyCompleted ? (
          <Card>
            <div className="empty-state">
              <h3>{t("student.alreadySubmitted")}</h3>
              <p>{t("student.alreadySubmittedSub")}</p>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="student__passage-head">
                <BookOpen aria-hidden="true" />
                <h2 className="student__passage-title">{t("student.readPassage")}</h2>
              </div>
              <p className="student__passage">{assessment.passage_text}</p>
            </Card>

            <ol className="student__questions">
              {questionRows.map((q, i) => (
                <li key={q.id}>
                  <Card>
                    <div className="student__q-head">
                      <span className="student__q-num">
                        {t("student.question", { number: i + 1 })}
                      </span>
                      <Badge tone="neutral">
                        {t(`skills.${q.skill}`, skillLabel(q.skill))}
                      </Badge>
                    </div>
                    <p className="student__q-text">{q.question_text}</p>
                    <textarea
                      className="student__answer"
                      rows={4}
                      placeholder={t("student.typeAnswer")}
                      aria-label={t("student.answerLabel", { number: i + 1 })}
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
                {submitting ? t("student.submitting") : t("student.submitAnswers")}
              </Button>
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}