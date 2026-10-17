// Canlı skor katmanı (Vercel fonksiyonu): GET /api/live
// API-Football'un ücretsiz planı günde 100 istek; canlı maçı dakikada bir yenilemek bunu bitirir.
// ESPN'in bütün futbol maçlarını veren listesi anahtar/kota istemiyor: buradan sadece skor, dakika ve
// golleri sadeleştirip 30 saniye saklıyoruz. Site bunu API-Football listesinin üstüne uygular.

import { cacheGet, cacheSet, type Env } from './_lib/cache.js'

const TTL = 30

interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score?: string
  team: { id: string; displayName: string }
}

interface EspnDetail {
  scoringPlay?: boolean
  penaltyKick?: boolean
  ownGoal?: boolean
  shootout?: boolean
  clock?: { displayValue?: string }
  team?: { id: string }
  athletesInvolved?: { displayName: string }[]
}

interface EspnEvent {
  id: string
  date: string
  status: { displayClock?: string; type: { name: string; state: 'pre' | 'in' | 'post'; completed: boolean } }
  competitions: { competitors: EspnCompetitor[]; details?: EspnDetail[] }[]
}

// Sitenin kullandığı sade biçim
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
  /** ESPN durum adı: STATUS_HALFTIME, STATUS_POSTPONED... */
  status: string
  clock: string | null
  home: { name: string; score: number | null }
  away: { name: string; score: number | null }
  goals: LiveGoal[]
}

function slim(e: EspnEvent): LiveEvent | null {
  const comp = e.competitions[0]
  const home = comp?.competitors.find((c) => c.homeAway === 'home')
  const away = comp?.competitors.find((c) => c.homeAway === 'away')
  if (!home || !away) return null
  const score = (c: EspnCompetitor) => (e.status.type.state === 'pre' || c.score === undefined ? null : Number(c.score))
  const goals = (comp.details ?? [])
    .filter((d) => d.scoringPlay && !d.shootout)
    .map((d) => ({
      minute: d.clock?.displayValue ?? '',
      player: d.athletesInvolved?.[0]?.displayName ?? '',
      side: d.team?.id === home.team.id ? ('home' as const) : ('away' as const),
      penalty: Boolean(d.penaltyKick),
      ownGoal: Boolean(d.ownGoal),
    }))
  return {
    id: e.id,
    start: e.date,
    state: e.status.type.state,
    completed: e.status.type.completed,
    status: e.status.type.name,
    clock: e.status.displayClock ?? null,
    home: { name: home.team.displayName, score: score(home) },
    away: { name: away.team.displayName, score: score(away) },
    goals,
  }
}

const json = (status: number, body: unknown, ttl = 0) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': ttl > 0 ? `public, max-age=0, s-maxage=${ttl}` : 'no-store',
    },
  })

export async function handleLiveRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json(405, { message: 'Sadece GET desteklenir.' })
  // ESPN günleri ABD saatine göre böler: gece yarısını geçen maçlar kaçmasın diye dün + bugün (UTC)
  const now = Date.now()
  const days = [now - 24 * 60 * 60_000, now].map((t) => new Date(t).toISOString().slice(0, 10).replace(/-/g, ''))
  const key = `canliskor:live:v1:${days[1]}`
  const hit = await cacheGet(env, key)
  if (hit) return json(200, hit.body, Math.max(1, Math.ceil((hit.expiresAt - Date.now()) / 1000)))
  try {
    const lists = await Promise.all(
      days.map(async (d) => {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${d}&limit=1000`, {
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`)
        return ((await res.json()) as { events?: EspnEvent[] }).events ?? []
      }),
    )
    // İki günün listesi birleşir (site maçları başlama saatine göre eşleştirir)
    const byId = new Map<string, LiveEvent>()
    for (const e of lists.flat()) {
      const s = slim(e)
      if (s) byId.set(s.id, s)
    }
    const body = JSON.stringify({ events: [...byId.values()] })
    await cacheSet(env, key, body, TTL)
    return json(200, body, TTL)
  } catch (err) {
    console.error('Canlı skor alınamadı:', err)
    return json(502, { message: 'Canlı skor şu an alınamıyor.' })
  }
}

export function GET(request: Request) {
  return handleLiveRequest(request, process.env)
}
