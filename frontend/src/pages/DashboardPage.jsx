import { Link } from 'react-router-dom'
import {
  Users,
  Gauge,
  LifeBuoy,
  ClipboardList,
  ArrowUpRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Button, Card, Avatar, ProficiencyBadge } from '@/components/ui'
import { StatCard, CountUp } from '@/components/data'
import {
  SkillBarChart,
  ProficiencyDonut,
  TrendAreaChart,
  ChartReveal,
} from '@/components/charts'
import {
  CLASS_SUMMARY,
  CLASS_SKILL_AVERAGES,
  CLASS_TREND,
  PROFICIENCY_DISTRIBUTION,
  STUDENTS_NEEDING_SUPPORT,
  scoreToLevel,
} from '@/data/mockData'
import './DashboardPage.css'

/**
 * DashboardPage — the teacher's class overview. Headline metrics, a trend of
 * class comprehension, per-skill averages, the proficiency mix, and who needs
 * a closer look — visualized with Recharts.
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
            <Link to="/assessments/new">New assessment</Link>
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

      {/* Trend — full width hero chart */}
      <Card>
        <Card.Header
          title="Comprehension trend"
          subtitle="Class average across recent assessments"
          action={
            <span className="dashboard__trend-tag">
              <TrendingUp aria-hidden="true" />
              <CountUp value="+13%" /> since Aug
            </span>
          }
        />
        <Card.Body>
          <ChartReveal height={240}>
            <TrendAreaChart data={CLASS_TREND} />
          </ChartReveal>
        </Card.Body>
      </Card>

      <section className="grid-2">
        <Card>
          <Card.Header
            title="Comprehension by skill"
            subtitle="Class average across the five reading-comprehension skills"
          />
          <Card.Body>
            <ChartReveal height={CLASS_SKILL_AVERAGES.length * 46}>
              <SkillBarChart data={CLASS_SKILL_AVERAGES} />
            </ChartReveal>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            title="Proficiency mix"
            subtitle="Where learners sit right now"
          />
          <Card.Body>
            <ChartReveal height={200}>
              <ProficiencyDonut data={PROFICIENCY_DISTRIBUTION} />
            </ChartReveal>
          </Card.Body>
        </Card>
      </section>

      <section className="grid-2">
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
                  <Link
                    to={`/students/${student.id}`}
                    className="support-row__link"
                  >
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
      </section>
    </div>
  )
}
