import { useEffect, useRef, useState } from 'react'
import type { Match } from '../types/match'
import { fetchMatches } from '../services/matchService'
import { isSameDay } from '../lib/date'

// Refresh every 2 minutes while the tab is visible and a match is live: ~30 requests
// an hour, so the free plan's 100 requests/day cover roughly 3 hours of an open tab.
const POLL_MS = 120_000

interface Result {
  key: string
  matches: Match[]
  error: string | null
}

export function useMatches(sport: string, date: Date) {
  const dayKey = date.toDateString()
  const requestKey = `${sport}|${dayKey}`
  // Remember which request the stored result belongs to; loading is derived from that.
  const [result, setResult] = useState<Result | null>(null)
  const hasLive = useRef(false)

  useEffect(() => {
    hasLive.current = result?.matches.some((m) => m.status === 'live') ?? false
  }, [result])

  useEffect(() => {
    let cancelled = false
    const key = `${sport}|${dayKey}`
    const day = new Date(dayKey)

    const load = (force: boolean) =>
      fetchMatches(sport, day, { force })
        .then((matches) => {
          if (!cancelled) setResult({ key, matches, error: null })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          const message = err instanceof Error ? err.message : 'Maçlar yüklenemedi.'
          // Keep the last good list on a failed refresh; only show the error if there is nothing to show.
          setResult((prev) => (prev?.key === key && prev.matches.length > 0 ? prev : { key, matches: [], error: message }))
        })

    load(false)

    // Only today's live matches change; refresh them while the tab is visible.
    if (!isSameDay(day, new Date())) return () => void (cancelled = true)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && hasLive.current) load(true)
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [sport, dayKey])

  const loading = result?.key !== requestKey
  return {
    matches: loading ? [] : result.matches,
    error: loading ? null : result.error,
    loading,
  }
}
