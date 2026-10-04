import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { Mascot } from '@/components/brand/Mascot'
import { useSession } from '@/session/useSession'
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
  const { t } = useTranslation()
  const { user } = useSession()
  const { activeClassroom, loading: classroomLoading } = useClassroom()
  const classroomId = activeClassroom?.id ?? null
  // Greet with the full name. Picking the first whitespace token breaks on
  // names that lead with an honorific (e.g. "Ms. Reyes" -> "Ms."), so use the
  // whole display name instead.
  const displayName = (user?.name ?? '').trim()

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
    label: t(`skills.${s.skill}`, skillLabel(s.skill)),
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
          { name: t('dashboard.onTrack'), value: onTrackCount, tone: 'success' },
          {
            name: t('dashboard.comprehensionBarrier'),
            value: barrierCount,
            tone: 'primary',
          },
          {
            name: t('dashboard.highestPriority'),
            value: priorityCount,
            tone: 'error',
          },
        ].filter((d) => d.value > 0)
      : []

  const isLoading = classroomLoading || loading

  return (
    <div className="stack">
      {/* Welcome banner — the pahina dragon greets the teacher, using the
          empty space on the right of the heading. */}
      <Card raised className="dashboard__welcome">
        <div className="dashboard__welcome-text">
          <p className="dashboard__welcome-eyebrow">{t('dashboard.welcomeEyebrow')}</p>
          <h2 className="dashboard__welcome-title">
            {displayName
              ? t('dashboard.welcomeHi', { name: displayName })
              : t('dashboard.welcomeHiThere')}
          </h2>
          <p className="dashboard__welcome-sub">{t('dashboard.welcomeSub')}</p>
        </div>
        <Mascot variant="welcome" size="md" float className="dashboard__welcome-mascot" />
      </Card>

      <PageHeader
        eyebrow={activeClassroom?.name ?? t('dashboard.classOverview')}
        title={t('dashboard.classOverview')}
        subtitle={t('dashboard.classOverviewSub')}
        actions={
          <Button icon={ClipboardList} variant="primary">
            <Link to="/assessments/new">{t('dashboard.newAssessment')}</Link>
          </Button>
        }
      />

      {!classroomId && !classroomLoading ? (
        <Card>
          <EmptyState
            title={t('dashboard.noClassroom')}
            message={t('dashboard.noClassroomSub')}
          />
        </Card>
      ) : null}

      <section className="grid-stats" aria-label={t('dashboard.classOverview')}>
        <StatCard
          icon={Users}
          tone="primary"
          label={t('dashboard.completedAssessments')}
          value={isLoading ? '—' : completedCount}
          hint={t('dashboard.ofAssigned', { count: totalAssessments })}
        />
        <StatCard
          icon={Gauge}
          tone="accent"
          label={t('dashboard.classAverage')}
          value={isLoading || classAverage == null ? '—' : `${classAverage}%`}
          hint={t('dashboard.acrossSkills')}
        />
        <StatCard
          icon={LifeBuoy}
          tone="error"
          label={t('dashboard.mayNeedSupport')}
          value={isLoading ? '—' : needHelpRows.length}
          hint={t('dashboard.flaggedByAi')}
        />
        <StatCard
          icon={ClipboardList}
          tone="success"
          label={t('dashboard.batches')}
          value={isLoading ? '—' : batches.length}
          hint={t('dashboard.scheduledForClass')}
        />
      </section>

      <section className="grid-2">
        <Card>
          <Card.Header
            title={t('dashboard.comprehensionBySkill')}
            subtitle={t('dashboard.comprehensionBySkillSub')}
          />
          <Card.Body>
            {skillChartData.length > 0 ? (
              <ChartReveal height={skillChartData.length * 46}>
                <SkillBarChart data={skillChartData} />
              </ChartReveal>
            ) : (
              <EmptyState
                title={isLoading ? t('common.loading') : t('dashboard.noResultsYet')}
                message={isLoading ? '' : t('dashboard.noResultsSkill')}
              />
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header
            title={t('dashboard.proficiencyMix')}
            subtitle={t('dashboard.proficiencyMixSub')}
          />
          <Card.Body>
            {proficiencyData.length > 0 ? (
              <ChartReveal height={200}>
                <ProficiencyDonut data={proficiencyData} />
              </ChartReveal>
            ) : (
              <EmptyState
                title={isLoading ? t('common.loading') : t('dashboard.noLearnersYet')}
                message={isLoading ? '' : t('dashboard.noLearnersMix')}
              />
            )}
          </Card.Body>
        </Card>
      </section>

      <Card>
        <Card.Header
          title={t('dashboard.needsCloserLook')}
          subtitle={t('dashboard.lowestComprehension')}
          action={
            <Link to="/students" className="text-link">
              {t('common.allStudents')}
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
              title={isLoading ? t('common.loading') : t('dashboard.everyoneOnTrack')}
              message={isLoading ? '' : t('dashboard.everyoneOnTrackSub')}
            />
          )}
        </Card.Body>
      </Card>

      {error ? (
        <Card>
          <EmptyState
            title={t('dashboard.loadError')}
            message={t('dashboard.loadErrorSub')}
          />
        </Card>
      ) : null}
    </div>
  )
}
