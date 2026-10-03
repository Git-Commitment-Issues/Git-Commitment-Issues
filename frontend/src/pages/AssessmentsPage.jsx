import { useState } from "react"
import { Link } from "react-router-dom"
import { Plus, FileText, Users, Clock } from "lucide-react"
import { PageHeader } from "@/components/layout"
import { Button, Card, StatusBadge, EmptyState } from "@/components/ui"
import { useClassroom } from "@/session/useClassroom"
import { useAsync } from "@/hooks/useAsync"
import { repository } from "@/services"
import { ImportPanel } from "./assessments/ImportPanel"
import "./AssessmentsPage.css"

/**
 * AssessmentsPage — create and manage reading assessments for the active
 * classroom. The assessment cards are loaded from the backend batch list; the
 * card grid, scanner (OCR ImportPanel), and styling are unchanged from the
 * original design — only the data source moved from mock data to the API.
 */
export function AssessmentsPage() {
  const { activeClassroom, loading: classroomLoading } = useClassroom()
  const classroomId = activeClassroom?.id ?? null
  const [showScanner, setShowScanner] = useState(false)
  const [scannedPassage, setScannedPassage] = useState("")

  const { data, loading } = useAsync(() => {
    if (!classroomId) return Promise.resolve([])
    return repository.listClassroomAssessments(classroomId)
  }, [classroomId])

  const assessments = data ?? []
  const isLoading = classroomLoading || loading

  return (
    <div className="stack">
      <PageHeader
        eyebrow={activeClassroom?.name ?? "Assessments"}
        title="Assessments"
        subtitle="Short, repeatable reading passages with skill-tagged questions. Create one, generate a QR session, and let the AI analyze the responses."
        actions={
          <Button
            icon={Plus}
            variant="primary"
            onClick={() => setShowScanner((v) => !v)}
          >
            Create assessment
          </Button>
        }
      />

      {showScanner && (
        <ImportPanel
          onApply={({ passage_text }) => setScannedPassage(passage_text)}
        />
      )}

      {scannedPassage && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Scanned passage ready</h3>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{scannedPassage}</p>
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
          {assessments.map((assessment) => (
            <Card
              key={assessment.id}
              interactive
              className="assessment-card"
            >
              <Link
                to={`/assessments/${assessment.id}`}
                style={{ color: "inherit", textDecoration: "none", display: "block" }}
              >
                <div className="assessment-card__top">
                  <span className="assessment-card__icon">
                    <FileText aria-hidden="true" />
                  </span>
                  <StatusBadge status={assessment.status} />
                </div>

                <h3 className="assessment-card__title">{assessment.title}</h3>
                <p className="assessment-card__grade">
                  Code {assessment.access_code}
                </p>

                <div className="assessment-card__footer">
                  <span className="assessment-card__stat">
                    <Users aria-hidden="true" />
                    {assessment.comprehension_score != null
                      ? `${Math.round(assessment.comprehension_score)}%`
                      : "Not graded"}
                  </span>
                  <span className="assessment-card__stat assessment-card__stat--muted">
                    <Clock aria-hidden="true" />
                    {assessment.scheduled_for}
                  </span>
                </div>
              </Link>
            </Card>
          ))}

          {/* Create tile */}
          <button
            type="button"
            className="assessment-create"
            onClick={() => setShowScanner(true)}
          >
            <span className="assessment-create__icon">
              <Plus aria-hidden="true" />
            </span>
            <span className="assessment-create__label">New assessment</span>
            <span className="assessment-create__hint">
              Start from a scanned or typed passage
            </span>
          </button>
        </section>
      )}
    </div>
  )
}