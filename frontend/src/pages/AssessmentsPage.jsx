import { Link } from 'react-router-dom'
import { Plus, FileText, Users, HelpCircle, Hash } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Button, Card, Badge } from '@/components/ui'
import { listAssessments } from '@/data/assessmentStore'
import './AssessmentsPage.css'

/**
 * AssessmentsPage — lists the assessments the teacher has created (saved in
 * the browser). Each card opens its share screen (code + QR). The create
 * button and tile go to the builder.
 */
export function AssessmentsPage() {
  const assessments = listAssessments()

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Assessments"
        title="Assessments"
        subtitle="Create a reading passage with questions, then share the join code or QR with your students."
        actions={
          <Button icon={Plus} variant="primary">
            <Link to="/assessments/new">Create assessment</Link>
          </Button>
        }
      />

      <section className="assessments__grid" aria-label="Assessments">
        {assessments.map((a) => (
          <Card key={a.code} interactive className="assessment-card">
            <Link to={`/assessments/${a.code}`} className="assessment-card__link">
              <div className="assessment-card__top">
                <span className="assessment-card__icon">
                  <FileText aria-hidden="true" />
                </span>
                <Badge tone="primary" icon={Hash}>
                  {a.code}
                </Badge>
              </div>

              <h3 className="assessment-card__title">{a.title}</h3>

              <div className="assessment-card__footer">
                <span className="assessment-card__stat">
                  <HelpCircle aria-hidden="true" />
                  {a.questions.length} questions
                </span>
                <span className="assessment-card__stat">
                  <Users aria-hidden="true" />
                  {a.responses.length} responses
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
    </div>
  )
}
