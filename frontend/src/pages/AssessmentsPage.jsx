import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileText, Users, Clock, Hash } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Button, Card, Badge, Modal, StatusBadge, EmptyState } from '@/components/ui'
import { useClassroom } from '@/session/useClassroom'
import { useAsync } from '@/hooks/useAsync'
import { repository } from '@/services'
import { ImportPanel } from './assessments/ImportPanel'
import './AssessmentsPage.css'

/**
 * AssessmentsPage — create and manage reading assessments for the active
 * classroom. The card grid, scanner (OCR ImportPanel in a modal), and create
 * flow follow the new design; the cards are loaded from the backend batch list
 * for the active classroom and each opens its share screen by access code.
 */
export function AssessmentsPage() {
  const { activeClassroom, loading: classroomLoading } = useClassroom()
  const classroomId = activeClassroom?.id ?? null
  const [showScanner, setShowScanner] = useState(false)
  const [scannedPassage, setScannedPassage] = useState('')

  const { data, loading } = useAsync(() => {
    if (!classroomId) return Promise.resolve([])
    return repository.listClassroomAssessments(classroomId)
  }, [classroomId])

  const assessments = data ?? []
  const isLoading = classroomLoading || loading

  return (
    <div className="stack">
      <PageHeader
        eyebrow={activeClassroom?.name ?? 'Assessments'}
        title="Assessments"
        subtitle="Create a reading passage with questions, then share the join code or QR with your students."
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
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

      <Modal open={showScanner} onClose={() => setShowScanner(false)} size="md">
        <ImportPanel
          onApply={({ passage_text }) => {
            setScannedPassage(passage_text)
            setShowScanner(false)
          }}
        />
      </Modal>

      {scannedPassage && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Scanned passage ready</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{scannedPassage}</p>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <EmptyState title="Loading…" />
        </Card>
      ) : assessments.length === 0 ? (
        <Card>
          <EmptyState
            title={classroomId ? 'No assessments yet' : 'No classroom selected'}
            message={
              classroomId
                ? 'Create an assessment to schedule it for this class.'
                : 'Select or create a classroom to manage its assessments.'
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
                      : 'Not graded'}
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
