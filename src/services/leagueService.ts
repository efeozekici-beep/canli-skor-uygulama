import type { Match } from '../types/match'
import type { FixtureKind, LeagueInfo, LeagueStandings, PlayerStatEntry, PlayerStatKind } from '../types/league'
import { mockFixtures, mockLeagueInfo, mockPlayerStats, mockStandings } from '../data/mockLeagues'
import { MOCK_MATCHES } from '../data/mockMatches'
import { knownMatchesForDate, registerMatches } from './matchService'
import { readStore, writeStore } from '../lib/storageCache'
import { currentSeasonFor } from '../lib/league'
import { matchTeamIds, teamIdOf } from '../lib/team'

// Lig sayfasının tek veri kapısı. Bileşenler sadece bu fonksiyonları çağırır.
// Şimdilik mock döndürür (src/data/mockLeagues.ts). API-Football'a geçerken her fonksiyonun
// içindeki mock çağrısını apiFootballLeague.ts'deki fetch... fonksiyonuyla değiştirmek yeterli:
//   getStandings -> fetchLeagueStandings      getTopScorers/... -> fetchTopPlayers(kind)
//   getLeagueFixtures -> fetchLeagueFixtures
// "null" dönmesi = bu lig/sezon için veri yok.

// ---------- Önbellek: hafıza + localStorage ----------
// Günlük API limiti düşük olduğu için aynı lig+sezon verisi tekrar istenmez.
const HOUR = 60 * 60_000 // puan durumu ve istatistikler
const FIVE_MIN = 5 * 60_000 // fikstür

const memory = new Map<string, { at: number; promise: Promise<unknown> }>()

function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = memory.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.promise as Promise<T>
  const promise = (async () => {
    const stored = readStore<T>(`canliskor:league:${key}`, ttl, 'local')
    if (stored !== null) return stored
    const value = await load()
    if (value !== null) writeStore(`canliskor:league:${key}`, value, 'local')
    return value
  })()
  memory.set(key, { at: Date.now(), promise })
  // Hata olursa saklama; bir sonraki denemede tekrar istesin.
  promise.catch(() => memory.delete(key))
  return promise
}

// Mock'ta yükleniyor durumunu görebilmek için küçük bir gecikme
const delay = <T>(value: T, ms = 250) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

// ---------- Lig bilgisi ----------
// Ağ isteği atmadan: önce bilinen maçlardan (logo vb.), yoksa mock tanımından.
export async function getLeague(leagueId: string): Promise<LeagueInfo | null> {
  const known = [...knownMatchesForDate(new Date()), ...MOCK_MATCHES].find((m) => m.leagueId === leagueId)
  const mock = mockLeagueInfo(leagueId)
  if (known) {
    return {
      id: leagueId,
      name: known.leagueName,
      logo: known.leagueLogo,
      region: known.region,
      currentSeason: known.season ?? mock?.currentSeason ?? currentSeasonFor(),
      isMock: Boolean(mock),
    }
  }
  return mock ?? null
}

// ---------- Puan durumu ----------
export function getStandings(leagueId: string, season: number): Promise<LeagueStandings | null> {
  return cached(`standings:${leagueId}:${season}`, HOUR, () => delay(mockStandings(leagueId, season)))
}

// ---------- Oyuncu istatistikleri ----------
function getTopPlayers(leagueId: string, season: number, kind: PlayerStatKind): Promise<PlayerStatEntry[] | null> {
  return cached(`players:${kind}:${leagueId}:${season}`, HOUR, () => delay(mockPlayerStats(leagueId, season, kind)))
}

export const getTopScorers = (leagueId: string, season: number) => getTopPlayers(leagueId, season, 'goals')
export const getTopAssists = (leagueId: string, season: number) => getTopPlayers(leagueId, season, 'assists')
export const getTopYellowCards = (leagueId: string, season: number) => getTopPlayers(leagueId, season, 'yellow')
export const getTopRedCards = (leagueId: string, season: number) => getTopPlayers(leagueId, season, 'red')

export const PLAYER_STAT_LOADERS: Record<PlayerStatKind, (leagueId: string, season: number) => Promise<PlayerStatEntry[] | null>> = {
  goals: getTopScorers,
  assists: getTopAssists,
  yellow: getTopYellowCards,
  red: getTopRedCards,
}

// ---------- Lig maçları ----------
// Sonuçlar: biten maçlar yeniden eskiye. Fikstür: oynanacak maçlar yakından uzağa.
export async function getLeagueFixtures(leagueId: string, season: number, kind: FixtureKind): Promise<Match[] | null> {
  const all = await cached(`fixtures:${leagueId}:${season}`, FIVE_MIN, () => delay(mockFixtures(leagueId, season)))
  if (!all) return null
  // Maç sayfası bu maçları açabilsin diye kaydet
  registerMatches(all)
  return kind === 'results'
    ? all.filter((m) => m.status === 'finished').sort((a, b) => b.startTime.localeCompare(a.startTime))
    : all.filter((m) => m.status !== 'finished').sort((a, b) => a.startTime.localeCompare(b.startTime))
}

// ---------- Bugün oynayan takımlar ----------
// Puan tablosunda vurgulamak için: bu ligde bugün maçı olan takımların id'leri (ve adlarından üretilen id'ler).
export function teamsPlayingToday(leagueId: string): Set<string> {
  const ids = new Set<string>()
  for (const m of knownMatchesForDate(new Date())) {
    if (m.leagueId !== leagueId) continue
    const { home, away } = matchTeamIds(m)
    ids.add(home).add(away).add(teamIdOf(m.homeTeam)).add(teamIdOf(m.awayTeam))
  }
  return ids
}
