// Oyuncu fotoğrafı bulucu (Vercel fonksiyonu): GET /api/photos?league=nba&names=Luka Doncic|LeBron James
// league: nba | basketball | football-coach (futbol teknik direktörü: API-Football çoğunda boş yer tutucu resim veriyor)
// API-NBA ve API-Basketball fotoğraf vermediği için isimleri ücretsiz resmi/açık kaynaklarla eşleştirir:
//  - NBA: ESPN kadroları (30 takım, günde bir kez çekilir)
//  - EuroLeague / EuroCup: EuroLeague'in resmi API'si (günde bir kez)
//  - Bulunamayanlar: Wikipedia (oyuncu başına, 30 gün saklanır; bulunamadıysa 7 gün)
// Cevap: { photos: { "Luka Doncic": "https://...", "Bilinmeyen Oyuncu": null } }

import { cacheGet, cacheSet, type Env } from './_lib/cache.js'

const DAY = 24 * 60 * 60
const PREFIX = 'canliskor:photos:v1'
// Wikipedia kimin istek attığını bilmek istiyor (kurallarında var). ESPN bu biçimi engellediği için sadece Wikipedia'ya gönderilir.
const USER_AGENT = 'CanliSkor/1.0 (https://canli-skor-uygulama.vercel.app)'

// ---------- İsim eşleştirme ----------

// "Dončić, LUKA" -> ["doncic", "luka"]; Türkçe ı/İ ve birkaç özel harf de sadeleşir
export function nameTokens(name: string) {
  return name
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/[øØ]/g, 'o')
    .replace(/[łŁ]/g, 'l')
    .replace(/[đĐ]/g, 'd')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, ' ')
    .split(/[^a-z]+/)
    .filter(Boolean)
}

// Fotoğraf listesi: [isim parçaları, fotoğraf adresi]
type PhotoIndex = [string[], string][]

// "S. Larkin" ya da "Larkin Shane" gibi farklı yazımları da tanır. Tek ve kesin aday yoksa null:
// yanlış kişinin fotoğrafını göstermektense baş harf göstermek daha iyi.
export function findInIndex(name: string, index: PhotoIndex): string | null {
  const tokens = nameTokens(name)
  const full = tokens.filter((t) => t.length > 1)
  const initials = tokens.filter((t) => t.length === 1)
  if (full.length === 0) return null
  const candidates = index.filter(
    ([entry]) => full.every((t) => entry.includes(t)) && initials.every((i) => entry.some((e) => e.startsWith(i))),
  )
  if (candidates.length === 1) return candidates[0][1]
  // Birden fazla aday: isim parça sayısı tam tutan tek aday varsa onu seç
  const exact = candidates.filter(([entry]) => entry.length === tokens.length)
  return exact.length === 1 ? exact[0][1] : null
}

// ---------- Kaynaklar ----------

async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`)
  return (await res.json()) as T
}

interface EspnTeams {
  sports: { leagues: { teams: { team: { id: string } }[] }[] }[]
}
interface EspnRoster {
  athletes: { displayName: string; headshot?: { href: string } }[]
}

// ESPN'in küçültme servisi: 200 KB yerine ~20 KB
const espnSmall = (href: string) => `https://a.espncdn.com/combiner/i?img=${new URL(href).pathname}&w=160&h=116`

async function buildNbaIndex(): Promise<PhotoIndex> {
  const teams = await getJson<EspnTeams>('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams')
  const ids = teams.sports[0]?.leagues[0]?.teams.map((t) => t.team.id) ?? []
  // Bir takım hata verirse diğerleri yine kullanılır
  const rosters = await Promise.allSettled(
    ids.map((id) => getJson<EspnRoster>(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}/roster`)),
  )
  const index: PhotoIndex = []
  for (const r of rosters) {
    if (r.status !== 'fulfilled') continue
    for (const a of r.value.athletes) if (a.headshot?.href) index.push([nameTokens(a.displayName), espnSmall(a.headshot.href)])
  }
  return index
}

interface EuroleaguePeople {
  data: { person: { name: string; alias?: string }; images?: { headshot?: string } }[]
}

// EuroLeague sezonu: Ekim 2026'da başlayan sezon "2026"
const euroleagueSeason = () => {
  const now = new Date()
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

async function buildEuroleagueIndex(): Promise<PhotoIndex> {
  const season = euroleagueSeason()
  // E: EuroLeague, U: EuroCup
  const lists = await Promise.allSettled(
    ['E', 'U'].map((c) => getJson<EuroleaguePeople>(`https://api-live.euroleague.net/v2/competitions/${c}/seasons/${c}${season}/people?personType=J`)),
  )
  const index: PhotoIndex = []
  for (const l of lists) {
    if (l.status !== 'fulfilled') continue
    for (const p of l.value.data) {
      const photo = p.images?.headshot
      if (photo) index.push([nameTokens(p.person.alias ?? p.person.name), photo])
    }
  }
  return index
}

// Liste günde bir kez kurulur ve önbellekte saklanır. Kaynak tamamen boş dönerse saklanmaz (sonra tekrar denenir).
async function getIndex(env: Env, name: string, build: () => Promise<PhotoIndex>): Promise<PhotoIndex> {
  const key = `${PREFIX}:index:${name}`
  const hit = await cacheGet(env, key)
  if (hit) return JSON.parse(hit.body) as PhotoIndex
  try {
    const index = await build()
    if (index.length > 0) await cacheSet(env, key, JSON.stringify(index), DAY)
    return index
  } catch (err) {
    console.error(`${name} fotoğraf listesi alınamadı:`, err)
    return []
  }
}

interface WikiSearch {
  query?: { pages: { title: string; index: number; description?: string; thumbnail?: { source: string } }[] }
}

// Spora göre Wikipedia araması: arama sözcüğü + sayfa açıklamasında aranacak kelimeler (hepsi geçmeli)
const WIKI_SEARCH = {
  basketball: { query: 'basketball', mustMatch: [/basketball/i] },
  // Aynı isimde birçok futbolcu olabiliyor: açıklamada hem futbol hem teknik direktör/antrenör geçmeli
  'football-coach': { query: 'football manager', mustMatch: [/football|soccer/i, /manager|coach/i] },
}
type WikiSport = keyof typeof WIKI_SEARCH

// Wikipedia'da "<isim> <spor>" araması. Sadece açıklaması spora uyan ve
// başlığı isimle tutan sayfa kabul edilir (ör. "Shane Larkin" ararken beyzbolcu Barry Larkin elenir).
async function wikipediaPhoto(name: string, sport: WikiSport): Promise<string | null> {
  const tokens = nameTokens(name)
  if (tokens.length < 2 || tokens.some((t) => t.length === 1)) return null // baş harfle arama güvenilmez
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: `${name} ${WIKI_SEARCH[sport].query}`,
    gsrlimit: '3',
    prop: 'pageimages|description',
    piprop: 'thumbnail',
    pithumbsize: '160',
  })
  const body = await getJson<WikiSearch>(`https://en.wikipedia.org/w/api.php?${params}`, { 'user-agent': USER_AGENT })
  const pages = (body.query?.pages ?? []).sort((a, b) => a.index - b.index)
  const page = pages.find((p) => {
    const title = nameTokens(p.title.replace(/\(.*\)/, ''))
    return p.thumbnail && WIKI_SEARCH[sport].mustMatch.every((re) => re.test(p.description ?? '')) && tokens.every((t) => title.includes(t))
  })
  return page?.thumbnail?.source ?? null
}

async function cachedWikipediaPhoto(env: Env, name: string, sport: WikiSport): Promise<string | null> {
  const key = `${PREFIX}:wiki:${sport === 'basketball' ? '' : `${sport}:`}${nameTokens(name).join('-')}`
  const hit = await cacheGet(env, key)
  if (hit) return hit.body || null
  try {
    const photo = await wikipediaPhoto(name, sport)
    await cacheSet(env, key, photo ?? '', photo ? 30 * DAY : 7 * DAY)
    return photo
  } catch (err) {
    console.error('Wikipedia isteği başarısız:', err)
    return null // hata saklanmaz, sonra tekrar denenir
  }
}

// ---------- İstek ----------

const json = (status: number, body: unknown, maxAge = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAge > 0 ? `public, max-age=${maxAge}, s-maxage=${maxAge}` : 'no-store',
    },
  })

export async function handlePhotosRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json(405, { message: 'Sadece GET desteklenir.' })
  const url = new URL(request.url)
  const league = url.searchParams.get('league')
  if (league !== 'nba' && league !== 'basketball' && league !== 'football-coach') {
    return json(400, { message: 'league: nba, basketball ya da football-coach olmalı.' })
  }
  const names = [...new Set((url.searchParams.get('names') ?? '').split('|').map((n) => n.trim()).filter(Boolean))]
  if (names.length === 0 || names.length > 40 || names.some((n) => n.length > 60)) {
    return json(400, { message: 'names: 1-40 isim, "|" ile ayrılmış.' })
  }

  const index: PhotoIndex =
    league === 'nba' ? await getIndex(env, 'nba', buildNbaIndex) : league === 'basketball' ? await getIndex(env, 'euroleague', buildEuroleagueIndex) : []
  const sport: WikiSport = league === 'football-coach' ? 'football-coach' : 'basketball'
  const entries = await Promise.all(
    names.map(async (name) => [name, findInIndex(name, index) ?? (await cachedWikipediaPhoto(env, name, sport))] as const),
  )
  // Tarayıcı ve Vercel CDN 1 gün saklasın
  return json(200, { photos: Object.fromEntries(entries) }, DAY)
}

export function GET(request: Request) {
  return handlePhotosRequest(request, process.env)
}
