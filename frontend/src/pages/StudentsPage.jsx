import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Search, UserPlus, ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/layout"
import { Button, Card, Input, Avatar, EmptyState } from "@/components/ui"
import { Mascot } from "@/components/brand/Mascot"
import { useClassroom } from "@/session/useClassroom"
import { useAsync } from "@/hooks/useAsync"
import { repository } from "@/services"
import "./StudentsPage.css"

/**
 * StudentsPage — the class roster for the active classroom, loaded from the
 * backend. Rows link to the individual report view. The table layout and
 * styling are unchanged; only the data source moved from mock data to the API.
 * The roster endpoint returns identity fields (name + LRN + active flag); the
 * per-skill "focus" column from the mock design has no backend source yet, so
 * the roster shows the fields the API actually provides.
 */
export function StudentsPage() {
  const { t } = useTranslation()
  const { activeClassroom, loading: classroomLoading } = useClassroom()
  const classroomId = activeClassroom?.id ?? null
  const [filter, setFilter] = useState("")

  const { data, loading } = useAsync(() => {
    if (!classroomId) return Promise.resolve([])
    return repository.listStudents(classroomId)
  }, [classroomId])

  const students = useMemo(() => {
    const list = data ?? []
    const q = filter.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.learner_reference_number ?? "").toLowerCase().includes(q),
    )
  }, [data, filter])

  const isLoading = classroomLoading || loading

  return (
    <div className="stack">
      <PageHeader
        eyebrow={activeClassroom?.name ?? t("students.rosterFallback")}
        title={t("students.title")}
        subtitle={t("students.subtitle")}
        actions={
          <Button icon={UserPlus} variant="outline">
            {t("students.addStudent")}
          </Button>
        }
      />

      <Card padded={false}>
        <div className="students__toolbar">
          <Input
            icon={Search}
            placeholder={t("students.filterPlaceholder")}
            aria-label={t("students.filterLabel")}
            className="students__filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {isLoading ? (
          <EmptyState title={t("common.loading")} />
        ) : students.length === 0 ? (
          <div className="students__empty">
            <Mascot variant="reading" size="lg" />
            <h3 className="students__empty-title">
              {classroomId ? t("students.noStudents") : t("students.noClassroom")}
            </h3>
            <p className="students__empty-text">
              {classroomId
                ? t("students.noStudentsText")
                : t("students.noClassroomText")}
            </p>
          </div>
        ) : (
          <div
            className="students__table"
            role="table"
            aria-label={t("students.rosterLabel")}
          >
            <div className="students__head" role="row">
              <span role="columnheader">{t("students.colStudent")}</span>
              <span role="columnheader">{t("students.colLrn")}</span>
              <span role="columnheader" className="students__col-focus">
                {t("students.colStatus")}
              </span>
              <span role="columnheader" className="sr-only">
                {t("students.colView")}
              </span>
            </div>

            <ul className="row-list">
              {students.map((student) => (
                <li key={student.id} role="row">
                  <Link
                    to={`/students/${student.id}`}
                    className="students__row"
                  >
                    <span className="students__cell students__cell--student">
                      <Avatar name={student.name} size="sm" />
                      <span className="students__meta">
                        <span className="students__name">{student.name}</span>
                        <span className="students__code">
                          {student.learner_reference_number}
                        </span>
                      </span>
                    </span>

                    <span className="students__cell">
                      {student.learner_reference_number}
                    </span>

                    <span className="students__cell students__col-focus">
                      {student.is_active
                        ? t("students.active")
                        : t("students.inactive")}
                    </span>

                    <span className="students__cell students__cell--chevron">
                      <ChevronRight aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  )
}