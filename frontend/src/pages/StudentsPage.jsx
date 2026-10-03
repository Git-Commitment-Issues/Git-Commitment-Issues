import { Link } from 'react-router-dom'
import { Search, UserPlus, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Button, Card, Input, Avatar, ProficiencyBadge } from '@/components/ui'
import { STUDENTS, COMPREHENSION_SKILLS, scoreToLevel } from '@/data/mockData'
import './StudentsPage.css'

const skillLabel = (key) =>
  COMPREHENSION_SKILLS.find((s) => s.key === key)?.label ?? key

/**
 * StudentsPage — the class roster with each student's overall comprehension
 * level and current focus skill. Rows link to the individual report view.
 */
export function StudentsPage() {
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Grade 8 English · Section A"
        title="Students"
        subtitle="Every learner in this class, with their latest overall comprehension level and the skill the AI suggests focusing on next."
        actions={
          <Button icon={UserPlus} variant="outline">
            Add student
          </Button>
        }
      />

      <Card padded={false}>
        <div className="students__toolbar">
          <Input
            icon={Search}
            placeholder="Filter by name or student code…"
            aria-label="Filter students"
            className="students__filter"
          />
        </div>

        <div className="students__table" role="table" aria-label="Student roster">
          <div className="students__head" role="row">
            <span role="columnheader">Student</span>
            <span role="columnheader">Overall</span>
            <span role="columnheader" className="students__col-focus">
              Focus skill
            </span>
            <span role="columnheader" className="students__col-count">
              Assessments
            </span>
            <span role="columnheader" className="sr-only">
              View
            </span>
          </div>

          <ul className="row-list">
            {STUDENTS.map((student) => (
              <li key={student.id} role="row">
                <Link
                  to={`/students/${student.id}`}
                  className="students__row"
                >
                  <span className="students__cell students__cell--student">
                    <Avatar name={student.name} size="sm" />
                    <span className="students__meta">
                      <span className="students__name">{student.name}</span>
                      <span className="students__code">{student.code}</span>
                    </span>
                  </span>

                  <span className="students__cell">
                    <ProficiencyBadge level={scoreToLevel(student.overall)} />
                  </span>

                  <span className="students__cell students__col-focus">
                    {skillLabel(student.focusSkill)}
                  </span>

                  <span className="students__cell students__col-count">
                    {student.assessmentsTaken}
                  </span>

                  <span className="students__cell students__cell--chevron">
                    <ChevronRight aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  )
}
