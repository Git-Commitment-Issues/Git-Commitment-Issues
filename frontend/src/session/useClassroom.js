import { useContext } from "react"
import { ClassroomContext } from "./ClassroomContext"

/** Access the active classroom selection and actions from the teacher portal. */
export function useClassroom() {
  return useContext(ClassroomContext)
}