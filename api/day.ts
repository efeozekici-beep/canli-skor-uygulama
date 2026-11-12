// Ana sayfanın "API'nin vermediği günleri" (Vercel fonksiyonu): GET /api/day?sport=football|basketball&date=YYYY-MM-DD
// API-Football ve API-Basketball'un ücretsiz planı sadece dün / bugün / yarını veriyor. Diğer günlerin maç listesi
// buradan, kota harcamayan kaynaklardan gelir:
//  - Futbol: ESPN'in bütün futbol maçları listesi (ABD günü olduğu için 2 gün çekilip Türkiye gününe süzülür). Lig adı / logosu için lig sayfası olan liglerin ESPN
//    numaraları bir kez öğrenilip 30 gün saklanır; bilinmeyen ligin adı maç notundan ("Concacaf Nations League,
//    League B, ...") ya da sezon adından çıkarılır.
//  - Basketbol: NBA (ESPN) + EuroLeague / EuroCup (resmi API, sezonun maç listesi).
// Cevap sitenin Match biçiminde; geçmiş günler 1 gün, gelecek günler 1 saat saklanır.

import { cacheGet, cacheSet, type Env } from './_lib/cache.js'
import { getJson } from './_lib/http.js'
import { LEAGUE_SOURCES } from '../src/config/leagueSources.js'

type Status = 'live' | 'finished' | 'upcoming'

interface DayMatch {
  id: string
  sport: 'football' | 'basketball'
  leagueId: string
  leagueName: string
  leagueLogo?: string
  region: string
  homeTeam: string
  awayTeam: string
  homeLogo?: string
  awayLogo?: string
  homeScore: number | null
  awayScore: number | null
  status: Status
  minute: number | null
  statusLabel?: string
  startTime: string
  featured?: boolean
}

const DAY = 24 * 60 * 60

// Ana listedeki gibi açık gelen ligler (src/services/apiFootball.ts FEATURED_LEAGUES ile aynı)
const FEATURED_FOOTBALL = ['2', '3', '848', '203', '206', '204', '39', '140', '135', '78', '61', '1', '4', '5', '10']

const istanbulDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(iso))

// ---------- Futbol (ESPN) ----------
interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score?: string
  team: { displayName: string; logo?: string }
}
interface EspnEvent {
  id: string
  uid: string
  date: string
  season?: { slug?: string }
  status: { displayClock?: string; type: { name: string; state: 'pre' | 'in' | 'post'; completed: boolean } }
  competitions: { altGameNote?: string; competitors: EspnCompetitor[] }[]
}

// ESPN günleri ABD saatine göre böler: Türkiye günü için o gün + önceki gün çekilip Türkiye tarihine göre süzülür
function espnDates(date: string) {
  const prev = new Date(Date.parse(`${date}T00:00:00Z`) - DAY * 1000).toISOString().slice(0, 10)
  return [prev, date].map((d) => d.replace(/-/g, ''))
}

async function espnEvents(path: string, date: string, extra = ''): Promise<EspnEvent[]> {
  const lists = await Promise.all(
    espnDates(date).map((d) => getJson<{ events?: EspnEvent[] }>(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${d}${extra}`)),
  )
  const byId = new Map<string, EspnEvent>()
  for (const e of lists.flatMap((l) => l.events ?? [])) if (istanbulDay(e.date) === date) byId.set(e.id, e)
  return [...byId.values()]
}

// ESPN lig numarası -> bizim lig id'miz (API-Football) — lig sayfası olan ligler için, 30 gün saklanır
async function espnLeagueMap(env: Env): Promise<Record<string, string>> {
  const key = 'canliskor:day:v1:espn-league-map'
  const hit = await cacheGet(env, key)
  if (hit) return JSON.parse(hit.body) as Record<string, string>
  const entries = await Promise.all(
    Object.entries(LEAGUE_SOURCES).map(async ([apiId, src]) => {
      const raw = await getJson<{ leagues?: { id: string }[] }>(`https://site.api.espn.com/apis/site/v2/sports/soccer/${src.espn}/scoreboard`).catch(() => null)
      const espnId = raw?.leagues?.[0]?.id
      return espnId ? ([espnId, apiId] as const) : null
    }),
  )
  const map = Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null))
  if (Object.keys(map).length > 0) await cacheSet(env, key, JSON.stringify(map), 30 * DAY)
  return map
}

// "2026-27-english-premier-league" -> "English Premier League"
const leagueFromSlug = (slug?: string) =>
  (slug ?? '')
    .replace(/^\d{4}(-\d{2})?-/, '')
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ') || 'Diğer'

function status(e: EspnEvent): { status: Status; minute: number | null; statusLabel?: string } {
  const { state, completed, name } = e.status.type
  if (state === 'post' && completed) return { status: 'finished', minute: null }
  if (state === 'in') {
    if (name === 'STATUS_HALFTIME') return { status: 'live', minute: null, statusLabel: 'İY' }
    const minute = Number.parseInt(e.status.displayClock ?? '', 10)
    return Number.isFinite(minute) ? { status: 'live', minute } : { status: 'live', minute: null, statusLabel: 'Canlı' }
  }
  if (name === 'STATUS_POSTPONED') return { status: 'upcoming', minute: null, statusLabel: 'Ert.' }
  if (name === 'STATUS_CANCELED') return { status: 'upcoming', minute: null, statusLabel: 'İptal' }
  return { status: 'upcoming', minute: null }
}

async function footballDay(env: Env, date: string): Promise<DayMatch[]> {
  const [events, leagues] = await Promise.all([espnEvents('soccer/all', date, '&limit=1000'), espnLeagueMap(env)])
  return events.flatMap((e): DayMatch[] => {
    const c = e.competitions[0]
    const home = c?.competitors.find((x) => x.homeAway === 'home')
    const away = c?.competitors.find((x) => x.homeAway === 'away')
    if (!home || !away) return []
    const espnLeague = e.uid.match(/l:(\d+)/)?.[1] ?? ''
    const apiId = leagues[espnLeague]
    const src = apiId ? LEAGUE_SOURCES[apiId] : null
    const st = status(e)
    const score = (s?: string) => (st.status === 'upcoming' || s === undefined ? null : Number(s))
    return [
      {
        id: `espn-${e.id}`,
        sport: 'football',
        leagueId: apiId ?? `espn-l-${espnLeague}`,
        leagueName: src?.name ?? (c.altGameNote?.split(',')[0].trim() || leagueFromSlug(e.season?.slug)),
        leagueLogo: apiId ? `https://media.api-sports.io/football/leagues/${apiId}.png` : undefined,
        region: src?.region ?? 'Diğer',
        homeTeam: home.team.displayName,
        awayTeam: away.team.displayName,
        homeLogo: home.team.logo,
        awayLogo: away.team.logo,
        homeScore: score(home.score),
        awayScore: score(away.score),
        startTime: e.date,
        featured: apiId ? FEATURED_FOOTBALL.includes(apiId) : false,
        ...st,
      },
    ]
  })
}

// ---------- Basketbol: NBA (ESPN) + EuroLeague / EuroCup (resmi API) ----------
async function nbaDay(date: string): Promise<DayMatch[]> {
  const events = await espnEvents('basketball/nba', date).catch((): EspnEvent[] => [])
  return events.flatMap((e): DayMatch[] => {
    const c = e.competitions[0]
    const home = c?.competitors.find((x) => x.homeAway === 'home')
    const away = c?.competitors.find((x) => x.homeAway === 'away')
    if (!home || !away) return []
    const st = status(e)
    const score = (s?: string) => (st.status === 'upcoming' || s === undefined ? null : Number(s))
    // Basketbolda dakika yok: canlıda "Canlı"
    const shown = st.status === 'live' ? { status: st.status, minute: null, statusLabel: st.statusLabel === 'İY' ? 'Devre arası' : 'Canlı' } : st
    return [
      {
        id: `espn-nba-${e.id}`,
        sport: 'basketball',
        leagueId: 'bb-12',
        leagueName: 'NBA',
        leagueLogo: 'https://media.api-sports.io/basketball/leagues/12.png',
        region: 'ABD',
        homeTeam: home.team.displayName,
        awayTeam: away.team.displayName,
        homeLogo: home.team.logo,
        awayLogo: away.team.logo,
        homeScore: score(home.score),
        awayScore: score(away.score),
        startTime: e.date,
        featured: true,
        ...shown,
      },
    ]
  })
}

interface ElGame {
  identifier: string
  utcDate: string
  played: boolean
  local: { club: { name: string; abbreviatedName?: string; images?: { crest?: string } }; score?: number }
  road: { club: { name: string; abbreviatedName?: string; images?: { crest?: string } }; score?: number }
}

const elSeason = () => {
  const now = new Date()
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

// Sezonun bütün maçları (büyük liste) 1 saat saklanır; gün buradan süzülür
async function euroleagueDay(env: Env, competition: 'E' | 'U', date: string): Promise<DayMatch[]> {
  const key = `canliskor:day:v1:el-games:${competition}${elSeason()}`
  let games: ElGame[]
  const hit = await cacheGet(env, key)
  if (hit) games = JSON.parse(hit.body) as ElGame[]
  else {
    const raw = await getJson<{ data: ElGame[] }>(`https://api-live.euroleague.net/v2/competitions/${competition}/seasons/${competition}${elSeason()}/games`).catch(() => ({
      data: [],
    }))
    games = raw.data.map((g) => ({ identifier: g.identifier, utcDate: g.utcDate, played: g.played, local: g.local, road: g.road }))
    if (games.length > 0) await cacheSet(env, key, JSON.stringify(games), 60 * 60)
  }
  const utc = (iso: string) => (iso.endsWith('Z') ? iso : `${iso}Z`)
  return games
    .filter((g) => istanbulDay(utc(g.utcDate)) === date)
    .map((g) => {
      const finished = g.played
      return {
        id: `el-${g.identifier}`,
        sport: 'basketball',
        leagueId: competition === 'E' ? 'bb-120' : 'bb-194',
        leagueName: competition === 'E' ? 'Euroleague' : 'Eurocup',
        leagueLogo: `https://media.api-sports.io/basketball/leagues/${competition === 'E' ? 120 : 194}.png`,
        region: 'Avrupa',
        homeTeam: g.local.club.abbreviatedName ?? g.local.club.name,
        awayTeam: g.road.club.abbreviatedName ?? g.road.club.name,
        homeLogo: g.local.club.images?.crest,
        awayLogo: g.road.club.images?.crest,
        homeScore: finished ? (g.local.score ?? null) : null,
        awayScore: finished ? (g.road.score ?? null) : null,
        status: finished ? 'finished' : 'upcoming',
        minute: null,
        startTime: utc(g.utcDate),
        featured: competition === 'E',
      } satisfies DayMatch
    })
}

// ---------- İstek ----------
const json = (status: number, body: string, ttl = 0) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': ttl > 0 ? `public, max-age=0, s-maxage=${ttl}` : 'no-store' },
  })

export async function handleDayRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json(405, JSON.stringify({ message: 'Sadece GET desteklenir.' }))
  const q = new URL(request.url).searchParams
  const sport = q.get('sport')
  const date = q.get('date') ?? ''
  if ((sport !== 'football' && sport !== 'basketball') || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json(400, JSON.stringify({ message: 'sport: football|basketball, date: YYYY-MM-DD' }))
  }
  // Geçmiş gün değişmez (1 gün), gelecek gün değişebilir (1 saat)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const ttl = date < today ? DAY : 60 * 60
  const key = `canliskor:day:v2:${sport}:${date}`
  const hit = await cacheGet(env, key)
  if (hit) return json(200, hit.body, Math.max(1, Math.ceil((hit.expiresAt - Date.now()) / 1000)))
  try {
    const matches =
      sport === 'football'
        ? await footballDay(env, date)
        : (await Promise.all([nbaDay(date), euroleagueDay(env, 'E', date), euroleagueDay(env, 'U', date)])).flat()
    const body = JSON.stringify(matches)
    await cacheSet(env, key, body, ttl)
    return json(200, body, ttl)
  } catch (err) {
    console.error('Gün listesi alınamadı:', err)
    return json(502, JSON.stringify({ message: 'Bu günün maçları şu an alınamıyor.' }))
  }
}

export function GET(request: Request) {
  return handleDayRequest(request, process.env)
}
