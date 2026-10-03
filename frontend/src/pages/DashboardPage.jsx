import { Link } from "react-router-dom"
import {
  Users,
  Gauge,
  LifeBuoy,
  ClipboardList,
  ArrowUpRight,
} from "lucide-react"
import { PageHeader } from "@/components/layout"
import { Button, Card, Avatar, ProficiencyBadge, EmptyState } from "@/components/ui"
import { StatCard, SkillBar } from "@/components/data"
import { useClassroom } from "@/session/useClassroom"
import { useAsync } from "@/hooks/useAsync"
import { repository } from "@/services"
import { skillLabel, diagnosisToLevel } from "@/domain/constants"
import "./DashboardPage.css"

/**
 * DashboardPage — the teacher's class overview, backed by the dashboard API for
 * the active classroom. Surfaces who may be struggling (needs-help), which
 * comprehension skills are weakest (skills breakdown), and batch counts. The
 * layout and styling are unchanged from the original design; only the data
 * source moved from mock data to the backend.
 */
export function DashboardPage() {
  const { activeClassroom, loading: classroomLoading } = useClassroom()
  const classroomId = activeClassroom?.id ?? null

  const { data, loading, error } = useAsync(async () => {
    if (!classroomId) return null
    // Fetch the dashboard aggregates for the default (most recent completed)
    // batch in parallel. Each call tolerates "no completed batch yet" (404) by
    // resolving to an empty shape so the page renders instead of erroring.
    const empty = { rows: [] }
    const [needsHelp, skills, batches] = await Promise.all([
      repository.getNeedsHelp(classroomId).catch(() => empty),
      repository.getSkillsBreakdown(classroomId).catch(() => empty),
      repository.listBatches(classroomId).catch(() => []),
    ])
    return { needsHelp, skills, batches }
  }, [classroomId])

  const needHelpRows = data?.needsHelp?.rows ?? []
  const skillRows = data?.skills?.rows ?? []
  const batches = data?.batches ?? []

  // Headline metrics derived from the real aggregates.
  const completedCount = batches.reduce((sum, b) => sum + (b.completed ?? 0), 0)
  const totalAssessments = batches.reduce((sum, b) => sum + (b.total ?? 0), 0)
  const classAverage =
    skillRows.length > 0
      ? Math.round(
          skillRows.reduce((sum, s) => sum + (s.avg_score ?? 0), 0) /
            skillRows.length,
        )
      : null

  const isLoading = classroomLoading || loading

  return (
    <div className="stack">
      <PageHeader
        eyebrow={activeClassroom?.name ?? "Class overview"}
        title="Class overview"
        subtitle="A focused read on how your class is comprehending — and who may need a closer look this week."
        actions={
          <Button icon={ClipboardList} variant="primary">
            New assessment
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
          value={isLoading ? "—" : completedCount}
          hint={`of ${totalAssessments} assigned`}
        />
        <StatCard
          icon={Gauge}
          tone="accent"
          label="Class average"
          value={isLoading || classAverage == null ? "—" : `${classAverage}%`}
          hint="Across comprehension skills"
        />
        <StatCard
          icon={LifeBuoy}
          tone="error"
          label="May need support"
          value={isLoading ? "—" : needHelpRows.length}
          hint="Flagged by AI analysis"
        />
        <StatCard
          icon={ClipboardList}
          tone="success"
          label="Batches"
          value={isLoading ? "—" : batches.length}
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
            <div className="dashboard__skills">
              {skillRows.length > 0 ? (
                skillRows.map((skill) => (
                  <SkillBar
                    key={skill.skill}
                    label={skillLabel(skill.skill)}
                    score={Math.round(skill.avg_score ?? 0)}
                  />
                ))
              ) : (
                <EmptyState
                  title={isLoading ? "Loading…" : "No results yet"}
                  message={
                    isLoading
                      ? ""
                      : "Skill averages appear once a batch has graded submissions."
                  }
                />
              )}
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
                        <span className="support-row__name">
                          {student.name}
                        </span>
                        <span className="support-row__code">
                          {student.comprehension_score != null
                            ? `${Math.round(student.comprehension_score)}%`
                            : "—"}
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
                title={isLoading ? "Loading…" : "Everyone on track"}
                message={
                  isLoading
                    ? ""
                    : "No learners are currently flagged for support in the latest batch."
                }
              />
            )}
          </Card.Body>
        </Card>
      </section>

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