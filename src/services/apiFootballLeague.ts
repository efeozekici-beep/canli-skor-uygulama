import type { Match } from '../types/match'
import type { LeagueStandingRow, LeagueStandings, PlayerStatEntry, PlayerStatKind, StandingSplit } from '../types/league'
import { apiGet, toMatch, userTimezone, type ApiFixture } from './apiFootball'

// API-Football lig uç noktaları ve dönüştürücüleri (mapper).
// Bileşenler API formatını bilmez; burada uygulamanın tiplerine çevrilir.
// Henüz leagueService'e bağlı değil (şimdilik mock). Not: ücretsiz planda "season" parametresi
// sadece 2022–2024 için açık; güncel sezon ücretli planda çalışır.

// ---------- /standings ----------
interface ApiSplit {
  played: number
  win: number
  draw: number
  lose: number
  goals: { for: number; against: number }
}

interface ApiStandingRow {
  rank: number
  team: { id: number; name: string; logo: string }
  points: number
  goalsDiff: number
  group: string
  form: string | null
  description: string | null
  all: ApiSplit
  home: ApiSplit
  away: ApiSplit
}

const toSplit = (s: ApiSplit): StandingSplit => ({
  played: s.played,
  win: s.win,
  draw: s.draw,
  lose: s.lose,
  goalsFor: s.goals.for,
  goalsAgainst: s.goals.against,
})

export function mapStandings(
  response: { league: { standings: ApiStandingRow[][] } }[],
  leagueId: string,
  season: number,
): LeagueStandings | null {
  const groups = response[0]?.league.standings ?? []
  if (groups.length === 0) return null
  return {
    leagueId,
    season,
    // API her grubu ayrı dizi olarak verir (Dünya Kupası: Grup A, Grup B...)
    groups: groups.map((rows) => ({
      name: rows[0]?.group ?? '',
      rows: rows.map(
        (r): LeagueStandingRow => ({
          rank: r.rank,
          team: { id: String(r.team.id), name: r.team.name, logo: r.team.logo },
          points: r.points,
          goalsDiff: r.goalsDiff,
          // Uygulama formu eskiden yeniye gösterir. API'nin sırası henüz doğrulanmadı:
          // ilk bağlantıda kontrol et, en yeni maç soldaysa burada ters çevir.
          form: r.form,
          description: r.description,
          all: toSplit(r.all),
          home: toSplit(r.home),
          away: toSplit(r.away),
        }),
      ),
    })),
  }
}

export async function fetchLeagueStandings(leagueId: string, season: number) {
  const response = await apiGet<{ league: { standings: ApiStandingRow[][] } }[]>(`/standings?league=${leagueId}&season=${season}`)
  return mapStandings(response, leagueId, season)
}

// ---------- /players/topscorers, topassists, topyellowcards, topredcards ----------
interface ApiTopPlayer {
  player: { id: number; name: string; photo: string }
  statistics: {
    team: { id: number; name: string; logo: string }
    goals: { total: number | null; assists: number | null }
    cards: { yellow: number | null; red: number | null }
  }[]
}

const ENDPOINTS: Record<PlayerStatKind, string> = {
  goals: 'topscorers',
  assists: 'topassists',
  yellow: 'topyellowcards',
  red: 'topredcards',
}

export function mapTopPlayers(response: ApiTopPlayer[], kind: PlayerStatKind): PlayerStatEntry[] {
  return response.map(({ player, statistics }) => {
    const s = statistics[0]
    const value = { goals: s?.goals.total, assists: s?.goals.assists, yellow: s?.cards.yellow, red: s?.cards.red }[kind] ?? 0
    return {
      playerId: String(player.id),
      name: player.name,
      photo: player.photo,
      team: { id: String(s?.team.id ?? ''), name: s?.team.name ?? '', logo: s?.team.logo },
      value,
    }
  })
}

export async function fetchTopPlayers(leagueId: string, season: number, kind: PlayerStatKind) {
  const response = await apiGet<ApiTopPlayer[]>(`/players/${ENDPOINTS[kind]}?league=${leagueId}&season=${season}`)
  return mapTopPlayers(response, kind)
}

// ---------- /fixtures (lig + sezon) ----------
export async function fetchLeagueFixtures(leagueId: string, season: number): Promise<Match[]> {
  const fixtures = await apiGet<ApiFixture[]>(`/fixtures?league=${leagueId}&season=${season}&timezone=${encodeURIComponent(userTimezone())}`)
  return fixtures.map(toMatch)
}
