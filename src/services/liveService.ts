import type { Match } from '../types/match'
import { sameTeamName } from '../lib/team'

// Canlı skor katmanı: kendi backend'imizin /api/live adresi (ESPN, kota yok) 30 saniyede bir okunur ve
// API-Football'dan gelen maçların skor/dakika/durumu bunun üstüne yazılır. API-Football listesi ise
// kotayı korumak için seyrek yenilenir (src/hooks/useMatches.ts).

export interface LiveGoal {
  minute: string
  player: string
  side: 'home' | 'away'
  penalty: boolean
  ownGoal: boolean
}

export interface LiveEvent {
  id: string
  start: string
  state: 'pre' | 'in' | 'post'
  completed: boolean
  status: string
  clock: string | null
  home: { name: string; score: number | null }
  away: { name: string; score: number | null }
  goals: LiveGoal[]
}

const TTL = 25_000
let memory: { at: number; promise: Promise<LiveEvent[]> } | null = null

export function getLiveEvents(): Promise<LiveEvent[]> {
  if (memory && Date.now() - memory.at < TTL) return memory.promise
  const promise = fetch('/api/live')
    .then(async (res) => {
      if (!res.ok) throw new Error(`Canlı skor alınamadı (HTTP ${res.status}).`)
      return ((await res.json()) as { events: LiveEvent[] }).events
    })
    .catch(() => {
      memory = null // hata saklanmaz; bir sonraki turda tekrar denenir
      return [] as LiveEvent[]
    })
  memory = { at: Date.now(), promise }
  return promise
}

// Aynı maç mı: başlama saati 30 dakikadan yakın ve iki takımın adı tutuyor (ESPN ev/deplasmanı ters
// yazabilir). Birden fazla aday çıkarsa hiçbiri seçilmez: yanlış maça skor yazmaktansa beklemek iyi.
export function findLiveEvent(match: Match, events: LiveEvent[]): { event: LiveEvent; swapped: boolean } | null {
  const start = Date.parse(match.startTime)
  const found: { event: LiveEvent; swapped: boolean }[] = []
  for (const event of events) {
    if (Math.abs(Date.parse(event.start) - start) > 30 * 60_000) continue
    if (sameTeamName(match.homeTeam, event.home.name) && sameTeamName(match.awayTeam, event.away.name)) found.push({ event, swapped: false })
    else if (sameTeamName(match.homeTeam, event.away.name) && sameTeamName(match.awayTeam, event.home.name)) found.push({ event, swapped: true })
  }
  return found.length === 1 ? found[0] : null
}

// "67'" / "90'+3'" -> dakika ve etiket
function liveLabel(event: LiveEvent): { minute: number | null; statusLabel?: string } {
  if (event.status === 'STATUS_HALFTIME') return { minute: null, statusLabel: 'İY' }
  const clock = event.clock ?? ''
  const minute = Number.parseInt(clock, 10)
  if (!Number.isFinite(minute)) return { minute: null, statusLabel: 'Canlı' }
  return { minute, statusLabel: clock.replace(/'\+/, '+').trim() || `${minute}'` }
}

// Maçın skor/dakika/durumunu canlı veriyle güncelle. Bilgi yoksa ya da kesin değilse maç aynen kalır.
export function applyLive(match: Match, events: LiveEvent[]): Match {
  if (match.sport !== 'football' || match.status === 'finished') return match
  const found = findLiveEvent(match, events)
  if (!found) return match
  const { event, swapped } = found
  const home = swapped ? event.away : event.home
  const away = swapped ? event.home : event.away
  if (event.state === 'in') {
    return { ...match, status: 'live', homeScore: home.score, awayScore: away.score, ...liveLabel(event) }
  }
  if (event.state === 'post' && event.completed) {
    return { ...match, status: 'finished', homeScore: home.score, awayScore: away.score, minute: null, statusLabel: undefined }
  }
  return match
}

// Canlı veriye göre iki takımın toplam golü (maç sayfasında "gol oldu mu" kontrolü için)
export function liveGoalCount(match: Match, events: LiveEvent[]): number | null {
  const found = findLiveEvent(match, events)
  if (!found || found.event.state === 'pre') return null
  const { home, away } = found.event
  return home.score === null || away.score === null ? null : home.score + away.score
}
