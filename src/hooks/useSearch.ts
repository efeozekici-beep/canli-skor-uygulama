import { useEffect, useState } from 'react'
import type { SearchResults } from '../types/search'
import { peekSearch, searchAll } from '../services/searchService'

export const MIN_QUERY = 3
const DEBOUNCE_MS = 500

type State = { query: string; results: SearchResults | null; error: boolean }

// Yazmayı bırakınca (500 ms) tek arama yapar; yeni metin gelirse eski isteği iptal eder.
// Önbellekte olan metin beklemeden gösterilir.
export function useSearch(query: string) {
  const q = query.trim()
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    if (q.length < MIN_QUERY || peekSearch(q)) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchAll(q, controller.signal)
        .then((results) => setState({ query: q, results, error: false }))
        .catch((err: unknown) => {
          // İptal edilen istek hata sayılmaz
          if (err instanceof DOMException && err.name === 'AbortError') return
          setState({ query: q, results: null, error: true })
        })
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [q])

  if (q.length < MIN_QUERY) return { status: 'idle' as const, results: null }
  const cached = peekSearch(q)
  if (cached) return { status: 'done' as const, results: cached }
  if (state?.query !== q) return { status: 'loading' as const, results: null }
  if (state.error) return { status: 'error' as const, results: null }
  return { status: 'done' as const, results: state.results }
}
