import type { BasketballCareerSeason, BasketballPlayerProfile, BasketballSquadPlayer, BasketballTeamGame, BasketballTeamRef, TeamStatsSummary } from '../types/team'
import { getBasketballGames, getLeagueStandings } from './basketballService'
import { createCache, fetchJson } from './providers/common'
import { sameTeamName, teamIdOf } from '../lib/team'

// Basketbol takım sayfasının veri kapısı. Kendi backend'imiz (api/team.ts): NBA ESPN'den, EuroLeague / EuroCup
// resmi API'den (API-Basketball'un takım kadrosu / maçları ücretsiz planda bu sezon kapalı).
// Takım sayfası sadece bu üç ligde var.

const cached = createCache('bbTeam')
const MIN = 60_000

const SOURCES: Record<string, 'nba' | 'E' | 'U'> = { 'bb-12': 'nba', 'bb-120': 'E', 'bb-194': 'U' }

export const hasBasketballTeamPage = (leagueId: string) => leagueId in SOURCES

const url = (leagueId: string, part: string, team?: string) =>
  `/api/team?league=${SOURCES[leagueId]}&part=${part}${team ? `&team=${encodeURIComponent(team)}` : ''}`

export function getLeagueTeams(leagueId: string): Promise<BasketballTeamRef[]> {
  if (!hasBasketballTeamPage(leagueId)) return Promise.resolve([])
  return cached(`teams:${leagueId}`, 24 * 60 * MIN, async () => (await fetchJson<BasketballTeamRef[]>('Takım', url(leagueId, 'teams'))) ?? [])
}

// Maçtan gelen takım (API-Basketball adı): ligin takımları arasında en iyi eşleşen.
// "Maccabi Tel Aviv" ile "Hapoel Tel Aviv" gibi ortak kelimeli adlarda en çok kelimesi tutan seçilir.
export async function findTeamInLeague(leagueId: string, name: string): Promise<BasketballTeamRef | null> {
  const teams = await getLeagueTeams(leagueId)
  const words = new Set(teamIdOf(name).split('-'))
  const score = (t: BasketballTeamRef) =>
    [t.name, t.shortName ?? ''].reduce((best, n) => Math.max(best, teamIdOf(n).split('-').filter((w) => words.has(w)).length), 0)
  const candidates = teams.filter((t) => sameTeamName(t.name, name) || (t.shortName ? sameTeamName(t.shortName, name) : false))
  return candidates.sort((a, b) => score(b) - score(a))[0] ?? null
}

export function getSquad(leagueId: string, teamId: string): Promise<BasketballSquadPlayer[] | null> {
  return cached(`squad:v3:${leagueId}:${teamId}`, 10 * MIN, () => fetchJson<BasketballSquadPlayer[]>('Kadro', url(leagueId, 'squad', teamId)))
}

export function getFixtures(leagueId: string, teamId: string): Promise<{ past: BasketballTeamGame[]; upcoming: BasketballTeamGame[] } | null> {
  return cached(`fixtures:${leagueId}:${teamId}`, 15 * MIN, () => fetchJson('Maçlar', url(leagueId, 'fixtures', teamId)))
}

// Sezon özeti: puan tablosundaki satırı (tablo zaten NBA'de ESPN'den, EuroLeague'de resmi API'den geliyor)
export async function getTeamStats(leagueId: string, season: string, team: BasketballTeamRef): Promise<TeamStatsSummary | null> {
  const standings = await getLeagueStandings(leagueId, season)
  const rows = standings?.groups.flatMap((g) => g.rows) ?? []
  const row =
    rows.find((r) => r.team.id === `espn-${team.id}` || r.team.id === `el-${team.id}`) ??
    rows.find((r) => sameTeamName(r.team.name, team.name) || (team.shortName ? sameTeamName(r.team.name, team.shortName) : false))
  if (!row) return null
  return { played: row.played, won: row.won, draw: null, lost: row.lost, scored: row.pointsFor, conceded: row.pointsAgainst }
}

// Oyuncu sayfası: profil + sezon sezon kariyer (NBA ESPN, EuroLeague / EuroCup resmi API); 1 gün saklanır
export function getPlayerCareer(leagueId: string, playerId: string): Promise<{ profile: BasketballPlayerProfile; seasons: BasketballCareerSeason[] } | null> {
  if (!hasBasketballTeamPage(leagueId)) return Promise.resolve(null)
  return cached(`player:${leagueId}:${playerId}`, 24 * 60 * MIN, () =>
    fetchJson('Oyuncu', `/api/team?league=${SOURCES[leagueId]}&part=player&player=${encodeURIComponent(playerId)}`),
  )
}

// Arama: EuroLeague / EuroCup'un bu sezonki oyuncuları (NBA oyuncuları ESPN aramasından gelir); 1 gün saklanır
export interface BasketballPersonRef {
  id: string
  name: string
  team: string | null
  photo: string | null
}

export function getLeaguePeople(leagueId: 'bb-120' | 'bb-194'): Promise<BasketballPersonRef[]> {
  return cached(`people:${leagueId}`, 24 * 60 * MIN, async () => (await fetchJson<BasketballPersonRef[]>('Oyuncular', url(leagueId, 'people'))) ?? [])
}

// api/archive.ts'in sakladığı biten maç
interface ArchivedGame {
  id: string
  date: string
  league: string
  home: BasketballTeamGame['home']
  away: BasketballTeamGame['away']
}

// Takımın kendi ligindeki maçları (ör. Fenerbahçe'nin Basketbol Süper Ligi maçları). API-Basketball'un ücretsiz
// planı takım fikstürü vermiyor, sadece dün / bugün / yarının maç listesini veriyor: bu 3 gündeki maçlar +
// her gün arşivlenen son 45 günün sonuçları (api/archive.ts) eklenir.
// Kadın ve alt yaş ligleri ("Fenerbahce W") hariç.
export async function getDomesticGames(leagueId: string, team: BasketballTeamRef): Promise<BasketballTeamGame[]> {
  const days = [-1, 0, 1].map((o) => new Date(Date.now() + o * 24 * 60 * MIN))
  const lists = await Promise.all(days.map((d) => getBasketballGames(d).catch(() => [])))
  // Sıkı eşleştirme: takımın kısa adındaki ayırt edici kelimelerin HEPSİ maçtaki adda geçmeli.
  // "Basket", "BC", "Maccabi" gibi genel kelimeler sayılmaz (yoksa "Valencia Basket" her "... Basket" takımıyla
  // eşleşir). Ayırt edici kelimesi kalmayan takımda (ör. kısa adı sadece "Maccabi") lig maçı aranmaz.
  const GENERIC = new Set(['basket', 'basketball', 'bc', 'bk', 'kk', 'cb', 'sk', 'club', 'maccabi', 'hapoel', 'olympiacos', 'piraeus', 'istanbul', 'tel', 'aviv'])
  const words = (n: string) => teamIdOf(n).split('-').filter((w) => w.length > 1 && !GENERIC.has(w))
  const key = words(team.shortName ?? team.name)
  if (key.length === 0) return []
  const isTeam = (name: string) => {
    const w = words(name)
    return key.every((k) => w.includes(k))
  }
  // Arşiv: son 45 günün biten lig maçları (sunucu aynı sıkı eşleştirmeyi yapar)
  const archived = await fetchJson<{ games: ArchivedGame[] }>(
    'Arşiv',
    `/api/archive?team=${encodeURIComponent(team.shortName ?? team.name)}&exclude=${encodeURIComponent(leagueId)}`,
  ).catch(() => null)
  const fromArchive = (archived?.games ?? []).map(
    (g): BasketballTeamGame => ({ id: g.id, matchId: g.id, date: g.date, competition: g.league, status: 'finished', home: g.home, away: g.away }),
  )
  const recent = lists
    .flat()
    .filter((m) => m.leagueId !== leagueId && !/\b(W|Women|U\d{2})\b/i.test(m.leagueName) && (isTeam(m.homeTeam) || isTeam(m.awayTeam)))
    .map(
      (m): BasketballTeamGame => ({
        id: m.id,
        matchId: m.id,
        date: m.startTime,
        competition: m.leagueName,
        status: m.status === 'finished' ? 'finished' : m.status === 'live' ? 'live' : 'upcoming',
        home: { name: m.homeTeam, logo: m.homeLogo ?? null, score: m.homeScore },
        away: { name: m.awayTeam, logo: m.awayLogo ?? null, score: m.awayScore },
      }),
    )
  // Aynı maç hem arşivde hem son 3 günde olabilir: id'ye göre tek
  const byId = new Map<string, BasketballTeamGame>()
  for (const g of [...fromArchive, ...recent]) byId.set(g.id, g)
  return [...byId.values()]
}
