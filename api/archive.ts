// Basketbol sonuç arşivi (Vercel fonksiyonu + günlük zamanlanmış görev).
// API-Basketball'un ücretsiz planı sadece dün / bugün / yarının maçlarını veriyor; takımların geçmiş lig maçları
// için her gün bir önceki günün biten maçları Upstash'te kalıcı saklanır (günde 1 istek).
//
//   GET /api/archive?run=1[&date=YYYY-MM-DD]   -> günü arşivle (zamanlanmış görev çağırır; varsayılan: dün)
//   GET /api/archive?team=<ad>&exclude=<lig>   -> takımın son 45 gündeki arşivlenmiş maçları (en fazla 10)
//
// Zamanlanmış görev vercel.json "crons" ile her sabah çalışır. CRON_SECRET ortam değişkeni tanımlıysa
// arşivleme sadece Vercel'in gönderdiği "Authorization: Bearer <CRON_SECRET>" başlığıyla kabul edilir.

import { cacheGet, cacheSet, type Env } from './_lib/cache.js'
import { getJson } from './_lib/http.js'

const DAY = 24 * 60 * 60
const KEEP = 400 * DAY // bir sezondan uzun
const LOOKBACK_DAYS = 45

interface ArchivedGame {
  id: string
  date: string
  leagueId: string
  league: string
  home: { name: string; logo: string | null; score: number | null }
  away: { name: string; logo: string | null; score: number | null }
}

const dayKey = (date: string) => `canliskor:bbarchive:v1:${date}`

// Türkiye saatine göre "YYYY-MM-DD" (offset gün önce)
function istanbulDate(offsetDays: number) {
  const d = new Date(Date.now() + offsetDays * DAY * 1000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d)
}

interface ApiGame {
  id: number
  date: string
  status: { short: string }
  league: { id: number; name: string }
  teams: { home: { name: string; logo: string }; away: { name: string; logo: string } }
  scores: { home: { total: number | null }; away: { total: number | null } }
}

async function archiveDay(env: Env, date: string) {
  const key = env.API_BASKETBALL_KEY
  if (!key) throw new Error('API_BASKETBALL_KEY tanımlı değil.')
  const body = await getJson<{ errors: unknown; response: ApiGame[] }>(
    `https://v1.basketball.api-sports.io/games?date=${date}&timezone=Europe%2FIstanbul`,
    { 'x-apisports-key': key },
  )
  const errors = Array.isArray(body.errors) ? body.errors : Object.values(body.errors ?? {})
  if (errors.length > 0) throw new Error(`API-Basketball: ${JSON.stringify(body.errors)}`)
  // Sadece biten maçlar (FT: normal süre, AOT: uzatma)
  const games: ArchivedGame[] = body.response
    .filter((g) => g.status.short === 'FT' || g.status.short === 'AOT')
    .map((g) => ({
      id: `bb-${g.id}`,
      date: g.date,
      leagueId: `bb-${g.league.id}`,
      league: g.league.name,
      home: { name: g.teams.home.name, logo: g.teams.home.logo || null, score: g.scores.home.total },
      away: { name: g.teams.away.name, logo: g.teams.away.logo || null, score: g.scores.away.total },
    }))
  await cacheSet(env, dayKey(date), JSON.stringify(games), KEEP)
  return games.length
}

// Sıkı ad eşleştirme (takım sayfasındakiyle aynı kural): kısa addaki ayırt edici kelimelerin hepsi geçmeli
const GENERIC = new Set(['basket', 'basketball', 'bc', 'bk', 'kk', 'cb', 'sk', 'club', 'maccabi', 'hapoel', 'olympiacos', 'piraeus', 'istanbul', 'tel', 'aviv'])
const words = (name: string) =>
  name
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !GENERIC.has(w))

async function teamGames(env: Env, team: string, exclude: string) {
  const key = words(team)
  if (key.length === 0) return []
  const isTeam = (name: string) => {
    const w = words(name)
    return key.every((k) => w.includes(k))
  }
  const days = Array.from({ length: LOOKBACK_DAYS }, (_, i) => istanbulDate(-(i + 1)))
  const stored = await Promise.all(days.map((d) => cacheGet(env, dayKey(d))))
  return stored
    .flatMap((hit) => (hit ? (JSON.parse(hit.body) as ArchivedGame[]) : []))
    .filter((g) => g.leagueId !== exclude && !/\b(W|Women|U\d{2})\b/i.test(g.league) && (isTeam(g.home.name) || isTeam(g.away.name)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
}

const json = (status: number, body: unknown, ttl = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': ttl > 0 ? `public, max-age=0, s-maxage=${ttl}` : 'no-store' },
  })

export async function handleArchiveRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json(405, { message: 'Sadece GET desteklenir.' })
  const q = new URL(request.url).searchParams

  if (q.get('run')) {
    if (env.CRON_SECRET && request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) return json(401, { message: 'Yetkisiz.' })
    const date = q.get('date') ?? istanbulDate(-1)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { message: 'date: YYYY-MM-DD' })
    try {
      const count = await archiveDay(env, date)
      return json(200, { date, archived: count })
    } catch (err) {
      console.error('Arşivleme başarısız:', err)
      return json(502, { message: String(err) })
    }
  }

  const team = (q.get('team') ?? '').slice(0, 60)
  if (team.length < 2) return json(400, { message: 'team gerekli.' })
  const cacheKey = `canliskor:bbarchive:team:v1:${team}:${q.get('exclude') ?? ''}`
  const hit = await cacheGet(env, cacheKey)
  if (hit) return new Response(hit.body, { headers: { 'content-type': 'application/json; charset=utf-8' } })
  const games = await teamGames(env, team, q.get('exclude') ?? '')
  const body = JSON.stringify({ games })
  await cacheSet(env, cacheKey, body, 60 * 60)
  return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' } })
}

export function GET(request: Request) {
  return handleArchiveRequest(request, process.env)
}
