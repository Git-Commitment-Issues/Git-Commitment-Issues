import { Link } from 'react-router-dom'
import {
  Users,
  Gauge,
  LifeBuoy,
  ClipboardList,
  ArrowUpRight,
} from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Button, Card, Avatar, ProficiencyBadge, EmptyState } from '@/components/ui'
import { StatCard } from '@/components/data'
import { SkillBarChart, ProficiencyDonut, ChartReveal } from '@/components/charts'
import { useClassroom } from '@/session/useClassroom'
import { useAsync } from '@/hooks/useAsync'
import { repository } from '@/services'
import { skillLabel, diagnosisToLevel } from '@/domain/constants'
import './DashboardPage.css'

/**
 * DashboardPage — the teacher's class overview.
 *
 * Visual design is the Recharts-based layout (headline stat cards, a per-skill
 * bar chart, a proficiency-mix donut, and a "needs a closer look" list), with
 * the neon charts revealed on scroll. The DATA is backend-driven: dashboard
 * aggregates for the active classroom (needs-help, per-skill breakdown, batch
 * counts) plus the active roster for the proficiency total. Charts/sections
 * fall back to a clear empty state when the backend has no completed batch yet,
 * so nothing is fabricated.
 */
export function DashboardPage() {
  const { activeClassroom, loading: classroomLoading } = useClassroom()
  const classroomId = activeClassroom?.id ?? null

  const { data, loading, error } = useAsync(async () => {
    if (!classroomId) return null
    // Fetch the dashboard aggregates for the default (most recent completed)
    // batch in parallel. Each call tolerates "no completed batch yet" (404) by
    // resolving to an empty shape so the page renders instead of erroring.
    const emptyRows = { rows: [] }
    const [needsHelp, skills, batches, students] = await Promise.all([
      repository.getNeedsHelp(classroomId).catch(() => emptyRows),
      repository.getSkillsBreakdown(classroomId).catch(() => emptyRows),
      repository.listBatches(classroomId).catch(() => []),
      repository.listStudents(classroomId).catch(() => []),
    ])
    return { needsHelp, skills, batches, students }
  }, [classroomId])

  const needHelpRows = data?.needsHelp?.rows ?? []
  const skillRows = data?.skills?.rows ?? []
  const batches = data?.batches ?? []
  const roster = data?.students ?? []

  // Headline metrics derived from the real aggregates.
  const completedCount = batches.reduce((sum, b) => sum + (b.completed ?? 0), 0)
  const totalAssessments = batches.reduce((sum, b) => sum + (b.total ?? 0), 0)
  const classAverage =
    skillRows.length > 0
      ? Math.round(
          skillRows.reduce((sum, s) => sum + Number(s.avg_score ?? 0), 0) /
            skillRows.length,
        )
      : null

  // Per-skill chart data from the backend breakdown.
  const skillChartData = skillRows.map((s) => ({
    label: skillLabel(s.skill),
    score: Math.round(Number(s.avg_score ?? 0)),
  }))

  // Proficiency mix derived from the needs-help diagnoses against the active
  // roster size: everyone not flagged is treated as on-track. Only shown when
  // we actually have a roster to anchor the total.
  const rosterSize = roster.length
  const priorityCount = needHelpRows.filter(
    (r) => r.diagnosis === 'highest_priority',
  ).length
  const barrierCount = needHelpRows.filter(
    (r) => r.diagnosis === 'comprehension_barrier',
  ).length
  const onTrackCount = Math.max(0, rosterSize - priorityCount - barrierCount)
  const proficiencyData =
    rosterSize > 0
      ? [
          { name: 'On track', value: onTrackCount, tone: 'success' },
          { name: 'Comprehension barrier', value: barrierCount, tone: 'primary' },
          { name: 'Highest priority', value: priorityCount, tone: 'error' },
        ].filter((d) => d.value > 0)
      : []

  const isLoading = classroomLoading || loading

  return (
    <div className="stack">
      <PageHeader
        eyebrow={activeClassroom?.name ?? 'Class overview'}
        title="Class overview"
        subtitle="A focused read on how your class is comprehending — and who may need a closer look this week."
        actions={
          <Button icon={ClipboardList} variant="primary">
            <Link to="/assessments/new">New assessment</Link>
          </Button>
        }
      />

      {!classroomId && !classroomLoading ? (
        <Card>
          <EmptyState
            title="No classroom selected"
            message="Create or select a classroom to see its reading-comprehension overview."
          />
        </Card>
      ) : null}

      <section className="grid-stats" aria-label="Class summary">
        <StatCard
          icon={Users}
          tone="primary"
          label="Completed assessments"
          value={isLoading ? '—' : completedCount}
          hint={`of ${totalAssessments} assigned`}
        />
        <StatCard
          icon={Gauge}
          tone="accent"
          label="Class average"
          value={isLoading || classAverage == null ? '—' : `${classAverage}%`}
          hint="Across comprehension skills"
        />
        <StatCard
          icon={LifeBuoy}
          tone="error"
          label="May need support"
          value={isLoading ? '—' : needHelpRows.length}
          hint="Flagged by AI analysis"
        />
        <StatCard
          icon={ClipboardList}
          tone="success"
          label="Batches"
          value={isLoading ? '—' : batches.length}
          hint="Scheduled for this class"
        />
      </section>

      <section className="grid-2">
        <Card>
          <Card.Header
            title="Comprehension by skill"
            subtitle="Class average across the reading-comprehension skills"
          />
          <Card.Body>
            {skillChartData.length > 0 ? (
              <ChartReveal height={skillChartData.length * 46}>
                <SkillBarChart data={skillChartData} />
              </ChartReveal>
            ) : (
              <EmptyState
                title={isLoading ? 'Loading…' : 'No results yet'}
                message={
                  isLoading
                    ? ''
                    : 'Skill averages appear once a batch has graded submissions.'
                }
              />
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            title="Proficiency mix"
            subtitle="Where learners sit right now"
          />
          <Card.Body>
            {proficiencyData.length > 0 ? (
              <ChartReveal height={200}>
                <ProficiencyDonut data={proficiencyData} />
              </ChartReveal>
            ) : (
              <EmptyState
                title={isLoading ? 'Loading…' : 'No learners yet'}
                message={
                  isLoading
                    ? ''
                    : 'The proficiency mix appears once this classroom has learners and graded results.'
                }
              />
            )}
          </Card.Body>
        </Card>
      </section>

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
          {needHelpRows.length > 0 ? (
            <ul className="row-list">
              {needHelpRows.map((student) => (
                <li key={student.id} className="support-row">
                  <Link
                    to={`/students/${student.id}`}
                    className="support-row__link"
                  >
                    <Avatar name={student.name} size="sm" />
                    <span className="support-row__meta">
                      <span className="support-row__name">{student.name}</span>
                      <span className="support-row__code">
                        {student.comprehension_score != null
                          ? `${Math.round(Number(student.comprehension_score))}%`
                          : '—'}
                      </span>
                    </span>
                    <ProficiencyBadge
                      level={diagnosisToLevel(student.diagnosis)}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={isLoading ? 'Loading…' : 'Everyone on track'}
              message={
                isLoading
                  ? ''
                  : 'No learners are currently flagged for support in the latest batch.'
              }
            />
          )}
        </Card.Body>
      </Card>

      {error ? (
        <Card>
          <EmptyState
            title="Couldn’t load the dashboard"
            message="There was a problem reaching the server. Try again shortly."
          />
        </Card>
      ) : null}
    </div>
  )
}
