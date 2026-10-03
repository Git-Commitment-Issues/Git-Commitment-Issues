import { createContext } from "react"

/**
 * Classroom context shape (teacher portal):
 *   classrooms: ClassroomOut[]        — the teacher's classrooms
 *   activeClassroom: ClassroomOut|null — the currently selected classroom
 *   loading: boolean
 *   selectClassroom: (id) => void
 *   createClassroom: (name) => Promise<ClassroomOut>
 *   reload: () => void
 */
export const ClassroomContext = createContext({
  classrooms: [],
  activeClassroom: null,
  loading: true,
  selectClassroom: () => {},
  createClassroom: async () => {},
  reload: () => {},
})