import type { LeagueSearchResult, PlayerSearchResult, SearchResults, TeamSearchResult } from '../types/search'
import { apiGet } from './apiFootball'

// API-Football arama uç noktaları ve dönüştürücüleri. Henüz searchService'e bağlı değil (şimdilik mock).
// Not: API arama metninde en az 3 karakter ister.

interface ApiTeamItem {
  team: { id: number; name: string; logo: string; country: string | null }
}
interface ApiLeagueItem {
  league: { id: number; name: string; logo: string }
  country: { name: string | null }
}
interface ApiPlayerProfileItem {
  player: { id: number; name: string; photo: string }
}

export const mapTeams = (items: ApiTeamItem[]): TeamSearchResult[] =>
  items.map(({ team }) => ({ id: String(team.id), name: team.name, logo: team.logo, country: team.country }))

export const mapLeagues = (items: ApiLeagueItem[]): LeagueSearchResult[] =>
  items.map(({ league, country }) => ({ id: String(league.id), name: league.name, logo: league.logo, region: country.name }))

// /players/profiles güncel takımı vermez; teamName null kalır.
export const mapPlayers = (items: ApiPlayerProfileItem[]): PlayerSearchResult[] =>
  items.map(({ player }) => ({ id: String(player.id), name: player.name, photo: player.photo, teamName: null }))

// Üç arama tek seferde (3 istek). signal: yeni arama gelince eski istekler iptal edilir.
export async function fetchSearch(query: string, signal?: AbortSignal): Promise<SearchResults> {
  const q = encodeURIComponent(query)
  // Bir grup hata verirse (ör. plan kısıtı) diğerleri yine gösterilsin: boş liste say
  const safe = <T>(p: Promise<T[]>) =>
    p.catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      return [] as T[]
    })
  const [teams, leagues, players] = await Promise.all([
    safe(apiGet<ApiTeamItem[]>(`/teams?search=${q}`, signal)),
    safe(apiGet<ApiLeagueItem[]>(`/leagues?search=${q}`, signal)),
    safe(apiGet<ApiPlayerProfileItem[]>(`/players/profiles?search=${q}`, signal)),
  ])
  return { teams: mapTeams(teams), leagues: mapLeagues(leagues), players: mapPlayers(players) }
}
