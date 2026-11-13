import { useEffect, useRef, useState } from 'react'
import type { Match } from '../types/match'
import { fetchMatches, registerMatches } from '../services/matchService'
import { LIVE_SPORTS, applyLive, getLiveEvents } from '../services/liveService'
import { isSameDay } from '../lib/date'

// Bugünün listesi: skor ve dakika 30 saniyede bir canlı katmandan (ESPN, kota yok; futbol, basketbol,
// hokey, beyzbol, Amerikan futbolu, MMA); API listesi kotayı korumak için 10 dakikada bir yenilenir
// (canlı katmanın bilmediği küçük liglerin skorları da o zaman güncellenir). Canlı katmanı olmayan
// sporlarda (tenis, F1, voleybol...) canlı maç varken liste 2 dakikada bir yenilenir.
const LIVE_POLL_MS = 30_000
const LIST_REFRESH_MS = 10 * 60_000

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
  // API'den gelen ham liste: canlı katman her turda bunun üstüne uygulanır
  const base = useRef<Match[]>([])

  useEffect(() => {
    hasLive.current = result?.matches.some((m) => m.status === 'live') ?? false
  }, [result])

  useEffect(() => {
    let cancelled = false
    const key = `${sport}|${dayKey}`
    const day = new Date(dayKey)

    // Gün geçince (gece yarısı) "bugün" değişir: her seferinde yeniden bakılır
    const isToday = () => isSameDay(day, new Date())
    const withLive = async (matches: Match[]) => {
      if (!LIVE_SPORTS.has(sport) || (!isToday() && !matches.some((m) => m.status === 'live'))) return matches
      const live = await getLiveEvents(sport)
      const updated = matches.map((m) => applyLive(m, live))
      // Maç sayfasının başlığı da güncel skoru görsün
      registerMatches(updated)
      return updated
    }

    const load = (force: boolean) =>
      fetchMatches(sport, day, { force })
        .then(async (matches) => {
          base.current = matches
          const shown = await withLive(matches)
          if (!cancelled) setResult({ key, matches: shown, error: null })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          const message = err instanceof Error ? err.message : 'Maçlar yüklenemedi.'
          // Keep the last good list on a failed refresh; only show the error if there is nothing to show.
          setResult((prev) => (prev?.key === key && prev.matches.length > 0 ? prev : { key, matches: [], error: message }))
        })

    load(false)

    // Bugünün maçları ve (gece yarısını geçen) hâlâ canlı maçı olan günler değişir; sekme görünürken yenile
    let lastListRefresh = Date.now()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (!isToday() && !hasLive.current) return
      if (Date.now() - lastListRefresh >= LIST_REFRESH_MS) {
        lastListRefresh = Date.now()
        load(true)
        return
      }
      // Canlı katman (ESPN, EuroLeague): bu sporlarda 30 sn'de bir. Canlı katmanın bilmediği ligler (BSL,
      // küçük futbol ligleri, voleybol...) için canlı maç varken liste de 2 dk'da bir istenir; sunucu listeyi kalan
      // kotaya göre 3-15 dk saklar (api/proxy.ts), yani bu istekler çoğunlukla önbellekten gelir.
      if (hasLive.current && Date.now() - lastListRefresh >= 2 * 60_000) {
        lastListRefresh = Date.now()
        load(true)
      } else if (LIVE_SPORTS.has(sport)) {
        withLive(base.current).then((shown) => {
          if (!cancelled) setResult({ key, matches: shown, error: null })
        })
      }
    }, LIVE_POLL_MS)

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
