import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
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
        eyebrow={activeClassroom?.name ?? "Roster"}
        title="Students"
        subtitle="Every learner in this class. Rows open the individual report with assessment history and progress."
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
            placeholder="Filter by name or LRN…"
            aria-label="Filter students"
            className="students__filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {isLoading ? (
          <EmptyState title="Loading…" />
        ) : students.length === 0 ? (
          <div className="students__empty">
            <Mascot variant="reading" size="lg" />
            <h3 className="students__empty-title">
              {classroomId ? "No students yet" : "No classroom selected"}
            </h3>
            <p className="students__empty-text">
              {classroomId
                ? "Add learners to this classroom to build the roster."
                : "Select or create a classroom to see its roster."}
            </p>
          </div>
        ) : (
          <div
            className="students__table"
            role="table"
            aria-label="Student roster"
          >
            <div className="students__head" role="row">
              <span role="columnheader">Student</span>
              <span role="columnheader">LRN</span>
              <span role="columnheader" className="students__col-focus">
                Status
              </span>
              <span role="columnheader" className="sr-only">
                View
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
                      {student.is_active ? "Active" : "Inactive"}
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