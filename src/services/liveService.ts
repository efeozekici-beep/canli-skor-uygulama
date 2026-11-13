import type { Match } from '../types/match'
import { sameTeamName } from '../lib/team'

// Canlı skor katmanı: kendi backend'imizin /api/live adresi (ESPN, kota yok) 30 saniyede bir okunur ve
// API'den gelen maçların skor/dakika/durumu bunun üstüne yazılır. API listesi ise kotayı korumak için
// seyrek yenilenir (src/hooks/useMatches.ts). Futbol dışında: basketbol (NBA, NCAA), hokey (NHL),
// beyzbol (MLB), Amerikan futbolu (NFL, NCAA), MMA (UFC).

/** Canlı katmanı olan sporlar */
export const LIVE_SPORTS = new Set(['football', 'basketball', 'hockey', 'baseball', 'american-football', 'mma'])

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
  period?: number
  detail?: string
}

const TTL = 25_000
const memory = new Map<string, { at: number; promise: Promise<LiveEvent[]> }>()

export function getLiveEvents(sport = 'football'): Promise<LiveEvent[]> {
  const hit = memory.get(sport)
  if (hit && Date.now() - hit.at < TTL) return hit.promise
  const promise = fetch(sport === 'football' ? '/api/live' : `/api/live?sport=${encodeURIComponent(sport)}`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Canlı skor alınamadı (HTTP ${res.status}).`)
      return ((await res.json()) as { events: LiveEvent[] }).events
    })
    .catch(() => {
      memory.delete(sport) // hata saklanmaz; bir sonraki turda tekrar denenir
      return [] as LiveEvent[]
    })
  memory.set(sport, { at: Date.now(), promise })
  return promise
}

// Aynı maç mı: başlama saati 30 dakikadan yakın ve iki takımın adı tutuyor (ESPN ev/deplasmanı ters
// yazabilir). Birden fazla aday çıkarsa hiçbiri seçilmez: yanlış maça skor yazmaktansa beklemek iyi.
export function findLiveEvent(match: Match, events: LiveEvent[]): { event: LiveEvent; swapped: boolean } | null {
  const start = Date.parse(match.startTime)
  // MMA'da API bütün kartın başlama saatini veriyor, ESPN her dövüşün saatini: aynı gün yeterli
  const window = match.sport === 'mma' ? 12 * 60 * 60_000 : 30 * 60_000
  const found: { event: LiveEvent; swapped: boolean }[] = []
  for (const event of events) {
    if (Math.abs(Date.parse(event.start) - start) > window) continue
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

// Futbol dışı sporlarda canlı durum etiketi: periyot / çeyrek / inning / raunt
function otherLabel(sport: string, event: LiveEvent): string {
  const p = event.period ?? 0
  const between = event.status === 'STATUS_END_PERIOD' || event.status === 'STATUS_HALFTIME'
  if (event.status === 'STATUS_HALFTIME') return 'Devre arası'
  if (sport === 'hockey') return between ? 'Ara' : p > 3 ? 'Uzatma' : `${p}. Periyot`
  if (sport === 'baseball') return p > 0 ? `${p}. İnning` : 'Canlı'
  if (sport === 'american-football') return between ? 'Çeyrek arası' : p > 4 ? 'Uzatma' : `${p}. Çeyrek`
  if (sport === 'mma') return p > 0 ? `${p}. Raunt` : 'Canlı'
  return 'Canlı'
}

function applyOther(match: Match, event: LiveEvent, home: LiveEvent['home'], away: LiveEvent['away']): Match {
  // MMA'da skor yok: sadece durum
  const scores = match.sport === 'mma' ? {} : { homeScore: home.score, awayScore: away.score }
  if (event.state === 'post' && event.completed) return { ...match, ...scores, status: 'finished', minute: null, statusLabel: undefined }
  if (match.sport === 'basketball') {
    const p = event.period ?? null
    const between = event.status === 'STATUS_HALFTIME' || event.status === 'STATUS_END_PERIOD'
    const label = event.status === 'STATUS_HALFTIME' ? 'Devre arası' : between ? 'Çeyrek arası' : undefined
    const extras = match.basketball ?? { periods: [], period: null, clock: null, season: '' }
    // Kolej basketbolu iki yarı oynanır: çeyrek yerine "2. Yarı 05:42"
    if (/ncaa/i.test(match.leagueName) && !between && p !== null) {
      const half = p > 2 ? 'Uzatma' : `${p}. Yarı`
      return { ...match, ...scores, status: 'live', minute: null, statusLabel: event.clock ? `${half} ${event.clock}` : half, basketball: { ...extras, period: null, clock: null } }
    }
    return {
      ...match,
      ...scores,
      status: 'live',
      minute: null,
      statusLabel: label ?? 'Canlı',
      basketball: { ...extras, period: between ? null : p, clock: between ? null : event.clock },
    }
  }
  return { ...match, ...scores, status: 'live', minute: null, statusLabel: otherLabel(match.sport, event) }
}

// Maçın skor/dakika/durumunu canlı veriyle güncelle. Bilgi yoksa ya da kesin değilse maç aynen kalır.
export function applyLive(match: Match, events: LiveEvent[]): Match {
  if (!LIVE_SPORTS.has(match.sport) || match.status === 'finished') return match
  const found = findLiveEvent(match, events)
  if (!found) return match
  const { event, swapped } = found
  const home = swapped ? event.away : event.home
  const away = swapped ? event.home : event.away
  if (match.sport !== 'football') return event.state === 'pre' ? match : applyOther(match, event, home, away)
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
