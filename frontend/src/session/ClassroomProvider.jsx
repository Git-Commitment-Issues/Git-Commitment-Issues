import { useCallback, useEffect, useMemo, useState } from 'react'
import { repository } from '@/services'
import { useSession } from './useSession'
import { ClassroomContext } from './ClassroomContext'

const ACTIVE_KEY = 'anaread-active-classroom'

/**
 * Loads the signed-in teacher's classrooms and tracks which one is active.
 * Mounted inside the teacher portal so every teacher page shares the selection.
 */
export function ClassroomProvider({ children }) {
  const { user } = useSession()
  const [classrooms, setClassrooms] = useState([])
  const [activeId, setActiveId] = useState(
    () => localStorage.getItem(ACTIVE_KEY) || null,
  )
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    if (!user) return
    setLoading(true)
    Promise.resolve(repository.listClassrooms(user.id))
      .then((list) => setClassrooms(list ?? []))
      .catch(() => setClassrooms([]))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  // Keep the active id valid: default to the first classroom if none chosen.
  useEffect(() => {
    if (loading) return
    const stillExists = classrooms.some((c) => c.id === activeId)
    if (!stillExists) {
      const next = classrooms[0]?.id ?? null
      setActiveId(next)
      if (next) localStorage.setItem(ACTIVE_KEY, next)
      else localStorage.removeItem(ACTIVE_KEY)
    }
  }, [classrooms, activeId, loading])

  const selectClassroom = useCallback((id) => {
    setActiveId(id)
    if (id) localStorage.setItem(ACTIVE_KEY, id)
  }, [])

  const createClassroom = useCallback(
    async (name) => {
      const classroom = await repository.createClassroom({
        name,
        teacher_id: user.id,
      })
      setClassrooms((prev) => [...prev, classroom])
      selectClassroom(classroom.id)
      return classroom
    },
    [user, selectClassroom],
  )

  const activeClassroom =
    classrooms.find((c) => c.id === activeId) ?? null

  const value = useMemo(
    () => ({
      classrooms,
      activeClassroom,
      loading,
      selectClassroom,
      createClassroom,
      reload,
    }),
    [classrooms, activeClassroom, loading, selectClassroom, createClassroom, reload],
  )

  return (
    <ClassroomContext.Provider value={value}>
      {children}
    </ClassroomContext.Provider>
  )
}
