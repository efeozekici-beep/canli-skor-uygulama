import type { SearchResults } from '../types/search'
import { MOCK_PLAYERS } from '../data/mockPlayers'
import { mockLeagueList, mockTeamList } from '../data/mockLeagues'
import { knownMatchesForDate } from './matchService'
import { readStore, writeStore } from '../lib/storageCache'
import { teamIdOf } from '../lib/team'

// Aramanın tek veri kapısı. Şimdilik mock + bugünün bilinen maçları arasında arar.
// API-Football'a geçerken searchAll içindeki mockSearch yerine apiFootballSearch.ts'deki fetchSearch kullanılır.

const DAY = 24 * 60 * 60_000
const MAX_PER_GROUP = 5

const norm = (s: string) => s.toLocaleLowerCase('tr').trim()
const cacheKey = (query: string) => `canliskor:search:${norm(query)}`

// Hafıza önbelleği (aynı oturumda tekrar yazılan arama anında gelir)
const memory = new Map<string, SearchResults>()

// İptal edilebilen bekleme: yeni arama gelince eskisi AbortError ile durur
function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Arama iptal edildi', 'AbortError'))
    })
  })
}

function mockSearch(query: string): SearchResults {
  const q = norm(query)
  const known = knownMatchesForDate(new Date())

  // Takımlar: örnek liglerin takımları + bugünün maçlarındaki takımlar (aynı ad bir kez)
  const teams = new Map<string, SearchResults['teams'][number]>()
  for (const t of mockTeamList()) {
    if (norm(t.name).includes(q) && !teams.has(norm(t.name))) teams.set(norm(t.name), { id: teamIdOf(t.name), name: t.name, country: t.country })
  }
  for (const m of known) {
    for (const [name, id, logo] of [[m.homeTeam, m.homeTeamId, m.homeLogo], [m.awayTeam, m.awayTeamId, m.awayLogo]] as const) {
      if (norm(name).includes(q) && !teams.has(norm(name))) teams.set(norm(name), { id: id ?? teamIdOf(name), name, logo, country: m.region })
    }
  }

  // Ligler: bugünün maçlarındaki ligler (gerçek id + logo) + örnek ligler
  const leagues = new Map<string, SearchResults['leagues'][number]>()
  for (const m of known) {
    if (norm(m.leagueName).includes(q) && !leagues.has(norm(m.leagueName))) {
      leagues.set(norm(m.leagueName), { id: m.leagueId, name: m.leagueName, logo: m.leagueLogo, region: m.region })
    }
  }
  for (const l of mockLeagueList()) {
    if (norm(l.name).includes(q) && !leagues.has(norm(l.name))) leagues.set(norm(l.name), { id: l.id, name: l.name, region: l.region })
  }

  // Oyuncular: profili olan örnek oyuncular
  const players = MOCK_PLAYERS.filter(({ profile }) => norm(profile.name).includes(q)).map(({ profile }) => ({
    id: profile.id,
    name: profile.name,
    photo: profile.photo,
    teamName: profile.team?.name ?? null,
    teamLogo: profile.team?.logo,
  }))

  return {
    teams: [...teams.values()].slice(0, MAX_PER_GROUP),
    leagues: [...leagues.values()].slice(0, MAX_PER_GROUP),
    players: players.slice(0, MAX_PER_GROUP),
  }
}

// Önbellekte varsa hemen döndür (bekleme yok); yoksa null
export function peekSearch(query: string): SearchResults | null {
  const key = cacheKey(query)
  return memory.get(key) ?? readStore<SearchResults>(key, DAY, 'local')
}

export async function searchAll(query: string, signal?: AbortSignal): Promise<SearchResults> {
  const cached = peekSearch(query)
  if (cached) return cached
  await wait(300, signal) // mock: gerçek istek gibi kısa bir gecikme
  const results = mockSearch(query)
  const key = cacheKey(query)
  memory.set(key, results)
  writeStore(key, results, 'local')
  return results
}
