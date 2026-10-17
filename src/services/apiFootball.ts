import type { Match, MatchStatus } from '../types/match'
import { COUNTRY_TR, compareLeagues } from '../lib/leagueOrder'

// Shape of the parts of an API-Football /fixtures item we use.
export interface ApiFixture {
  fixture: {
    id: number
    date: string
    referee?: string | null
    venue?: { name: string | null; city: string | null }
    status: { short: string; elapsed: number | null; extra: number | null }
  }
  league: { id: number; name: string; country: string; logo: string; season?: number; round?: string }
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } }
  goals: { home: number | null; away: number | null }
}

interface ApiResponse<T> {
  errors: unknown[] | Record<string, string>
  response: T
}

// Thrown when the free plan blocks a request (e.g. current-season standings).
export class ApiPlanError extends Error {}

// Every API-Football call goes through here: the dev-server proxy adds the key.
// `signal` lets a caller cancel the request (e.g. a newer search replaces an older one).
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api/football${path}`, { signal })
  if (!res.ok) throw new Error(`API-Football isteği başarısız (HTTP ${res.status}).`)

  const body = (await res.json()) as ApiResponse<T>
  // API-Football reports problems (bad key, daily limit, plan limits) with HTTP 200 and an errors object.
  if (!Array.isArray(body.errors) && body.errors.plan) {
    throw new ApiPlanError('Ücretsiz API-Football planı bu veriye erişim vermiyor (bu sezonun puan durumu ve takım geçmişi ücretli planda).')
  }
  const errors = Array.isArray(body.errors) ? body.errors : Object.values(body.errors)
  if (errors.length > 0) throw new Error(`API-Football: ${errors.join(' ')}`)
  return body.response
}

const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])
const FINISHED = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'])

const STATUS_LABELS: Record<string, string> = {
  HT: 'İY',
  BT: 'ARA',
  P: 'PEN',
  SUSP: 'DUR',
  INT: 'DUR',
  AET: 'UZ',
  PEN: 'PEN',
  PST: 'ERT',
  CANC: 'İPT',
  ABD: 'YRD',
  AWD: 'HÜK',
  WO: 'HÜK',
}

// Listede varsayılan olarak açık gelen ligler (sırayı src/lib/leagueOrder.ts belirler)
const FEATURED_LEAGUES = [2, 3, 848, 203, 206, 204, 39, 140, 135, 78, 61, 1, 4, 5, 10]


function toStatus(short: string): MatchStatus {
  if (LIVE.has(short)) return 'live'
  if (FINISHED.has(short)) return 'finished'
  return 'upcoming'
}

export function toMatch(item: ApiFixture): Match {
  const { fixture, league, teams, goals } = item
  const status = toStatus(fixture.status.short)
  const { elapsed, extra } = fixture.status
  let statusLabel = STATUS_LABELS[fixture.status.short]
  if (!statusLabel && status === 'live' && elapsed !== null) statusLabel = extra ? `${elapsed}+${extra}'` : `${elapsed}'`

  return {
    id: String(fixture.id),
    sport: 'football',
    leagueId: String(league.id),
    leagueName: league.name,
    leagueLogo: league.logo,
    region: league.name.startsWith('UEFA') ? 'Avrupa' : (COUNTRY_TR[league.country] ?? league.country),
    featured: FEATURED_LEAGUES.includes(league.id),
    homeTeam: teams.home.name,
    awayTeam: teams.away.name,
    homeTeamId: String(teams.home.id),
    awayTeamId: String(teams.away.id),
    homeLogo: teams.home.logo,
    awayLogo: teams.away.logo,
    homeScore: goals.home,
    awayScore: goals.away,
    status,
    minute: status === 'live' ? elapsed : null,
    statusLabel,
    startTime: fixture.date,
    season: league.season,
  }
}

function ymd(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const userTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export async function fetchFixtures(date: Date): Promise<Match[]> {
  const fixtures = await apiGet<ApiFixture[]>(`/fixtures?date=${ymd(date)}&timezone=${encodeURIComponent(userTimezone())}`)
  return fixtures
    .map(toMatch)
    // Ligler güç sırasına göre (Türkiye en üstte, src/lib/leagueOrder.ts), lig içinde başlama saatine göre
    .sort((a, b) => compareLeagues(a, b) || a.startTime.localeCompare(b.startTime))
}
