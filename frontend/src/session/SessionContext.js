import { createContext } from "react"

/**
 * Session context shape:
 *   user: UserOut | null              — the signed-in user (teacher or learner)
 *   loading: boolean                  — true while restoring a persisted session
 *   login: (credentials) => Promise   — resolve + persist a login
 *   logout: () => void                — clear the session
 */
export const SessionContext = createContext({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
})