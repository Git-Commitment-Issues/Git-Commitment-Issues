import { useState } from "react"
import { useNavigate } from "react-router-dom"
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
      setError("Select or create a classroom first.")
      return
    }
    if (!canSave) {
      setError(
        "Add a title, a passage, and 3–5 questions — each with its text and expected ideas.",
      )
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
        setError(err.message || "Couldn’t create the assessment.")
      } else {
        setError("Couldn’t reach the server. Try again shortly.")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <button type="button" className="text-link" onClick={() => navigate(-1)}>
        <ArrowLeft aria-hidden="true" /> Back to assessments
      </button>

      <PageHeader
        eyebrow="New assessment"
        title="Create an assessment"
        subtitle="Add a reading passage and 3–5 questions. Scheduling it gives every learner in the class a copy and a shared join code."
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
              questions. For now, use the on-device scanner on the Assessments
              page, or build the assessment below.
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
            <Input
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Fiction"
            />
            <Input
              label="Scheduled for"
              type="date"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
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
          subtitle="3–5 questions. Tag each with the skill it targets and the key ideas a correct answer should mention."
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
                    disabled={questions.length <= 3}
                    aria-label={`Remove question ${i + 1}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
                <Input
                  label="Question"
                  value={q.question_text}
                  onChange={(e) =>
                    setQuestion(i, { question_text: e.target.value })
                  }
                  placeholder="e.g. What is the main idea of the passage?"
                />
                <Input
                  label="Expected ideas"
                  value={q.expected_ideas}
                  onChange={(e) =>
                    setQuestion(i, { expected_ideas: e.target.value })
                  }
                  placeholder="Key points a correct answer should mention"
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
              Add question
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
          Cancel
        </Button>
        <Button icon={ClipboardList} onClick={onSave} disabled={saving}>
          {saving ? "Scheduling…" : "Create & get code"}
        </Button>
      </div>
    </div>
  )
}