// Basketbol istatistik liderleri (Vercel fonksiyonu): GET /api/leaders?league=nba|E|U
// Kaynaklar anahtar / kota istemiyor ama büyük: ESPN'in NBA liderleri ~1,2 MB, EuroLeague ~20 KB.
// Burada her kategoride ilk 5 oyuncu sadeleştirilip 1 saat saklanır; tarayıcıya birkaç KB gider.
// Cevap: { categories: [{ key, label, leaders: [{ name, team, teamLogo, photo, value }] }] }

import { cacheGet, cacheSet, type Env } from './_lib/cache.js'
import { getJson } from './_lib/http.js'

const TTL = 60 * 60
const TOP = 5

export interface Leader {
  name: string
  team: string | null
  teamLogo: string | null
  photo: string | null
  value: number
}

export interface LeaderCategory {
  key: string
  label: string
  leaders: Leader[]
}

// ---------- NBA (ESPN) ----------
interface EspnTeam {
  displayName?: string
  logos?: { href: string }[]
}
interface EspnLeaders {
  leaders?: {
    categories?: {
      name: string
      leaders?: { value: number; athlete: { displayName: string; headshot?: { href: string }; team?: EspnTeam }; team?: EspnTeam }[]
    }[]
  }
}

const NBA_CATEGORIES: [string, string][] = [
  ['pointsPerGame', 'Sayı'],
  ['reboundsPerGame', 'Ribaund'],
  ['assistsPerGame', 'Asist'],
  ['stealsPerGame', 'Top çalma'],
  ['blocksPerGame', 'Blok'],
]

async function nbaLeaders(): Promise<LeaderCategory[]> {
  const body = await getJson<EspnLeaders>('https://site.api.espn.com/apis/site/v3/sports/basketball/nba/leaders?limit=5')
  const cats = body.leaders?.categories ?? []
  return NBA_CATEGORIES.flatMap(([key, label]) => {
    const cat = cats.find((c) => c.name === key)
    if (!cat?.leaders?.length) return []
    return [
      {
        key,
        label,
        leaders: cat.leaders.slice(0, TOP).map((l) => {
          const team = l.team ?? l.athlete.team
          return {
            name: l.athlete.displayName,
            team: team?.displayName ?? null,
            teamLogo: team?.logos?.[0]?.href ?? null,
            photo: l.athlete.headshot?.href ?? null,
            value: Math.round(l.value * 10) / 10,
          }
        }),
      },
    ]
  })
}

// ---------- EuroLeague / EuroCup (resmi API) ----------
interface ElLeader {
  details: { name: string; imageUrl?: string; team?: { name: string; imageUrl?: string } }
  average: number
}

const EL_CATEGORIES: [string, string][] = [
  ['points', 'Sayı'],
  ['rebounds', 'Ribaund'],
  ['assists', 'Asist'],
  ['steals', 'Top çalma'],
  ['blocks', 'Blok'],
  ['pir', 'Verimlilik (PIR)'],
]

// "HIFI, NADIR" -> "Nadir Hifi" ("BALDWIN IV, WADE" -> "Wade Baldwin IV")
const elName = (raw: string) => {
  const [last, first] = raw.split(',').map((s) => s.trim().toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase()).replace(/\b(Ii|Iii|Iv)\b/g, (r) => r.toUpperCase()))
  return first ? `${first} ${last}` : last
}

// Ekim'de başlayan sezon "2026"
const elSeason = () => {
  const now = new Date()
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

async function euroleagueLeaders(competition: 'E' | 'U'): Promise<LeaderCategory[]> {
  const q = new URLSearchParams({ seasonMode: 'Single', seasonCode: `${competition}${elSeason()}`, statisticMode: 'PerGame', limit: String(TOP) })
  const body = await getJson<Record<string, ElLeader[] | undefined>>(`https://api-live.euroleague.net/v3/competitions/${competition}/statistics/players/leaders?${q}`)
  return EL_CATEGORIES.flatMap(([key, label]) => {
    const list = body[key]
    if (!list?.length) return []
    return [
      {
        key,
        label,
        leaders: list.slice(0, TOP).map((l) => ({
          name: elName(l.details.name),
          team: l.details.team?.name ?? null,
          teamLogo: l.details.team?.imageUrl ?? null,
          photo: l.details.imageUrl ?? null,
          value: Math.round(l.average * 10) / 10,
        })),
      },
    ]
  })
}

const json = (status: number, body: string, ttl = 0) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': ttl > 0 ? `public, max-age=0, s-maxage=${ttl}` : 'no-store',
    },
  })

export async function handleLeadersRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json(405, JSON.stringify({ message: 'Sadece GET desteklenir.' }))
  const league = new URL(request.url).searchParams.get('league')
  if (league !== 'nba' && league !== 'E' && league !== 'U') return json(400, JSON.stringify({ message: 'league: nba, E ya da U olmalı.' }))
  const key = `canliskor:leaders:v1:${league}`
  const hit = await cacheGet(env, key)
  if (hit) return json(200, hit.body, Math.max(1, Math.ceil((hit.expiresAt - Date.now()) / 1000)))
  try {
    const categories = league === 'nba' ? await nbaLeaders() : await euroleagueLeaders(league)
    const body = JSON.stringify({ categories })
    if (categories.length > 0) await cacheSet(env, key, body, TTL)
    return json(200, body, categories.length > 0 ? TTL : 0)
  } catch (err) {
    console.error('Liderler alınamadı:', err)
    return json(502, JSON.stringify({ message: 'İstatistik liderleri şu an alınamıyor.' }))
  }
}

export function GET(request: Request) {
  return handleLeadersRequest(request, process.env)
}
