import { Plus, FileText, Users, HelpCircle, Clock } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Button, Card, Badge } from '@/components/ui'
import { ASSESSMENTS, COMPREHENSION_SKILLS } from '@/data/mockData'
import './AssessmentsPage.css'

const skillLabel = (key) =>
  COMPREHENSION_SKILLS.find((s) => s.key === key)?.label ?? key

// Map an assessment status to a badge tone + label.
const STATUS = {
  active: { tone: 'success', label: 'Active' },
  draft: { tone: 'neutral', label: 'Draft' },
  closed: { tone: 'primary', label: 'Closed' },
}

/**
 * AssessmentsPage — create and manage reading assessments. Each card is a
 * short, repeatable assessment (passage + a few skill-tagged questions) as
 * described in the documentation.
 */
export function AssessmentsPage() {
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Grade 8 English · Section A"
        title="Assessments"
        subtitle="Short, repeatable reading passages with skill-tagged questions. Create one, generate a QR session, and let the AI analyze the responses."
        actions={
          <Button icon={Plus} variant="primary">
            Create assessment
          </Button>
        }
      />

      <section className="assessments__grid" aria-label="Assessments">
        {ASSESSMENTS.map((assessment) => {
          const status = STATUS[assessment.status] ?? STATUS.draft
          return (
            <Card key={assessment.id} interactive className="assessment-card">
              <div className="assessment-card__top">
                <span className="assessment-card__icon">
                  <FileText aria-hidden="true" />
                </span>
                <Badge tone={status.tone} dot>
                  {status.label}
                </Badge>
              </div>

              <h3 className="assessment-card__title">{assessment.title}</h3>
              <p className="assessment-card__grade">{assessment.grade}</p>

              <ul className="assessment-card__skills">
                {assessment.skills.map((key) => (
                  <li key={key}>
                    <Badge tone="primary">{skillLabel(key)}</Badge>
                  </li>
                ))}
              </ul>

              <div className="assessment-card__footer">
                <span className="assessment-card__stat">
                  <HelpCircle aria-hidden="true" />
                  {assessment.questions} questions
                </span>
                <span className="assessment-card__stat">
                  <Users aria-hidden="true" />
                  {assessment.responses} responses
                </span>
                <span className="assessment-card__stat assessment-card__stat--muted">
                  <Clock aria-hidden="true" />
                  {assessment.updated}
                </span>
              </div>
            </Card>
          )
        })}

        {/* Create tile */}
        <button type="button" className="assessment-create">
          <span className="assessment-create__icon">
            <Plus aria-hidden="true" />
          </span>
          <span className="assessment-create__label">New assessment</span>
          <span className="assessment-create__hint">
            Start from a passage or template
          </span>
        </button>
      </section>
    </div>
  )
}
