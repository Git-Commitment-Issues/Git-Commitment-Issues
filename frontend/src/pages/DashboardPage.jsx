import { Link } from 'react-router-dom'
import {
  Users,
  Gauge,
  LifeBuoy,
  ClipboardList,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Button, Card, Avatar, ProficiencyBadge } from '@/components/ui'
import { StatCard, SkillBar } from '@/components/data'
import {
  CLASS_SUMMARY,
  CLASS_SKILL_AVERAGES,
  STUDENTS_NEEDING_SUPPORT,
  scoreToLevel,
} from '@/data/mockData'
import './DashboardPage.css'

/**
 * DashboardPage — the teacher's class overview. Surfaces the signals the
 * documentation calls for: who may be struggling, which comprehension skills
 * are weakest, and quick access to act on them.
 */
export function DashboardPage() {
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Grade 8 English · Section A"
        title="Class overview"
        subtitle="A focused read on how your class is comprehending — and who may need a closer look this week."
        actions={
          <Button icon={ClipboardList} variant="primary">
            New assessment
          </Button>
        }
      />

      <section className="grid-stats" aria-label="Class summary">
        <StatCard
          icon={Users}
          tone="primary"
          label="Students assessed"
          value={CLASS_SUMMARY.studentsAssessed}
          hint={`of ${CLASS_SUMMARY.totalStudents} students`}
        />
        <StatCard
          icon={Gauge}
          tone="accent"
          label="Class average"
          value={`${CLASS_SUMMARY.classAverage}%`}
          hint="Overall comprehension"
        />
        <StatCard
          icon={LifeBuoy}
          tone="error"
          label="May need support"
          value={CLASS_SUMMARY.needSupport}
          hint="Flagged by AI analysis"
        />
        <StatCard
          icon={ClipboardList}
          tone="success"
          label="Assessments"
          value={CLASS_SUMMARY.assessmentsThisMonth}
          hint="Run this month"
        />
      </section>

      <section className="grid-2">
        <Card>
          <Card.Header
            title="Comprehension by skill"
            subtitle="Class average across the five reading-comprehension skills"
          />
          <Card.Body>
            <div className="dashboard__skills">
              {CLASS_SKILL_AVERAGES.map((skill) => (
                <SkillBar
                  key={skill.key}
                  label={skill.label}
                  score={skill.score}
                />
              ))}
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            title="Needs a closer look"
            subtitle="Lowest overall comprehension"
            action={
              <Link to="/students" className="text-link">
                All students
                <ArrowUpRight aria-hidden="true" />
              </Link>
            }
          />
          <Card.Body>
            <ul className="row-list">
              {STUDENTS_NEEDING_SUPPORT.map((student) => (
                <li key={student.id} className="support-row">
                  <Link to={`/students/${student.id}`} className="support-row__link">
                    <Avatar name={student.name} size="sm" />
                    <span className="support-row__meta">
                      <span className="support-row__name">{student.name}</span>
                      <span className="support-row__code">{student.code}</span>
                    </span>
                    <ProficiencyBadge level={scoreToLevel(student.overall)} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card.Body>
        </Card>
      </section>

      <Card raised className="dashboard__insight">
        <span className="dashboard__insight-icon">
          <Sparkles aria-hidden="true" />
        </span>
        <div>
          <h3 className="dashboard__insight-title">AI insight</h3>
          <p className="dashboard__insight-text">
            Inference is the weakest skill class-wide this month. Six students
            scored below developing on inference questions, most often when
            asked to draw conclusions not stated directly in the passage.
            Consider a short targeted assessment focused on inference.
          </p>
        </div>
      </Card>
    </div>
  )
}
