import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus, FileText, Users, Clock, Hash, Sparkles } from "lucide-react"
import { PageHeader } from "@/components/layout"
import { Button, Card, Badge, StatusBadge, EmptyState } from "@/components/ui"
import { useClassroom } from "@/session/useClassroom"
import { useAsync } from "@/hooks/useAsync"
import { repository, ApiError } from "@/services"
import { ImportPanel } from "./assessments/ImportPanel"
import "./AssessmentsPage.css"

/**
 * AssessmentsPage — create and manage reading assessments for the active
 * classroom. The card grid, scanner (OCR ImportPanel), and create flow follow
 * the new design; cards load from the backend batch list and open their share
 * screen by access code.
 *
 * Scan-to-draft: after the on-device OCR produces text, "Draft with AI" sends
 * it to the backend extraction endpoint, which uses the chatbot to structure it
 * into a passage + skill-tagged questions, then opens the create form prefilled
 * with that draft for the teacher to review and save.
 */
export function AssessmentsPage() {
  const { activeClassroom, loading: classroomLoading } = useClassroom()
  const classroomId = activeClassroom?.id ?? null
  const navigate = useNavigate()
  const [showScanner, setShowScanner] = useState(false)
  const [scannedPassage, setScannedPassage] = useState("")
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState(null)

  const { data, loading } = useAsync(() => {
    if (!classroomId) return Promise.resolve([])
    return repository.listClassroomAssessments(classroomId)
  }, [classroomId])

  const assessments = data ?? []
  const isLoading = classroomLoading || loading

  const draftWithAI = async () => {
    setDraftError(null)
    setDrafting(true)
    try {
      const draft = await repository.extractAssessment(scannedPassage)
      // Hand the draft to the create form via router state to prefill it.
      navigate("/assessments/new", { state: { draft } })
    } catch (err) {
      if (err instanceof ApiError) {
        setDraftError(err.message || "Couldn’t draft from that text.")
      } else {
        setDraftError("Couldn’t reach the server. Try again shortly.")
      }
    } finally {
      setDrafting(false)
    }
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow={activeClassroom?.name ?? "Assessments"}
        title="Assessments"
        subtitle="Create a reading passage with questions, then share the join code or QR with your students."
        actions={
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <Button
              icon={FileText}
              variant="outline"
              onClick={() => setShowScanner((v) => !v)}
            >
              Scan a page
            </Button>
            <Button icon={Plus} variant="primary">
              <Link to="/assessments/new">Create assessment</Link>
            </Button>
          </div>
        }
      />

      {showScanner && (
        <ImportPanel
          onApply={({ passage_text }) => {
            setScannedPassage(passage_text)
            setDraftError(null)
          }}
        />
      )}

      {scannedPassage && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Scanned passage ready</h3>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{scannedPassage}</p>
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              alignItems: "center",
              marginTop: "var(--space-4)",
              flexWrap: "wrap",
            }}
          >
            <Button icon={Sparkles} onClick={draftWithAI} disabled={drafting}>
              {drafting ? "Drafting with AI…" : "Draft assessment with AI"}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                navigate("/assessments/new", {
                  state: { draft: { passage_text: scannedPassage } },
                })
              }
            >
              Use text as passage only
            </Button>
          </div>
          {draftError ? (
            <p style={{ color: "var(--color-error)", marginTop: "var(--space-3)" }} role="alert">
              {draftError}
            </p>
          ) : null}
        </Card>
      )}

      {isLoading ? (
        <Card>
          <EmptyState title="Loading…" />
        </Card>
      ) : assessments.length === 0 ? (
        <Card>
          <EmptyState
            title={classroomId ? "No assessments yet" : "No classroom selected"}
            message={
              classroomId
                ? "Create an assessment to schedule it for this class."
                : "Select or create a classroom to manage its assessments."
            }
          />
        </Card>
      ) : (
        <section className="assessments__grid" aria-label="Assessments">
          {assessments.map((a) => (
            <Card key={a.id} interactive className="assessment-card">
              <Link
                to={`/assessments/${a.access_code}`}
                className="assessment-card__link"
              >
                <div className="assessment-card__top">
                  <span className="assessment-card__icon">
                    <FileText aria-hidden="true" />
                  </span>
                  <StatusBadge status={a.status} />
                </div>

                <h3 className="assessment-card__title">{a.title}</h3>
                <p className="assessment-card__grade">
                  <Badge tone="primary" icon={Hash}>
                    {a.access_code}
                  </Badge>
                </p>

                <div className="assessment-card__footer">
                  <span className="assessment-card__stat">
                    <Users aria-hidden="true" />
                    {a.comprehension_score != null
                      ? `${Math.round(Number(a.comprehension_score))}%`
                      : "Not graded"}
                  </span>
                  <span className="assessment-card__stat assessment-card__stat--muted">
                    <Clock aria-hidden="true" />
                    {a.scheduled_for}
                  </span>
                </div>
              </Link>
            </Card>
          ))}

          {/* Create tile */}
          <Link to="/assessments/new" className="assessment-create">
            <span className="assessment-create__icon">
              <Plus aria-hidden="true" />
            </span>
            <span className="assessment-create__label">New assessment</span>
            <span className="assessment-create__hint">
              Paste a passage and add questions
            </span>
          </Link>
        </section>
      )}
    </div>
  )
}