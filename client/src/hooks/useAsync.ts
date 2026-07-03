import { useState, useEffect, useCallback, useRef } from 'react'

interface AsyncState<T> {
  loading: boolean
  data: T | null
  error: string | null
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = []
): AsyncState<T> & { refresh: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ loading: true, data: null, error: null })
  const mountedRef = useRef(true)
  const refreshRef = useRef(0)

  const execute = useCallback(() => {
    setState({ loading: true, data: null, error: null })
    fn()
      .then(data => {
        if (mountedRef.current) setState({ loading: false, data, error: null })
      })
      .catch(err => {
        if (mountedRef.current) setState({ loading: false, data: null, error: err?.message || 'An unexpected error occurred' })
      })
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    execute()
    return () => { mountedRef.current = false }
  }, [execute])

  const refresh = useCallback(() => {
    refreshRef.current++
    execute()
  }, [execute])

  return { ...state, refresh }
}
