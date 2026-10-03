import { useCallback, useEffect, useMemo, useState } from 'react'
import { repository } from '@/services'
import { SessionContext } from './SessionContext'

// The HTTP repository reads this same key for its X-User-Id header, so keeping
// the id here keeps both auth models (local + http) in sync.
const USER_ID_KEY = 'anaread-user-id'

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore a persisted session on first load.
  useEffect(() => {
    const id = localStorage.getItem(USER_ID_KEY)
    if (!id) {
      setLoading(false)
      return
    }
    Promise.resolve(repository.getUser(id))
      .then((u) => setUser(u ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (credentials) => {
    const u = await repository.login(credentials)
    localStorage.setItem(USER_ID_KEY, u.id)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(USER_ID_KEY)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  )

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}
