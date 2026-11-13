// CanlıSkor backend'i (Vercel fonksiyonu).
// Tarayıcı /api/football/..., /api/basketball/..., /api/nba/... (API-Sports), /api/footballdata/... (football-data.org)
// ve /api/espn/... (ESPN) ister; burası isteği gerekiyorsa anahtarla iletir ve cevabı Redis'te (Upstash) saklar. Böylece:
//  - anahtar tarayıcıya hiç gitmez,
//  - aynı veriyi isteyen bütün kullanıcılar tek istek (tek kota) harcar.
// Yerelde (npm run dev) aynı kod vite.config.ts içinden çalışır; Redis yoksa hafızada saklar.

import { cacheGet, cacheSet, type Env } from './_lib/cache.js'
import { clientIp, tooMany } from './_lib/limit.js'

interface ProviderConfig {
  host: string
  /** Anahtarın ortam değişkeni ve gönderildiği başlık (ESPN anahtar istemiyor) */
  key: { env: string; header: string } | null
  /** API-Sports hataları HTTP 200 içinde "errors" alanıyla gelir; diğerleri normal HTTP durum kodu kullanır */
  apiSports: boolean
}

const PROVIDERS = {
  football: { host: 'https://v3.football.api-sports.io', key: { env: 'API_FOOTBALL_KEY', header: 'x-apisports-key' }, apiSports: true },
  basketball: { host: 'https://v1.basketball.api-sports.io', key: { env: 'API_BASKETBALL_KEY', header: 'x-apisports-key' }, apiSports: true },
  nba: { host: 'https://v2.nba.api-sports.io', key: { env: 'API_NBA_KEY', header: 'x-apisports-key' }, apiSports: true },
  // Büyük 12 lig: bu sezonun puan durumu, gol krallığı, fikstür (dakikada 10 istek)
  footballdata: { host: 'https://api.football-data.org/v4', key: { env: 'FOOTBALL_DATA_KEY', header: 'X-Auth-Token' }, apiSports: false },
  // Diğer ligler (Süper Lig...): puan durumu, krallık, günlük maçlar
  espn: { host: 'https://site.api.espn.com', key: null, apiSports: false },
  // EuroLeague / EuroCup resmi API'si: bu sezonun puan durumu (anahtar yok)
  euroleague: { host: 'https://api-live.euroleague.net', key: null, apiSports: false },
} satisfies Record<string, ProviderConfig>
type Provider = keyof typeof PROVIDERS

const MIN = 60
const HOUR = 60 * MIN
const DAY = 24 * HOUR

// ---------- Önbellek süreleri (saniye) ----------

// Verilen saat dilimine göre bugünün tarihi: "2026-10-15"
function todayIn(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

// Tarihli maç listesi (API-Football, API-Basketball, API-NBA; her birinin kotası günde 100 istek, UTC gece
// yarısı yenilenir). Canlı skor büyük liglerde ayrı katmandan (api/live.ts: ESPN, EuroLeague; kotasız) gelir.
// Bugün (ve gece yarısını geçen maçlarıyla dün):
//  - canlı maç yokken 30 dk
//  - canlı maç varken kalan kotaya göre: API her cevapta günün kalan istek sayısını söyler (x-ratelimit-requests-
//    remaining). Diğer işler (maç detayı, puan durumu...) için bir pay ayrılır, kalanı günün kalan saatine
//    (en fazla 6 saat: akşam maç saatleri) bölünür -> 3 ile 15 dk arası. Kota bolken sık, azalınca seyrek yenilenir.
// Eski günler 6 saat, gelecek 30 dk.
// API-Sports maç listesinde hâlâ oynanan maç var mı (gece yarısını geçen maçlar dünün listesinde kalır)
const LIVE_CODES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP', 'Q1', 'Q2', 'Q3', 'Q4', 'OT'])
function hasLiveGames(body: unknown) {
  const list = (body as { response?: unknown[] } | null)?.response
  if (!Array.isArray(list)) return false
  return list.some((g) => {
    const s = g as { status?: { short?: string }; fixture?: { status?: { short?: string } }; game?: { status?: { short?: string } } }
    const code = s.fixture?.status?.short ?? s.game?.status?.short ?? s.status?.short ?? ''
    return LIVE_CODES.has(code)
  })
}

interface Meta {
  provider: Provider
  /** API'nin bildirdiği, bugün kalan istek sayısı (bilinmiyorsa null) */
  remaining: number | null
}

// Diğer işlere ayrılan pay: futbolda maç detayı / kadro / istatistik çok istek harcar
const RESERVE: Partial<Record<Provider, number>> = { football: 35, basketball: 20, nba: 25 }

function liveListTtl(meta?: Meta) {
  const remaining = meta?.remaining
  if (remaining === null || remaining === undefined) return 10 * MIN
  const usable = remaining - (RESERVE[meta!.provider] ?? 20)
  if (usable <= 0) return 30 * MIN
  const now = new Date()
  const untilReset = (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000
  const window = Math.min(untilReset, 6 * HOUR)
  return Math.round(Math.min(15 * MIN, Math.max(3 * MIN, window / usable)))
}

function dateTtl(q: URLSearchParams, body?: unknown, meta?: Meta) {
  const date = q.get('date') ?? ''
  const today = todayIn(q.get('timezone') ?? 'UTC')
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - DAY * 1000).toISOString().slice(0, 10)
  if (date === today || date === yesterday) return hasLiveGames(body) ? liveListTtl(meta) : 30 * MIN
  return date < today ? 6 * HOUR : 30 * MIN
}

// Bitmiş (veya iptal/ertelenmiş) futbol maçı durumları: veri artık değişmez
const FOOTBALL_DONE = new Set(['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'])

function footballFixturesTtl(q: URLSearchParams, body: unknown, meta?: Meta) {
  if (q.has('date')) return dateTtl(q, body, meta)
  if (q.has('id')) {
    // Maç detayı: bittiyse 7 gün, başlamadıysa 5 dk, canlıysa 1 dk
    const status = (body as { response?: { fixture?: { status?: { short?: string } } }[] }).response?.[0]?.fixture?.status?.short
    if (status && FOOTBALL_DONE.has(status)) return 7 * DAY
    return status === 'NS' || status === 'TBD' ? 5 * MIN : MIN
  }
  return 5 * MIN // lig fikstürü
}

// ESPN günlük maç listesi (?dates=20261017): geçmiş günler 6 saat, bugün 2 dk, gelecek 1 saat
function espnDateTtl(q: URLSearchParams) {
  const date = q.get('dates') ?? ''
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  if (date === today) return 2 * MIN
  return date < today ? 6 * HOUR : HOUR
}

type Rule = (q: URLSearchParams, body: unknown, meta?: Meta) => number
const fixed = (seconds: number): Rule => () => seconds

// Sadece burada listelenen uç noktalara izin verilir: backend herkesin kullanabileceği açık bir proxy olmasın
// Değişken parçalı adresler (lig kodu gibi) için desenler
const PATTERNS: Record<Provider, [RegExp, Rule][]> = {
  football: [],
  basketball: [],
  nba: [],
  footballdata: [
    [/^\/competitions\/[A-Z0-9]{2,4}\/standings$/, fixed(30 * MIN)],
    [/^\/competitions\/[A-Z0-9]{2,4}\/scorers$/, fixed(3 * HOUR)],
    [/^\/competitions\/[A-Z0-9]{2,4}\/matches$/, fixed(10 * MIN)],
  ],
  espn: [
    [/^\/apis\/v2\/sports\/soccer\/[a-z0-9.]+\/standings$/, fixed(30 * MIN)],
    [/^\/apis\/site\/v2\/sports\/soccer\/[a-z0-9.]+\/statistics$/, fixed(3 * HOUR)],
    [/^\/apis\/site\/v2\/sports\/soccer\/[a-z0-9.]+\/scoreboard$/, espnDateTtl],
    // Takım sayfası: ligdeki takımlar (1 gün) ve takımın maç takvimi (10 dk)
    [/^\/apis\/site\/v2\/sports\/soccer\/[a-z0-9.]+\/teams$/, fixed(DAY)],
    [/^\/apis\/site\/v2\/sports\/soccer\/[a-z0-9.]+\/teams\/\d+\/schedule$/, fixed(10 * MIN)],
    // Takım kadrosu + oyuncuların bu sezonki lig istatistikleri (maç, gol, asist, kart) — 3 saat
    [/^\/apis\/site\/v2\/sports\/soccer\/[a-z0-9.]+\/teams\/\d+\/roster$/, fixed(3 * HOUR)],
    // Oyuncu sayfası: oyuncu araması (7 gün) ve kulüp / lig bazında kariyer istatistikleri (1 gün)
    [/^\/apis\/search\/v2$/, fixed(7 * DAY)],
    [/^\/apis\/common\/v3\/sports\/soccer\/athletes\/\d+\/stats$/, fixed(DAY)],
    [/^\/apis\/common\/v3\/sports\/soccer\/athletes\/\d+$/, fixed(DAY)],
    // Basketbol: NBA puan durumu (30 dk)
    [/^\/apis\/v2\/sports\/basketball\/nba\/standings$/, fixed(30 * MIN)],
    // Basketbol oyuncu geçmişi: NBA oyuncusunun sezon ortalamaları (1 gün)
    [/^\/apis\/common\/v3\/sports\/basketball\/nba\/athletes\/\d+\/stats$/, fixed(DAY)],
  ],
  euroleague: [
    // Turlar listesi (1 gün) ve bir turun puan durumu (10 dk)
    [/^\/v2\/competitions\/[EU]\/seasons\/[EU]\d{4}\/rounds$/, fixed(DAY)],
    [/^\/v2\/competitions\/[EU]\/seasons\/[EU]\d{4}\/rounds\/\d+\/standings$/, fixed(10 * MIN)],
    // Oyuncu geçmişi: sezonun oyuncu listesi ve oyuncunun sezon istatistikleri (1 gün)
    [/^\/v2\/competitions\/[EU]\/seasons\/[EU]\d{4}\/people$/, fixed(DAY)],
    [/^\/v2\/competitions\/[EU]\/seasons\/[EU]\d{4}\/people\/[A-Z0-9]+\/stats$/, fixed(DAY)],
  ],
}

function findRule(provider: Provider, path: string): Rule | null {
  const exact = RULES[provider]
  if (Object.hasOwn(exact, path)) return exact[path]
  return PATTERNS[provider].find(([re]) => re.test(path))?.[1] ?? null
}

const RULES: Record<Provider, Record<string, Rule>> = {
  football: {
    '/fixtures': footballFixturesTtl,
    '/fixtures/headtohead': fixed(12 * HOUR),
    '/standings': fixed(HOUR),
    '/players/topscorers': fixed(6 * HOUR),
    '/players/topassists': fixed(6 * HOUR),
    '/players/topyellowcards': fixed(6 * HOUR),
    '/players/topredcards': fixed(6 * HOUR),
    '/players': fixed(6 * HOUR),
    '/players/profiles': fixed(7 * DAY),
    '/players/seasons': fixed(7 * DAY),
    '/players/teams': fixed(7 * DAY),
    '/transfers': fixed(7 * DAY),
    '/trophies': fixed(7 * DAY),
    '/teams': fixed(DAY),
    '/leagues': fixed(DAY),
    '/coachs': fixed(DAY), // takımın teknik direktörü (kadroda boş gelirse)
    '/players/squads': fixed(DAY), // takım sayfası: güncel kadro
  },
  basketball: {
    '/games': (q, body, meta) => dateTtl(q, body, meta),
    '/games/statistics/teams': fixed(2 * MIN),
    '/games/statistics/players': fixed(2 * MIN),
    '/standings': fixed(HOUR),
  },
  nba: {
    '/games': (q, body, meta) => dateTtl(q, body, meta), // API-NBA tarihi UTC'dir (timezone parametresi yok -> UTC)
    '/players/statistics': fixed(2 * MIN),
    '/players': fixed(7 * DAY),
  },
  footballdata: {},
  espn: {},
  euroleague: {},
}

// API-Sports hataları HTTP 200 ile gelir: { errors: { plan: "..." } } gibi
function errorKind(body: unknown): 'none' | 'plan' | 'other' {
  const errors = (body as { errors?: unknown[] | Record<string, string> } | null)?.errors
  if (!errors) return 'none'
  if (Array.isArray(errors)) return errors.length > 0 ? 'other' : 'none'
  if ('plan' in errors) return 'plan'
  return Object.keys(errors).length > 0 ? 'other' : 'none'
}

// ---------- İstek ----------

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

function send(body: string, ttl: number, cache: 'HIT' | 'MISS' | 'STALE') {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // s-maxage: Vercel'in CDN'i de aynı süre saklasın (fonksiyon hiç çalışmaz)
      'cache-control': ttl > 0 ? `public, max-age=0, s-maxage=${ttl}` : 'no-store',
      'x-cache': cache,
    },
  })
}

// İki biçim desteklenir: /api/football/fixtures?date=... (yerel) ve
// /api/proxy?provider=football&path=fixtures&date=... (vercel.json yönlendirmesi)
function parseTarget(url: URL) {
  const query = new URLSearchParams(url.searchParams)
  let provider = query.get('provider')
  let path = query.get('path')
  query.delete('provider')
  query.delete('path')
  const m = url.pathname.match(/^\/api\/(football|basketball|nba|footballdata|espn|euroleague)(\/.*)$/)
  if (m) {
    provider = m[1]
    path = m[2]
  } else if (path) {
    path = `/${path.replace(/^\/+/, '')}`
  }
  if (!provider || !path || !Object.hasOwn(PROVIDERS, provider)) return null
  return { provider: provider as Provider, path, query }
}

type Result = { ok: true; body: string; ttl: number; stale?: boolean } | { ok: false; status: number; message: string }

// Maç listelerinin (tarihli istekler) son başarılı cevabı 2 gün yedekte tutulur: API kota / hata verirse
// boş liste yerine bu gösterilir (cevapta x-cache: STALE). 2 dk sonra tekrar denenir.
const BACKUP_TTL = 2 * DAY
const backupKey = (cacheKey: string) => `${cacheKey}:backup`
async function fromBackup(env: Env, cacheKey: string): Promise<Result | null> {
  const b = await cacheGet(env, backupKey(cacheKey))
  return b ? { ok: true, body: b.body, ttl: 2 * MIN, stale: true } : null
}

// Aynı anda gelen aynı istekler tek API çağrısını paylaşır
const inflight = new Map<string, Promise<Result>>()

async function fetchUpstream(env: Env, provider: Provider, path: string, rule: Rule, query: URLSearchParams, cacheKey: string): Promise<Result> {
  const config: ProviderConfig = PROVIDERS[provider]
  const headers: Record<string, string> = {}
  if (config.key) {
    const apiKey = env[config.key.env]
    if (!apiKey) return { ok: false, status: 500, message: `${config.key.env} tanımlı değil.` }
    headers[config.key.header] = apiKey
  }
  const qs = query.toString()
  try {
    headers.accept = 'application/json'
    const target = `${config.host}${path}${qs ? `?${qs}` : ''}`
    let res = await fetch(target, { headers, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) {
      // football-data: 403 = ücretsiz plan bu sezonu/ligi vermiyor, 404 = yok. Kalıcı olduğu için 1 saat saklanır
      // (dakikada 10 istek sınırı boşa harcanmasın). 429 (çok istek) ve sunucu hataları saklanmaz.
      const permanent = res.status === 403 || res.status === 404
      if (permanent) await cacheSet(env, `${cacheKey}:error`, String(res.status), HOUR)
      else if (query.has('date')) {
        const backup = await fromBackup(env, cacheKey)
        if (backup) return backup
      }
      return { ok: false, status: permanent ? res.status : 502, message: `${provider} HTTP ${res.status}` }
    }
    let body = await res.text()
    // EuroLeague bazı adreslerde önbelleğinde kalmış XML veriyor: önbelleği atlatıp bir kez daha dene
    if (body.trimStart().startsWith('<')) {
      res = await fetch(`${target}${qs ? '&' : '?'}_=${Date.now()}`, { headers, signal: AbortSignal.timeout(10_000) })
      body = await res.text()
    }
    const parsed: unknown = JSON.parse(body)
    // API-Sports plan hatası kalıcıdır (6 saat sakla, kota harcanmasın); kota/anahtar hatası saklanmaz
    const kind = config.apiSports ? errorKind(parsed) : 'none'
    // Kota / anahtar hatası (plan dışı): maç listesinde yedek varsa o gösterilir
    if (kind === 'other' && query.has('date')) {
      const backup = await fromBackup(env, cacheKey)
      if (backup) return backup
    }
    const left = Number(res.headers.get('x-ratelimit-requests-remaining'))
    const meta: Meta = { provider, remaining: res.headers.has('x-ratelimit-requests-remaining') && Number.isFinite(left) ? left : null }
    const ttl = kind === 'none' ? rule(query, parsed, meta) : kind === 'plan' ? 6 * HOUR : 0
    if (ttl > 0) await cacheSet(env, cacheKey, body, ttl)
    if (kind === 'none' && query.has('date')) await cacheSet(env, backupKey(cacheKey), body, BACKUP_TTL)
    return { ok: true, body, ttl }
  } catch (err) {
    console.error(`${provider} isteği başarısız:`, err)
    if (query.has('date')) {
      const backup = await fromBackup(env, cacheKey)
      if (backup) return backup
    }
    return { ok: false, status: 502, message: `${provider} şu an yanıt vermiyor.` }
  }
}

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json(405, 'Sadece GET desteklenir.')
  const target = parseTarget(new URL(request.url))
  if (!target) return json(404, 'Bilinmeyen kaynak.')
  const { provider, path, query } = target
  const rule = findRule(provider, path)
  if (!rule) return json(404, 'Bu uç noktaya izin verilmiyor.')

  query.sort() // ?a=1&b=2 ile ?b=2&a=1 aynı önbelleği kullansın
  if (query.toString().length > 300) return json(400, 'Sorgu çok uzun.')
  const cacheKey = `canliskor:v1:${provider}${path}?${query}`

  const hit = await cacheGet(env, cacheKey)
  if (hit) return send(hit.body, Math.max(1, Math.ceil((hit.expiresAt - Date.now()) / 1000)), 'HIT')
  const storedError = provider === 'footballdata' ? await cacheGet(env, `${cacheKey}:error`) : null
  if (storedError) return json(Number(storedError.body), `${provider} HTTP ${storedError.body}`)

  let pending = inflight.get(cacheKey)
  if (!pending) {
    // Önbellekte olmayan (kaynağa gidecek) istekler IP başına dakikada 60 ile sınırlı: biri farklı tarih /
    // oyuncu isteyerek önbelleği atlatıp günlük kotayı bitiremesin
    if (await tooMany(env, `api:${clientIp(request)}`, 60, 60)) return json(429, 'Çok fazla istek, biraz bekle.')
    pending = fetchUpstream(env, provider, path, rule, query, cacheKey).finally(() => inflight.delete(cacheKey))
    inflight.set(cacheKey, pending)
  }
  const result = await pending
  return result.ok ? send(result.body, result.ttl, result.stale ? 'STALE' : 'MISS') : json(result.status, result.message)
}

// Vercel bu fonksiyonu GET /api/proxy için çalıştırır (vercel.json /api/football/... adreslerini buraya yönlendirir)
export function GET(request: Request) {
  return handleApiRequest(request, process.env)
}
