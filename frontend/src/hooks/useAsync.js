import { useCallback, useEffect, useState } from 'react'

/**
 * useAsync — run an async function and track its state.
 * Standardizes the loading / error / data triad every page needs when reading
 * from the repository.
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

  const run = useCallback(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve()
      .then(fn)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(run, [run])

  const reload = useCallback(() => {
    run()
  }, [run])

  return { ...state, reload }
}
