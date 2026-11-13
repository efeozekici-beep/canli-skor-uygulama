// Futbol ve basketbol dışındaki sporların günlük maç listesi (Vercel fonksiyonu):
// GET /api/sports?sport=volleyball|handball|hockey|baseball|rugby|american-football|mma|tennis|f1&date=YYYY-MM-DD
// Tenis, Formula 1 ve MMA'nın kaynakları api/_lib/solo.ts'te (tenis / F1 her gün ESPN'den, kota yok).
//
//  - Dün / bugün / yarın: API-Sports (aynı API-Football anahtarı; her sporun kendi günlük 100 istek kotası var).
//    Ücretsiz plan başka günleri vermiyor.
//  - Diğer günler: ESPN (anahtarsız) — sadece NHL, MLB, NFL ve kolej Amerikan futbolu; diğer sporlarda boş liste.
//
// Kota korunur: her gün Redis'te saklanır (bugün 20 dk -> günde en fazla ~72 istek) ve son başarılı liste
// 3 gün yedekte tutulur; API hata verirse (ör. kota bitti) yedek gösterilir.
// Cevap sitenin Match biçiminde, ligler sıralı (Türkiye en üstte, sonra öne çıkan ligler, sonra ülkeler).

import { cacheGet, cacheSet, type Env } from './_lib/cache.js'
import { clientIp, tooMany } from './_lib/limit.js'
import { espnEvents, istanbulDay, status as espnStatus, type EspnEvent } from './day.js'
import { COUNTRY_TR } from '../src/lib/countries.js'
import { f1Day, mmaApiDay, tennisDay, ufcDay, type SoloMatch } from './_lib/solo.js'

type Status = 'live' | 'finished' | 'upcoming'
type TeamSportId = 'volleyball' | 'handball' | 'hockey' | 'baseball' | 'rugby' | 'american-football'
type SoloSportId = SoloMatch['sport']
type SportId = TeamSportId | SoloSportId
const SOLO_SPORTS = new Set<string>(['mma', 'tennis', 'f1'])

interface SportMatch {
  id: string
  sport: TeamSportId
  leagueId: string
  leagueName: string
  leagueLogo?: string
  region: string
  featured?: boolean
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
}

interface SportConfig {
  host: string
  /** Maç ve lig id öneki: futbol / basketbol id'leriyle çakışmasın */
  prefix: string
  /** Canlı durum kodu -> Türkçe etiket */
  live: (code: string) => string | null
  /** Listede açık gelen ligler (Türkiye ligleri her zaman açık), ada göre */
  featured: RegExp
  /** API'nin vermediği günler için ESPN listeleri */
  espn: { path: string; leagueName: string; region: string }[]
}

const numbered = (re: RegExp, label: (n: string) => string) => (code: string) => {
  const m = re.exec(code)
  return m ? label(m[1]) : null
}
const halves = (code: string) =>
  ({ '1H': '1. Yarı', '2H': '2. Yarı', HT: 'Devre arası', ET: 'Uzatma', BT: 'Ara', PT: 'Penaltılar' })[code] ?? null

const SPORTS: Record<TeamSportId, SportConfig> = {
  volleyball: {
    host: 'https://v1.volleyball.api-sports.io',
    prefix: 'vb',
    live: numbered(/^S(\d)$/, (n) => `${n}. Set`),
    featured: /^(cev |champions league|world|nations league|olymp)/i,
    espn: [],
  },
  handball: {
    host: 'https://v1.handball.api-sports.io',
    prefix: 'hb',
    live: halves,
    featured: /^(ehf champions league|champions league|world|european championship|olymp)/i,
    espn: [],
  },
  hockey: {
    host: 'https://v1.hockey.api-sports.io',
    prefix: 'ih',
    live: (code) => numbered(/^P(\d)$/, (n) => `${n}. Periyot`)(code) ?? ({ OT: 'Uzatma', PT: 'Penaltılar', BT: 'Ara' } as Record<string, string>)[code] ?? null,
    featured: /^(nhl|khl|champions hockey league|world championship|olymp)$/i,
    espn: [{ path: 'hockey/nhl', leagueName: 'NHL', region: 'ABD' }],
  },
  baseball: {
    host: 'https://v1.baseball.api-sports.io',
    prefix: 'bsb',
    live: numbered(/^IN(\d+)$/, (n) => `${n}. İnning`),
    featured: /^(mlb|world baseball classic|world series)$/i,
    espn: [{ path: 'baseball/mlb', leagueName: 'MLB', region: 'ABD' }],
  },
  rugby: {
    host: 'https://v1.rugby.api-sports.io',
    prefix: 'rg',
    live: halves,
    featured: /^(six nations|rugby championship|world cup|top 14|premiership rugby|united rugby championship|european rugby champions cup|super rugby|nations championship)/i,
    espn: [],
  },
  'american-football': {
    host: 'https://v1.american-football.api-sports.io',
    prefix: 'af',
    live: (code) => numbered(/^Q(\d)$/, (n) => `${n}. Çeyrek`)(code) ?? ({ HT: 'Devre arası', OT: 'Uzatma' } as Record<string, string>)[code] ?? null,
    featured: /^(nfl|ncaa)$/i,
    espn: [
      { path: 'football/nfl', leagueName: 'NFL', region: 'ABD' },
      { path: 'football/college-football', leagueName: 'NCAA', region: 'ABD' },
    ],
  },
}

const MIN = 60
const HOUR = 60 * MIN
const DAY = 24 * HOUR

// ---------- API-Sports ----------
function apiKey(env: Env) {
  const key = env.API_SPORTS_KEY ?? env.API_FOOTBALL_KEY
  if (!key) throw new Error('API_FOOTBALL_KEY tanımlı değil.')
  return key
}

const UPCOMING = new Set(['NS', 'TBD'])
const FINISHED: Record<string, string | undefined> = { FT: undefined, AOT: 'UZ', AET: 'UZ', AP: 'PEN', AW: 'Hükmen', AWD: 'Hükmen', WO: 'Hükmen' }
const STOPPED: Record<string, string> = { POST: 'Ert.', PST: 'Ert.', CANC: 'İptal', ABD: 'Yarıda', INTR: 'Durdu', SUSP: 'Durdu' }

type Score = number | null | { total?: number | null }
interface ApiGame {
  id: number
  date: string
  timer?: string | null
  status: { short: string; timer?: string | null }
  country?: { name: string }
  league: { id: number; name: string; logo?: string; country?: { name: string } }
  teams: { home: { name: string; logo?: string }; away: { name: string; logo?: string } }
  scores: { home: Score; away: Score }
}
// Amerikan futbolu farklı biçimde: maç bilgisi "game" altında
interface ApiAfGame extends Omit<ApiGame, 'id' | 'date' | 'status' | 'timer'> {
  game: { id: number; date: { timestamp: number }; status: { short: string; timer?: string | null } }
}

const total = (s: Score) => (typeof s === 'number' ? s : (s?.total ?? null))

function apiStatus(cfg: SportConfig, code: string, timer?: string | null): Pick<SportMatch, 'status' | 'minute' | 'statusLabel'> {
  if (UPCOMING.has(code)) return { status: 'upcoming', minute: null }
  if (code in FINISHED) return { status: 'finished', minute: null, statusLabel: FINISHED[code] }
  if (code in STOPPED) return { status: code === 'INTR' || code === 'SUSP' ? 'live' : 'upcoming', minute: null, statusLabel: STOPPED[code] }
  const minute = Number.parseInt(timer ?? '', 10)
  const label = cfg.live(code) ?? 'Canlı'
  // Dakika varsa (hentbol, rugby, hokey) etiketin yanında gösterilir: "2. Yarı 47'"
  return { status: 'live', minute: Number.isFinite(minute) ? minute : null, statusLabel: Number.isFinite(minute) ? `${label} ${minute}'` : label }
}

async function apiSportsDay(env: Env, sport: TeamSportId, date: string): Promise<SportMatch[]> {
  const cfg = SPORTS[sport]
  const key = apiKey(env)
  const res = await fetch(`${cfg.host}/games?date=${date}&timezone=Europe/Istanbul`, {
    headers: { 'x-apisports-key': key, accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`${sport} HTTP ${res.status}`)
  const body = (await res.json()) as { errors?: unknown; response?: (ApiGame | ApiAfGame)[] }
  const errors = body.errors && (Array.isArray(body.errors) ? body.errors.length > 0 : Object.keys(body.errors).length > 0)
  if (errors) throw new Error(`${sport} API hatası: ${JSON.stringify(body.errors)}`)

  return (body.response ?? []).map((raw) => {
    const af = 'game' in raw
    const id = af ? raw.game.id : raw.id
    const start = af ? new Date(raw.game.date.timestamp * 1000).toISOString() : raw.date
    const st = af ? raw.game.status : raw.status
    const country = (af ? raw.league.country?.name : (raw as ApiGame).country?.name) ?? ''
    const shown = apiStatus(cfg, st.short, st.timer ?? (af ? null : (raw as ApiGame).timer))
    const upcoming = shown.status === 'upcoming'
    return {
      id: `${cfg.prefix}-${id}`,
      sport,
      leagueId: `${cfg.prefix}-${raw.league.id}`,
      leagueName: raw.league.name,
      leagueLogo: raw.league.logo || undefined,
      region: COUNTRY_TR[country] ?? country.replace(/-/g, ' '),
      homeTeam: raw.teams.home.name,
      awayTeam: raw.teams.away.name,
      homeLogo: raw.teams.home.logo || undefined,
      awayLogo: raw.teams.away.logo || undefined,
      homeScore: upcoming ? null : total(raw.scores.home),
      awayScore: upcoming ? null : total(raw.scores.away),
      startTime: start,
      ...shown,
    }
  })
}

// ---------- ESPN (API'nin vermediği günler) ----------
async function espnDay(sport: TeamSportId, date: string): Promise<SportMatch[]> {
  const cfg = SPORTS[sport]
  const lists = await Promise.all(
    cfg.espn.map(async (src) => {
      const events = await espnEvents(src.path, date).catch((): EspnEvent[] => [])
      return events.flatMap((e): SportMatch[] => {
        const c = e.competitions[0]
        const home = c?.competitors.find((x) => x.homeAway === 'home')
        const away = c?.competitors.find((x) => x.homeAway === 'away')
        if (!home || !away) return []
        const st = espnStatus(e)
        const score = (s?: string) => (st.status === 'upcoming' || s === undefined ? null : Number(s))
        // ESPN'in saati futbol dakikası değil (periyot saati): canlıda sadece "Canlı"
        const shown = st.status === 'live' ? { status: st.status, minute: null, statusLabel: 'Canlı' } : st
        return [
          {
            id: `espn-${cfg.prefix}-${e.id}`,
            sport,
            leagueId: `espn-${cfg.prefix}-${src.leagueName.toLowerCase()}`,
            leagueName: src.leagueName,
            region: src.region,
            homeTeam: home.team.displayName,
            awayTeam: away.team.displayName,
            homeLogo: home.team.logo,
            awayLogo: away.team.logo,
            homeScore: score(home.score),
            awayScore: score(away.score),
            startTime: e.date,
            ...shown,
          },
        ]
      })
    }),
  )
  return lists.flat()
}

// ---------- Sıralama ----------
// Ülkelerin sırası: Türkiye en üstte, sonra spor gücüne yakın genel bir sıra (Avrupa önce), sonra alfabe
const COUNTRY_ORDER = [
  'Türkiye', 'Dünya', 'Avrupa', 'ABD', 'Kanada', 'İtalya', 'Polonya', 'Almanya', 'Fransa', 'İspanya', 'Rusya', 'Brezilya',
  'Japonya', 'İsveç', 'Finlandiya', 'Danimarka', 'Norveç', 'İsviçre', 'Çekya', 'Slovakya', 'Avusturya', 'Macaristan',
  'Hırvatistan', 'Sırbistan', 'Slovenya', 'Romanya', 'Bulgaristan', 'Yunanistan', 'Belçika', 'Hollanda', 'Portekiz',
  'İngiltere', 'İskoçya', 'İrlanda', 'Galler', 'Ukrayna', 'Güney Kore', 'Çin', 'Avustralya', 'Arjantin', 'Meksika',
]
// Voleybolda kadın ligleri (Sultanlar Ligi) ana liglerden sayılır; diğer sporlarda kadın / alt yaş ligleri ülkesinin sonuna
const MINOR = /\b(women|u\d{2}|youth|junior|reserve|ii)\b/i

function sortAndFeature(sport: TeamSportId, matches: SportMatch[]): SportMatch[] {
  const cfg = SPORTS[sport]
  for (const m of matches) m.featured = m.region === 'Türkiye' || cfg.featured.test(m.leagueName)
  const rank = (m: SportMatch): [number, number, number] => {
    const country = COUNTRY_ORDER.indexOf(m.region)
    const minor = sport !== 'volleyball' && MINOR.test(m.leagueName) ? 1 : 0
    if (m.region === 'Türkiye') return [0, 0, minor]
    if (m.featured && !minor) return [1, 0, 0]
    return [2, country === -1 ? COUNTRY_ORDER.length : country, minor]
  }
  return matches.sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    for (let i = 0; i < 3; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
    return (
      a.region.localeCompare(b.region, 'tr') ||
      a.leagueName.localeCompare(b.leagueName, 'tr') ||
      a.startTime.localeCompare(b.startTime) ||
      a.homeTeam.localeCompare(b.homeTeam, 'tr')
    )
  })
}

// ---------- İstek ----------
const json = (status: number, body: string, ttl = 0, cache?: string) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': ttl > 0 ? `public, max-age=0, s-maxage=${ttl}` : 'no-store',
      ...(cache ? { 'x-cache': cache } : {}),
    },
  })

const shiftDay = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY * 1000).toISOString().slice(0, 10)

// Aynı anda gelen aynı istekler tek API çağrısını paylaşır
const inflight = new Map<string, Promise<{ body: string; ttl: number; cache: string }>>()

async function load(env: Env, sport: SportId, date: string) {
  const today = istanbulDay(new Date().toISOString())
  const inWindow = date >= shiftDay(today, -1) && date <= shiftDay(today, 1)
  const key = `canliskor:sports:v1:${sport}:${date}`
  const backupKey = `${key}:backup`
  try {
    // API-Sports sadece dün / bugün / yarın; tenis ve F1 hep ESPN
    const useApi = inWindow && sport !== 'tennis' && sport !== 'f1'
    const matches: (SportMatch | SoloMatch)[] =
      sport === 'tennis'
        ? await tennisDay(date)
        : sport === 'f1'
          ? await f1Day(date)
          : sport === 'mma'
            ? useApi
              ? await mmaApiDay(apiKey(env), date)
              : await ufcDay(date)
            : sortAndFeature(sport, useApi ? await apiSportsDay(env, sport, date) : await espnDay(sport, date))
    // API günleri: bugün 20 dk (kota), dün hepsi bittiyse 12 saat yoksa 30 dk, yarın 3 saat.
    // ESPN günleri (kota yok): bugün 30 sn (tenis / F1 canlı skoru), geçmiş 1 gün, gelecek 1 saat.
    const allDone = matches.every((m) => m.status !== 'live' && m.status !== 'upcoming')
    // Gece yarısını geçen maçlar dünün listesinde canlı kalır: o zaman bugünkü gibi kısa saklanır
    const anyLive = matches.some((m) => m.status === 'live')
    const ttl = !useApi
      ? date === today
        ? 30
        : date < today
          ? DAY
          : HOUR
      : date === today || anyLive
        ? 20 * MIN
        : date < today
          ? allDone
            ? 12 * HOUR
            : 30 * MIN
          : 3 * HOUR
    const body = JSON.stringify(matches)
    await cacheSet(env, key, body, ttl)
    if (useApi) await cacheSet(env, backupKey, body, 3 * DAY)
    return { body, ttl, cache: 'MISS' }
  } catch (err) {
    console.error(`${sport} ${date} listesi alınamadı:`, err)
    const backup = await cacheGet(env, backupKey)
    if (backup) return { body: backup.body, ttl: 5 * MIN, cache: 'STALE' }
    throw err
  }
}

export async function handleSportsRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json(405, JSON.stringify({ message: 'Sadece GET desteklenir.' }))
  const q = new URL(request.url).searchParams
  const sport = q.get('sport') ?? ''
  const date = q.get('date') ?? ''
  if ((!Object.hasOwn(SPORTS, sport) && !SOLO_SPORTS.has(sport)) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json(400, JSON.stringify({ message: `sport: ${[...Object.keys(SPORTS), ...SOLO_SPORTS].join('|')}, date: YYYY-MM-DD` }))
  }
  const key = `canliskor:sports:v1:${sport}:${date}`
  const hit = await cacheGet(env, key)
  if (hit) return json(200, hit.body, Math.max(1, Math.ceil((hit.expiresAt - Date.now()) / 1000)), 'HIT')

  let pending = inflight.get(key)
  if (!pending) {
    if (await tooMany(env, `api:${clientIp(request)}`, 60, 60)) return json(429, JSON.stringify({ message: 'Çok fazla istek, biraz bekle.' }))
    pending = load(env, sport as SportId, date).finally(() => inflight.delete(key))
    inflight.set(key, pending)
  }
  try {
    const result = await pending
    return json(200, result.body, result.ttl, result.cache)
  } catch {
    return json(502, JSON.stringify({ message: 'Bu günün maçları şu an alınamıyor.' }))
  }
}

export function GET(request: Request) {
  return handleSportsRequest(request, process.env)
}
