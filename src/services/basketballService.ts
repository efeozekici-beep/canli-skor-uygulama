import type { Match } from '../types/match'
import type { BasketballStandings, NbaDetailResult, NbaPlayerProfile } from '../types/basketball'
import type { StatItem } from '../types/matchDetail'
import * as apiBasketball from './providers/apiBasketball'
import * as apiNba from './providers/apiNba'
import type { NbaGameRef } from './providers/apiNba'
import { addDays } from '../lib/date'
import { getEuroleagueStandings, getNbaStandings } from './providers/basketballStandings'
import { getEuroleagueCareer, getNbaCareer, type BasketballSeasonLine } from './providers/basketballCareer'

// Basketbolun tek veri kapısı. Bileşenler hangi API'den geldiğini bilmez.
//  - Liste, canlı skor, puan durumu: API-Basketball (NBA dahil bütün ligler; maçlar çift görünmez)
//  - NBA maç detayı (box score, oyuncu): API-NBA — sadece istendiğinde (lazy)
// Bir API hata verirse diğerinin verisi etkilenmez: her çağrı kendi kaynağına gider.

const NBA_LEAGUE_ID = 'bb-12'

export const isNbaMatch = (match: Match) => match.leagueId === NBA_LEAGUE_ID

export const getBasketballGames = (date: Date) => apiBasketball.getGames(date)

// Maç sayfası doğrudan açıldığında (yenileme) maçı bul: dün, bugün, yarın listelerine bakar (önbellekten gelir)
export async function findBasketballGame(id: string): Promise<Match | null> {
  for (const offset of [0, -1, 1]) {
    try {
      const games = await apiBasketball.getGames(addDays(new Date(), offset))
      const found = games.find((g) => g.id === id)
      if (found) return found
    } catch {
      // O günün listesi alınamadıysa diğer günlere bakmaya devam et
    }
  }
  return null
}

// Puan durumu: API-Basketball'un ücretsiz planı bu sezonu vermediği için NBA ESPN'den,
// EuroLeague ve EuroCup resmi API'lerinden; diğer ligler API-Basketball'dan
export function getBasketballStandings(match: Match): Promise<BasketballStandings | null> {
  const season = match.basketball?.season
  if (!season) return Promise.resolve(null)
  return getLeagueStandings(match.leagueId, season)
}

// Lig sayfası için: lig id'si ("bb-12") ve API-Basketball sezon biçimi ("2026-2027" ya da "2026")
export function getLeagueStandings(leagueId: string, season: string): Promise<BasketballStandings | null> {
  if (leagueId === NBA_LEAGUE_ID) return getNbaStandings(leagueId, season)
  if (leagueId === 'bb-120') return getEuroleagueStandings('E', leagueId, season)
  if (leagueId === 'bb-194') return getEuroleagueStandings('U', leagueId, season)
  return apiBasketball.getStandings(leagueId, season)
}

// ---------- İki kaynaktaki maçı eşleştirme (ID'ler farklı) ----------
// Takım adının son kelimesi (lakap) karşılaştırılır: "Los Angeles Lakers" ~ "LA Lakers" ~ "Lakers"
const nickname = (name: string) =>
  name
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .pop() ?? ''

const sameTeam = (a: string, b: string) => nickname(a) === nickname(b)

function findNbaGame(match: Match, games: NbaGameRef[]): NbaGameRef | null {
  const start = new Date(match.startTime).getTime()
  return (
    games.find(
      (g) =>
        // Ev/deplasman aynı ve başlama saatleri en fazla 12 saat farklı (saat dilimi farklarına tolerans)
        sameTeam(g.homeName, match.homeTeam) &&
        sameTeam(g.awayName, match.awayTeam) &&
        Math.abs(new Date(g.start).getTime() - start) < 12 * 60 * 60_000,
    ) ?? null
  )
}

// NBA box score: önce o günün API-NBA maçlarında eşini bul, sonra istatistikleri çek.
// Eşleşme ya da istatistik yoksa hata değil { kind: 'no-match' } döner.
export async function getNbaDetail(match: Match): Promise<NbaDetailResult> {
  if (!isNbaMatch(match)) return { kind: 'no-match' }
  // API-NBA tarihleri UTC'dir
  const games = await apiNba.getGamesByDate(new Date(match.startTime).toISOString().slice(0, 10))
  const nbaGame = findNbaGame(match, games)
  if (!nbaGame) return { kind: 'no-match' }
  const box = await apiNba.getBoxScore(nbaGame)
  return box ? { kind: 'matched', box } : { kind: 'no-match' }
}

export const getNbaPlayerProfile = (id: string): Promise<NbaPlayerProfile | null> => apiNba.getPlayer(id)

// Takım istatistikleri (bütün ligler, API-Basketball)
export const getBasketballTeamStats = (match: Match): Promise<StatItem[] | null> => apiBasketball.getTeamStats(match)

// Box score: NBA maçlarında API-NBA (eşleştirmeyle), diğer liglerde API-Basketball oyuncu istatistikleri
export async function getBasketballBoxScore(match: Match): Promise<NbaDetailResult> {
  if (isNbaMatch(match)) return getNbaDetail(match)
  const box = await apiBasketball.getPlayerStats(match)
  return box ? { kind: 'matched', box } : { kind: 'no-match' }
}

// ---------- Oyuncu geçmişi ----------
// Box score'daki oyuncunun sezon sezon ortalamaları: NBA'de ESPN, EuroLeague / EuroCup'ta resmi API.
// Diğer liglerde kaynak yok (null).
export type CareerSource = { kind: 'nba'; teamName: string } | { kind: 'euroleague'; competition: 'E' | 'U' }

export function careerSourceFor(match: Match, teamName: string): CareerSource | null {
  if (isNbaMatch(match)) return { kind: 'nba', teamName }
  if (match.leagueId === 'bb-120') return { kind: 'euroleague', competition: 'E' }
  if (match.leagueId === 'bb-194') return { kind: 'euroleague', competition: 'U' }
  return null
}

export function getBasketballCareer(name: string, source: CareerSource): Promise<BasketballSeasonLine[] | null> {
  return source.kind === 'nba' ? getNbaCareer(name, source.teamName) : getEuroleagueCareer(name, source.competition)
}

// ---------- İstatistik liderleri (lig sayfası) ----------
// Kendi backend'imiz (api/leaders.ts): NBA ESPN'den, EuroLeague / EuroCup resmi API'den; ilk 5, maç başı ortalama
export interface BasketballLeader {
  name: string
  team: string | null
  teamLogo: string | null
  photo: string | null
  value: number
}
export interface BasketballLeaderCategory {
  key: string
  label: string
  leaders: BasketballLeader[]
}

const LEADER_SOURCES: Record<string, string> = { 'bb-12': 'nba', 'bb-120': 'E', 'bb-194': 'U' }

export async function getBasketballLeaders(leagueId: string): Promise<BasketballLeaderCategory[] | null> {
  const league = LEADER_SOURCES[leagueId]
  if (!league) return null
  const res = await fetch(`/api/leaders?league=${league}`)
  if (!res.ok) return null
  return ((await res.json()) as { categories: BasketballLeaderCategory[] }).categories
}
