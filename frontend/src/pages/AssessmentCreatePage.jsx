import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  ArrowLeft,
  Plus,
  Trash2,
  ClipboardList,
  FileUp,
  Lock,
} from "lucide-react"
import { PageHeader } from "@/components/layout"
import { Button, Card, Input, Badge } from "@/components/ui"
import { useClassroom } from "@/session/useClassroom"
import { repository, ApiError } from "@/services"
import { SKILLS } from "@/domain/constants"
import "./AssessmentCreatePage.css"

const newQuestion = () => ({
  question_text: "",
  skill: SKILLS[0].key,
  expected_ideas: "",
})

/** Today in YYYY-MM-DD for the default scheduled_for value. */
function todayISO() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * AssessmentCreatePage — build a reading assessment and schedule it for the
 * active classroom via the backend. Scheduling creates one assessment per
 * active learner (a batch) and returns a shared access code; we then send the
 * teacher to that batch's share screen.
 *
 * The backend requires 3–5 questions, each tagged with a backend skill and a
 * short "expected ideas" hint used by the AI check. The PDF/AI upload block
 * stays an inert seam until the extraction backend exists.
 */
export function AssessmentCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeClassroom } = useClassroom()
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("Fiction")
  const [passage, setPassage] = useState("")
  const [scheduledFor, setScheduledFor] = useState(todayISO())
  const [questions, setQuestions] = useState([
    newQuestion(),
    newQuestion(),
    newQuestion(),
  ])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const setQuestion = (i, patch) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  const addQuestion = () =>
    setQuestions((qs) => (qs.length < 5 ? [...qs, newQuestion()] : qs))
  const removeQuestion = (i) =>
    setQuestions((qs) => (qs.length > 3 ? qs.filter((_, idx) => idx !== i) : qs))

  const canSave =
    title.trim() &&
    passage.trim() &&
    questions.length >= 3 &&
    questions.length <= 5 &&
    questions.every((q) => q.question_text.trim() && q.expected_ideas.trim())

  const onSave = async () => {
    setError(null)
    if (!activeClassroom?.id) {
      setError(t("assessmentCreate.errorNoClassroom"))
      return
    }
    if (!canSave) {
      setError(t("assessmentCreate.errorInvalid"))
      return
    }
    setSaving(true)
    try {
      const summary = await repository.scheduleAssessment({
        classroom_id: activeClassroom.id,
        title: title.trim(),
        category: category.trim() || "Reading",
        passage_text: passage.trim(),
        scheduled_for: scheduledFor,
        questions: questions.map((q) => ({
          question_text: q.question_text.trim(),
          skill: q.skill,
          expected_ideas: q.expected_ideas.trim(),
        })),
      })
      // Scheduling returns the shared access code for the batch.
      navigate(`/assessments/${summary.access_code}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || t("assessmentCreate.errorCreate"))
      } else {
        setError(t("assessmentCreate.errorServer"))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <button type="button" className="text-link" onClick={() => navigate(-1)}>
        <ArrowLeft aria-hidden="true" /> {t("assessmentCreate.backToAssessments")}
      </button>

      <PageHeader
        eyebrow={t("assessmentCreate.eyebrow")}
        title={t("assessmentCreate.title")}
        subtitle={t("assessmentCreate.subtitle")}
      />

      {/* PDF / AI upload seam — inert until a backend is connected */}
      <Card className="create__ai">
        <div className="create__ai-main">
          <span className="create__ai-icon">
            <FileUp aria-hidden="true" />
          </span>
          <div>
            <h3 className="create__ai-title">
              {t("assessmentCreate.aiTitle")}
              <Badge tone="neutral" icon={Lock}>
                {t("assessmentCreate.aiBadge")}
              </Badge>
            </h3>
            <p className="create__ai-desc">{t("assessmentCreate.aiDesc")}</p>
          </div>
        </div>
        <Button variant="outline" icon={FileUp} disabled>
          {t("assessmentCreate.uploadMaterial")}
        </Button>
      </Card>

      <Card>
        <Card.Header title={t("assessmentCreate.details")} />
        <Card.Body>
          <div className="stack">
            <Input
              label={t("assessmentCreate.fieldTitle")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("assessmentCreate.titlePlaceholder")}
            />
            <Input
              label={t("assessmentCreate.category")}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t("assessmentCreate.categoryPlaceholder")}
            />
            <Input
              label={t("assessmentCreate.scheduledFor")}
              type="date"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
            <div className="field">
              <label className="field__label" htmlFor="passage">
                {t("assessmentCreate.passage")}
              </label>
              <textarea
                id="passage"
                className="create__passage"
                rows={9}
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                placeholder={t("assessmentCreate.passagePlaceholder")}
              />
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          title={t("assessmentCreate.questions")}
          subtitle={t("assessmentCreate.questionsSub")}
        />
        <Card.Body>
          <div className="stack">
            {questions.map((q, i) => (
              <div className="create__q" key={i}>
                <div className="create__q-head">
                  <span className="create__q-num">
                    {t("assessmentCreate.question", { number: i + 1 })}
                  </span>
                  <button
                    type="button"
                    className="create__q-remove"
                    onClick={() => removeQuestion(i)}
                    disabled={questions.length <= 3}
                    aria-label={t("assessmentCreate.removeQuestion", {
                      number: i + 1,
                    })}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
                <Input
                  label={t("assessmentCreate.questionLabel")}
                  value={q.question_text}
                  onChange={(e) =>
                    setQuestion(i, { question_text: e.target.value })
                  }
                  placeholder={t("assessmentCreate.questionPlaceholder")}
                />
                <Input
                  label={t("assessmentCreate.expectedIdeas")}
                  value={q.expected_ideas}
                  onChange={(e) =>
                    setQuestion(i, { expected_ideas: e.target.value })
                  }
                  placeholder={t("assessmentCreate.expectedIdeasPlaceholder")}
                />
                <div className="field">
                  <label className="field__label" htmlFor={`skill-${i}`}>
                    {t("assessmentCreate.skill")}
                  </label>
                  <div className="field__control">
                    <select
                      id={`skill-${i}`}
                      className="create__select"
                      value={q.skill}
                      onChange={(e) => setQuestion(i, { skill: e.target.value })}
                    >
                      {SKILLS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              icon={Plus}
              onClick={addQuestion}
              disabled={questions.length >= 5}
            >
              {t("assessmentCreate.addQuestion")}
            </Button>
          </div>
        </Card.Body>
      </Card>

      {error ? (
        <p className="create__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="create__actions">
        <Button variant="ghost" onClick={() => navigate("/assessments")}>
          {t("assessmentCreate.cancel")}
        </Button>
        <Button icon={ClipboardList} onClick={onSave} disabled={saving}>
          {saving
            ? t("assessmentCreate.scheduling")
            : t("assessmentCreate.createGetCode")}
        </Button>
      </div>
    </div>
  )
}