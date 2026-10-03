import { useCallback, useEffect, useRef, useState } from "react"

/**
 * useAsync — run an async function and track its state.
 * Standardizes the loading / error / data triad every page needs when reading
 * from the repository.
 *
 * Fetches on mount and whenever `deps` change, and refetches on every remount
 * (so navigating away and back always reloads fresh data). The latest `fn` is
 * held in a ref so callers can pass an inline arrow without causing extra
 * fetches, while a monotonic request id guards against out-of-order / stale
 * resolutions (including React StrictMode''s double-invoke in development).
 *
 * @param {() => Promise<any>} fn       the async loader
 * @param {any[]} deps                  re-run when these change
 * @returns {{ data, loading, error, reload }}
 */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  })

  // Keep the newest loader without making it a reactive dependency, so an
  // inline () => repository.x() does not retrigger the effect every render.
  // Updated in an effect (never during render).
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })

  // Monotonic id: only the most recent in-flight request may commit state.
  const reqIdRef = useRef(0)

  const load = useCallback(() => {
    const myId = reqIdRef.current + 1
    reqIdRef.current = myId
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve()
      .then(() => fnRef.current())
      .then((data) => {
        if (reqIdRef.current === myId) {
          setState({ data, loading: false, error: null })
        }
      })
      .catch((error) => {
        if (reqIdRef.current === myId) {
          setState({ data: null, loading: false, error })
        }
      })
  }, [])

  // Fetch on mount and whenever deps change. Bumping the request id on cleanup
  // invalidates any in-flight request from this run so a stale resolution can
  // never overwrite fresh data.
  useEffect(() => {
    load()
    return () => {
      reqIdRef.current += 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const reload = useCallback(() => {
    load()
  }, [load])

  return { ...state, reload }
}