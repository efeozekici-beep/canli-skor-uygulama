// Canlı skor katmanı (Vercel fonksiyonu): GET /api/live  (futbol)  ve  GET /api/live?sport=basketball|hockey|...
// Diğer sporlarda ESPN'in kapsadığı ligler: basketbol NBA + NCAA, hokey NHL, beyzbol MLB, Amerikan futbolu
// NFL + NCAA, MMA UFC. Periyot / çeyrek / inning bilgisi "period" ve "detail" alanlarında.
// API-Football'un ücretsiz planı günde 100 istek; canlı maçı dakikada bir yenilemek bunu bitirir.
// ESPN'in bütün futbol maçlarını veren listesi anahtar/kota istemiyor: buradan sadece skor, dakika ve
// golleri sadeleştirip 30 saniye saklıyoruz. Site bunu API-Football listesinin üstüne uygular.

import { cacheGet, cacheSet, type Env } from './_lib/cache.js'
import { getJson } from './_lib/http.js'
import { elSeason, elSeasonGames } from './day.js'

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
  status: { displayClock?: string; period?: number; type: { name: string; state: 'pre' | 'in' | 'post'; completed: boolean; shortDetail?: string } }
  competitions: { date?: string; competitors: EspnCompetitor[]; details?: EspnDetail[] }[]
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
  /** Futbol dışı: çeyrek / periyot / inning / raunt numarası */
  period?: number
  /** ESPN'in kısa durum metni ("Top 7th", "Q3 5:42") */
  detail?: string
}

// ESPN'de MMA dövüşçülerinin "team" alanı yok, "athlete" var; ev / deplasman yerine sıra (order) kullanılır
type AnyCompetitor = Omit<EspnCompetitor, 'team' | 'homeAway'> & {
  homeAway?: 'home' | 'away'
  order?: number
  team?: { id: string; displayName: string }
  athlete?: { displayName: string }
}

function slimComp(e: EspnEvent, comp: EspnEvent['competitions'][number], id: string, sport: string): LiveEvent | null {
  const list = comp.competitors as AnyCompetitor[]
  const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const home = list.find((c) => c.homeAway === 'home') ?? sorted[0]
  const away = list.find((c) => c.homeAway === 'away') ?? sorted[1]
  const name = (c: AnyCompetitor) => c.team?.displayName ?? c.athlete?.displayName ?? ''
  if (!home || !away) return null
  const status = (comp as { status?: EspnEvent['status'] }).status ?? e.status
  const score = (c: AnyCompetitor) => (status.type.state === 'pre' || c.score === undefined || sport === 'mma' ? null : Number(c.score))
  return {
    id,
    start: comp.date ?? e.date,
    state: status.type.state,
    completed: status.type.completed,
    status: status.type.name,
    clock: status.displayClock ?? null,
    home: { name: name(home), score: score(home) },
    away: { name: name(away), score: score(away) },
    goals: [],
    period: status.period,
    detail: status.type.shortDetail,
  }
}

// Futbol dışı sporların ESPN listeleri
const SPORT_PATHS: Record<string, string[]> = {
  basketball: ['basketball/nba', 'basketball/mens-college-basketball'],
  hockey: ['hockey/nhl'],
  baseball: ['baseball/mlb'],
  'american-football': ['football/nfl', 'football/college-football'],
  mma: ['mma/ufc'],
}

// ---------- EuroLeague / EuroCup (resmi canlı servis, anahtarsız) ----------
// Sezon listesinden şu an oynanıyor olabilecek (başlamış, 4 saatten eski olmayan) maçlar seçilir; her biri için
// live.euroleague.net'in maç başlığı istenir: skor, canlı mı, çeyrek, çeyrekte kalan süre.
interface ElHeader {
  Live: boolean
  ScoreA: string
  ScoreB: string
  Quarter: string
  GameTime: string
  RemainingPartialTime: string
}

// EuroLeague saatleri bazen "Z" ile, bazen onsuz (UTC) gelir
const elUtc = (iso: string) => (iso.endsWith('Z') ? iso : `${iso}Z`)

async function euroleagueLive(env: Env): Promise<LiveEvent[]> {
  const now = Date.now()
  const lists = await Promise.all(
    (['E', 'U'] as const).map(async (comp) => {
      const games = (await elSeasonGames(env, comp).catch(() => [])).filter((g) => {
        const start = Date.parse(elUtc(g.utcDate))
        return start <= now + 10 * 60_000 && start >= now - 4 * 60 * 60_000
      })
      return Promise.all(
        games.map(async (g): Promise<LiveEvent | null> => {
          const code = g.identifier.split('_')[1]
          const h = await getJson<ElHeader>(`https://live.euroleague.net/api/Header?gamecode=${code}&seasoncode=${comp}${elSeason()}`).catch(() => null)
          if (!h) return null
          const home = Number(h.ScoreA)
          const away = Number(h.ScoreB)
          const minutes = Number.parseInt(h.GameTime, 10) || 0
          const finished = !h.Live && (g.played || minutes >= 40)
          const state = h.Live ? 'in' : finished ? 'post' : 'pre'
          // Çeyrek: "Q3" / "3" gibi gelir; yoksa geçen süreden (çeyrek 10 dk)
          const period = Number(/\d+/.exec(h.Quarter ?? '')?.[0]) || Math.min(5, Math.floor(minutes / 10) + 1)
          const remaining = h.RemainingPartialTime?.trim() || null
          const between = h.Live && remaining === '00:00'
          return {
            id: `el-${g.identifier}`,
            start: elUtc(g.utcDate),
            state,
            completed: state === 'post',
            status: between ? (period === 2 ? 'STATUS_HALFTIME' : 'STATUS_END_PERIOD') : state === 'in' ? 'STATUS_IN_PROGRESS' : state === 'post' ? 'STATUS_FINAL' : 'STATUS_SCHEDULED',
            clock: remaining,
            home: { name: g.local.club.name, score: state === 'pre' || !Number.isFinite(home) ? null : home },
            away: { name: g.road.club.name, score: state === 'pre' || !Number.isFinite(away) ? null : away },
            goals: [],
            period,
          }
        }),
      )
    }),
  )
  return lists.flat().filter((e): e is LiveEvent => e !== null)
}

function slimAll(e: EspnEvent, sport: string): LiveEvent[] {
  // MMA'da bir etkinlik (kart) çok dövüş içerir; diğer sporlarda tek maç
  if (sport === 'mma') return e.competitions.flatMap((c, i) => slimComp(e, c, `${e.id}-${i}`, sport) ?? [])
  const s = e.competitions[0] ? slimComp(e, e.competitions[0], e.id, sport) : null
  return s ? [s] : []
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
  const sport = new URL(request.url).searchParams.get('sport') ?? 'football'
  if (sport !== 'football' && !Object.hasOwn(SPORT_PATHS, sport)) return json(400, { message: `sport: football|${Object.keys(SPORT_PATHS).join('|')}` })
  // ESPN günleri ABD saatine göre böler: gece yarısını geçen maçlar kaçmasın diye dün + bugün (UTC)
  const now = Date.now()
  const days = [now - 24 * 60 * 60_000, now].map((t) => new Date(t).toISOString().slice(0, 10).replace(/-/g, ''))
  const key = sport === 'football' ? `canliskor:live:v1:${days[1]}` : `canliskor:live:v1:${sport}:${days[1]}`
  const hit = await cacheGet(env, key)
  if (hit) return json(200, hit.body, Math.max(1, Math.ceil((hit.expiresAt - Date.now()) / 1000)))
  if (sport !== 'football') {
    const lists = await Promise.all(
      SPORT_PATHS[sport].flatMap((path) =>
        days.map(async (d) => {
          // Kolej ligleri: sadece büyük konferanslar değil bütün maçlar (basketbolda Division I = 50, futbolda FBS = 80)
          const extra = path === 'basketball/mens-college-basketball' ? '&groups=50&limit=500' : path === 'football/college-football' ? '&groups=80&limit=500' : ''
          const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${d}${extra}`, { signal: AbortSignal.timeout(8000) })
          if (!res.ok) return [] as EspnEvent[]
          return ((await res.json()) as { events?: EspnEvent[] }).events ?? []
        }),
      ),
    ).catch((err: unknown) => {
      console.error(`Canlı skor (${sport}) alınamadı:`, err)
      return null
    })
    if (!lists) return json(502, { message: 'Canlı skor şu an alınamıyor.' })
    const byId = new Map<string, LiveEvent>()
    for (const e of lists.flat()) for (const s of slimAll(e, sport)) byId.set(s.id, s)
    // Basketbolda ESPN'in bilmediği EuroLeague / EuroCup maçları resmi canlı servisten
    if (sport === 'basketball') for (const s of await euroleagueLive(env).catch(() => [])) byId.set(s.id, s)
    const body = JSON.stringify({ events: [...byId.values()] })
    await cacheSet(env, key, body, TTL)
    return json(200, body, TTL)
  }
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
