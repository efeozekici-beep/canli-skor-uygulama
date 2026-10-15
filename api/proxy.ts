// CanlıSkor backend'i (Vercel fonksiyonu).
// Tarayıcı /api/football/..., /api/basketball/..., /api/nba/... ister; burası isteği API anahtarıyla
// API-Sports'a iletir ve cevabı Redis'te (Upstash) saklar. Böylece:
//  - anahtar tarayıcıya hiç gitmez,
//  - aynı veriyi isteyen bütün kullanıcılar tek istek (tek kota) harcar.
// Yerelde (npm run dev) aynı kod vite.config.ts içinden çalışır; Redis yoksa hafızada saklar.

type Env = Record<string, string | undefined>

const PROVIDERS = {
  football: { host: 'https://v3.football.api-sports.io', keyName: 'API_FOOTBALL_KEY' },
  basketball: { host: 'https://v1.basketball.api-sports.io', keyName: 'API_BASKETBALL_KEY' },
  nba: { host: 'https://v2.nba.api-sports.io', keyName: 'API_NBA_KEY' },
} as const
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

// Tarihli maç listesi: bugün ve dün 1-5 dk (gece yarısını geçen maçlar sürebilir),
// daha eski günler 6 saat, gelecek günler 30 dk
function dateTtl(q: URLSearchParams) {
  const date = q.get('date') ?? ''
  const today = todayIn(q.get('timezone') ?? 'UTC')
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - DAY * 1000).toISOString().slice(0, 10)
  if (date === today) return MIN
  if (date === yesterday) return 5 * MIN
  return date < today ? 6 * HOUR : 30 * MIN
}

// Bitmiş (veya iptal/ertelenmiş) futbol maçı durumları: veri artık değişmez
const FOOTBALL_DONE = new Set(['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'])

function footballFixturesTtl(q: URLSearchParams, body: unknown) {
  if (q.has('date')) return dateTtl(q)
  if (q.has('id')) {
    // Maç detayı: bittiyse 7 gün, başlamadıysa 5 dk, canlıysa 1 dk
    const status = (body as { response?: { fixture?: { status?: { short?: string } } }[] }).response?.[0]?.fixture?.status?.short
    if (status && FOOTBALL_DONE.has(status)) return 7 * DAY
    return status === 'NS' || status === 'TBD' ? 5 * MIN : MIN
  }
  return 5 * MIN // lig fikstürü
}

type Rule = (q: URLSearchParams, body: unknown) => number
const fixed = (seconds: number): Rule => () => seconds

// Sadece burada listelenen uç noktalara izin verilir: backend herkesin kullanabileceği açık bir proxy olmasın
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
  },
  basketball: {
    '/games': dateTtl,
    '/games/statistics/teams': fixed(2 * MIN),
    '/games/statistics/players': fixed(2 * MIN),
    '/standings': fixed(HOUR),
  },
  nba: {
    '/games': dateTtl, // API-NBA tarihi UTC'dir (timezone parametresi yok -> UTC)
    '/players/statistics': fixed(2 * MIN),
    '/players': fixed(7 * DAY),
  },
}

// API-Sports hataları HTTP 200 ile gelir: { errors: { plan: "..." } } gibi
function errorKind(body: unknown): 'none' | 'plan' | 'other' {
  const errors = (body as { errors?: unknown[] | Record<string, string> } | null)?.errors
  if (!errors) return 'none'
  if (Array.isArray(errors)) return errors.length > 0 ? 'other' : 'none'
  if ('plan' in errors) return 'plan'
  return Object.keys(errors).length > 0 ? 'other' : 'none'
}

// ---------- Önbellek: Upstash Redis, yoksa hafıza ----------

interface Entry {
  expiresAt: number
  body: string
}

const memory = new Map<string, Entry>()

// Vercel'in Upstash entegrasyonu KV_* adlarını da kullanabiliyor; ikisi de kabul
function redisConfig(env: Env) {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN
  return url && token ? { url, token } : null
}

async function redis(cfg: { url: string; token: string }, command: (string | number)[]) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`)
  return ((await res.json()) as { result: unknown }).result
}

async function cacheGet(env: Env, key: string): Promise<Entry | null> {
  const cfg = redisConfig(env)
  if (!cfg) {
    const hit = memory.get(key)
    return hit && hit.expiresAt > Date.now() ? hit : null
  }
  try {
    const raw = await redis(cfg, ['GET', key])
    return typeof raw === 'string' ? (JSON.parse(raw) as Entry) : null
  } catch (err) {
    // Redis çökerse site durmasın: doğrudan API'den devam
    console.error('Redis okunamadı:', err)
    return null
  }
}

async function cacheSet(env: Env, key: string, entry: Entry, ttl: number) {
  const cfg = redisConfig(env)
  if (!cfg) {
    // Hafıza şişmesin: arada süresi dolanları temizle
    if (memory.size > 500) for (const [k, v] of memory) if (v.expiresAt <= Date.now()) memory.delete(k)
    memory.set(key, entry)
    return
  }
  try {
    await redis(cfg, ['SET', key, JSON.stringify(entry), 'EX', ttl])
  } catch (err) {
    console.error('Redis yazılamadı:', err)
  }
}

// ---------- İstek ----------

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

function send(body: string, ttl: number, cache: 'HIT' | 'MISS') {
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
  const m = url.pathname.match(/^\/api\/(football|basketball|nba)(\/.*)$/)
  if (m) {
    provider = m[1]
    path = m[2]
  } else if (path) {
    path = `/${path.replace(/^\/+/, '')}`
  }
  if (!provider || !path || !Object.hasOwn(PROVIDERS, provider)) return null
  return { provider: provider as Provider, path, query }
}

type Result = { ok: true; body: string; ttl: number } | { ok: false; status: number; message: string }

// Aynı anda gelen aynı istekler tek API çağrısını paylaşır
const inflight = new Map<string, Promise<Result>>()

async function fetchUpstream(env: Env, provider: Provider, path: string, query: URLSearchParams, cacheKey: string): Promise<Result> {
  const { host, keyName } = PROVIDERS[provider]
  const apiKey = env[keyName]
  if (!apiKey) return { ok: false, status: 500, message: `${keyName} tanımlı değil.` }
  const qs = query.toString()
  try {
    const res = await fetch(`${host}${path}${qs ? `?${qs}` : ''}`, {
      headers: { 'x-apisports-key': apiKey },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false, status: 502, message: `API-Sports HTTP ${res.status}` }
    const body = await res.text()
    const parsed: unknown = JSON.parse(body)
    // Plan hatası kalıcıdır (6 saat sakla, kota harcanmasın); kota/anahtar hatası saklanmaz
    const kind = errorKind(parsed)
    const ttl = kind === 'none' ? RULES[provider][path](query, parsed) : kind === 'plan' ? 6 * HOUR : 0
    if (ttl > 0) await cacheSet(env, cacheKey, { expiresAt: Date.now() + ttl * 1000, body }, ttl)
    return { ok: true, body, ttl }
  } catch (err) {
    console.error('API-Sports isteği başarısız:', err)
    return { ok: false, status: 502, message: 'API-Sports şu an yanıt vermiyor.' }
  }
}

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json(405, 'Sadece GET desteklenir.')
  const target = parseTarget(new URL(request.url))
  if (!target) return json(404, 'Bilinmeyen kaynak.')
  const { provider, path, query } = target
  if (!Object.hasOwn(RULES[provider], path)) return json(404, 'Bu uç noktaya izin verilmiyor.')

  query.sort() // ?a=1&b=2 ile ?b=2&a=1 aynı önbelleği kullansın
  if (query.toString().length > 300) return json(400, 'Sorgu çok uzun.')
  const cacheKey = `canliskor:v1:${provider}${path}?${query}`

  const hit = await cacheGet(env, cacheKey)
  if (hit) return send(hit.body, Math.max(1, Math.ceil((hit.expiresAt - Date.now()) / 1000)), 'HIT')

  let pending = inflight.get(cacheKey)
  if (!pending) {
    pending = fetchUpstream(env, provider, path, query, cacheKey).finally(() => inflight.delete(cacheKey))
    inflight.set(cacheKey, pending)
  }
  const result = await pending
  return result.ok ? send(result.body, result.ttl, 'MISS') : json(result.status, result.message)
}

// Vercel bu fonksiyonu GET /api/proxy için çalıştırır (vercel.json /api/football/... adreslerini buraya yönlendirir)
export function GET(request: Request) {
  return handleApiRequest(request, process.env)
}
