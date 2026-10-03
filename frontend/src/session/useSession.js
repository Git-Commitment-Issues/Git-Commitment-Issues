import { useContext } from "react"
import { SessionContext } from "./SessionContext"

/** Access the current session (user + auth actions) from anywhere in the tree. */
export function useSession() {
  return useContext(SessionContext)
}