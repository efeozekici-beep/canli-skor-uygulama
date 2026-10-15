import type { Match } from '../types/match'
import type { BasketballStandings, NbaDetailResult, NbaPlayerProfile } from '../types/basketball'
import type { StatItem } from '../types/matchDetail'
import * as apiBasketball from './providers/apiBasketball'
import * as apiNba from './providers/apiNba'
import type { NbaGameRef } from './providers/apiNba'
import { addDays } from '../lib/date'

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

export function getBasketballStandings(match: Match): Promise<BasketballStandings | null> {
  const season = match.basketball?.season
  if (!season) return Promise.resolve(null)
  return apiBasketball.getStandings(match.leagueId, season)
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
