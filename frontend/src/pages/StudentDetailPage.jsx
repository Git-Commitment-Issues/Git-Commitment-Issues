import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Sparkles, History, Target } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Card, Avatar, Badge, ProficiencyBadge } from '@/components/ui'
import { SkillBar } from '@/components/data'
import { STUDENTS, COMPREHENSION_SKILLS, scoreToLevel } from '@/data/mockData'
import './StudentDetailPage.css'

const skillLabel = (key) =>
  COMPREHENSION_SKILLS.find((s) => s.key === key)?.label ?? key

/**
 * StudentDetailPage — the individual report view. Shows the per-skill
 * breakdown, the AI's suggested focus area, and a placeholder assessment
 * history, mirroring the "Individual Student" section of the documentation.
 */
export function StudentDetailPage() {
  const { studentId } = useParams()
  const student = STUDENTS.find((s) => s.id === studentId)

  if (!student) {
    return (
      <div className="stack">
        <Link to="/students" className="detail__back">
          <ArrowLeft aria-hidden="true" /> Back to students
        </Link>
        <Card padded>
          <div className="empty-state">
            <h3>Student not found</h3>
            <p>
              This student isn’t in the current class roster. They may have been
              moved to another section.
            </p>
            <Link to="/students" className="detail__back">
              Return to roster
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const skillEntries = COMPREHENSION_SKILLS.map((s) => ({
    ...s,
    score: student.skills[s.key] ?? 0,
  }))

  return (
    <div className="stack">
      <Link to="/students" className="detail__back">
        <ArrowLeft aria-hidden="true" /> Back to students
      </Link>

      <PageHeader
        title={student.name}
        subtitle={`Student code ${student.code} · Last active ${student.lastActive}`}
        actions={<ProficiencyBadge level={scoreToLevel(student.overall)} />}
      />

      <div className="detail__identity">
        <Avatar name={student.name} size="lg" />
        <div className="detail__identity-stats">
          <div className="detail__stat">
            <span className="detail__stat-value">{student.overall}%</span>
            <span className="detail__stat-label">Overall comprehension</span>
          </div>
          <div className="detail__stat">
            <span className="detail__stat-value">
              {student.assessmentsTaken}
            </span>
            <span className="detail__stat-label">Assessments taken</span>
          </div>
          <div className="detail__stat">
            <span className="detail__stat-value">
              {skillLabel(student.focusSkill)}
            </span>
            <span className="detail__stat-label">Primary focus area</span>
          </div>
        </div>
      </div>

      <section className="grid-2">
        <Card>
          <Card.Header
            title="Skill breakdown"
            subtitle="Latest results across the five comprehension skills"
          />
          <Card.Body>
            <div className="detail__skills">
              {skillEntries.map((skill) => (
                <SkillBar
                  key={skill.key}
                  label={skill.label}
                  score={skill.score}
                />
              ))}
            </div>
          </Card.Body>
        </Card>

        <div className="stack">
          <Card raised className="detail__ai">
            <span className="detail__ai-icon">
              <Sparkles aria-hidden="true" />
            </span>
            <div>
              <h3 className="detail__ai-title">AI analysis</h3>
              <p className="detail__ai-text">
                {student.name.split(' ')[0]} reliably identifies the main idea
                and supporting details, but tends to struggle when a question
                requires reading between the lines. The strongest opportunity
                is <strong>{skillLabel(student.focusSkill)}</strong>.
              </p>
            </div>
          </Card>

          <Card>
            <Card.Header
              title="Assessment history"
              subtitle="Recent reading assessments"
            />
            <Card.Body>
              <div className="empty-state">
                <span className="empty-state__icon">
                  <History aria-hidden="true" />
                </span>
                <h3>History coming soon</h3>
                <p>
                  Completed assessments and progress over time will appear here
                  once connected to the assessment service.
                </p>
              </div>
            </Card.Body>
          </Card>
        </div>
      </section>

      <Card>
        <Card.Header
          title="Suggested next step"
          action={<Badge tone="accent" icon={Target}>Recommendation</Badge>}
        />
        <Card.Body>
          <p className="detail__recommendation">
            Assign a short inference-focused assessment with 4–5 questions that
            ask {student.name.split(' ')[0]} to draw conclusions and predict
            outcomes. Pair it with a passage at the current reading level to
            isolate the skill rather than reading difficulty.
          </p>
        </Card.Body>
      </Card>
    </div>
  )
}
