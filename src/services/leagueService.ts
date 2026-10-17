import type { Match } from '../types/match'
import type { FixtureKind, LeagueInfo, LeagueStandings, PlayerStatEntry, PlayerStatKind } from '../types/league'
import { mockFixtures, mockLeagueInfo, mockPlayerStats, mockStandings } from '../data/mockLeagues'
import { MOCK_MATCHES } from '../data/mockMatches'
import { fetchMatches, knownMatchesForDate, registerMatches } from './matchService'
import { readStore, writeStore } from '../lib/storageCache'
import { currentSeasonFor } from '../lib/league'
import { matchTeamIds, sameTeamName, teamIdOf } from '../lib/team'
import { apiLeagueId, leagueSourceFor } from '../config/leagueSources'
import * as espn from './providers/espnSoccer'
import * as footballData from './providers/footballData'
import { getPlayerPhotos } from './photoService'

// Lig sayfasının tek veri kapısı. Bileşenler sadece bu fonksiyonları çağırır.
// API-Football'un ücretsiz planı bu sezonun lig verisini vermediği için (src/config/leagueSources.ts):
//   - Puan durumu: büyük 12 ligde football-data.org (+ ESPN bölge renkleri), diğerlerinde ESPN
//   - Gol / asist krallığı: ESPN (sarı/kırmızı kart listesi ücretsiz kaynaklarda yok)
//   - Maçlar: büyük 12 ligde bütün sezon (football-data.org), diğerlerinde son/gelecek 7 gün (ESPN)
// Listede olmayan ligler örnek veriyle (src/data/mockLeagues.ts) açılır ve "Örnek veri" etiketi gösterilir.
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
  const source = leagueSourceFor(leagueId)
  const known = [...knownMatchesForDate(new Date()), ...MOCK_MATCHES].find((m) => m.leagueId === leagueId || m.leagueId === apiLeagueId(leagueId))
  const mock = mockLeagueInfo(leagueId)
  if (known) {
    return {
      id: leagueId,
      name: known.leagueName,
      logo: known.leagueLogo,
      region: known.region,
      currentSeason: known.season ?? mock?.currentSeason ?? currentSeasonFor(),
      isMock: !source && Boolean(mock),
    }
  }
  if (source) {
    // Bugün maçı olmayan lig: adı ve logosu kaynak listesinden
    return {
      id: leagueId,
      name: source.name,
      logo: `https://media.api-sports.io/football/leagues/${apiLeagueId(leagueId)}.png`,
      region: source.region,
      currentSeason: currentSeasonFor(),
    }
  }
  return mock ?? null
}

// ---------- Puan durumu ----------
export function getStandings(leagueId: string, season: number): Promise<LeagueStandings | null> {
  const source = leagueSourceFor(leagueId)
  if (!source) return cached(`standings:${leagueId}:${season}`, HOUR, () => delay(mockStandings(leagueId, season)))
  // Gerçek veri: kaynak önbellekleri (tarayıcı + sunucu) zaten var, burada ayrıca saklanmaz
  return (async () => {
    const espnRaw = await espn.getStandingsRaw(source.espn, season).catch(() => null)
    if (source.footballData) {
      const [fdRaw, matches] = await Promise.all([
        footballData.getStandingsRaw(source.footballData, season),
        // Ev/deplasman tablosu ve form için; alınamazsa tablo yine gösterilir
        footballData.getMatchesRaw(source.footballData, season).catch(() => null),
      ])
      const zones = espnRaw ? espn.zonesByRank(espnRaw) : new Map<number, string>()
      if (fdRaw) return footballData.mapStandings(fdRaw, matches, zones, leagueId, season)
    }
    return espnRaw ? espn.mapStandings(espnRaw, leagueId, season) : null
  })()
}

// ---------- Oyuncu istatistikleri ----------
async function getTopPlayers(leagueId: string, season: number, kind: PlayerStatKind): Promise<PlayerStatEntry[] | null> {
  const source = leagueSourceFor(leagueId)
  if (!source) return cached(`players:${kind}:${leagueId}:${season}`, HOUR, () => delay(mockPlayerStats(leagueId, season, kind)))
  // Ücretsiz kaynaklarda kart listesi yok: boş durum gösterilir
  if (kind === 'yellow' || kind === 'red') return null
  const raw = await espn.getStatistics(source.espn, season)
  const list = raw ? espn.mapLeaders(raw, kind === 'goals' ? 'goalsLeaders' : 'assistsLeaders') : null
  if (!list) return null
  // ESPN futbolcu fotoğrafı vermiyor: kendi backend'imiz Wikipedia'dan bulur (ilk 20 oyuncu); bulunamazsa baş harfler
  const photos = await getPlayerPhotos('football', list.slice(0, 20).map((p) => p.name)).catch(() => ({}) as Record<string, string | null>)
  return list.map((p) => ({ ...p, photo: photos[p.name] ?? undefined }))
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
async function loadFixtures(leagueId: string, season: number): Promise<Match[] | null> {
  const source = leagueSourceFor(leagueId)
  if (!source) return cached(`fixtures:${leagueId}:${season}`, FIVE_MIN, () => delay(mockFixtures(leagueId, season)))
  const league = await getLeague(leagueId)
  if (!league) return null
  if (source.footballData) {
    const raw = await footballData.getMatchesRaw(source.footballData, season)
    if (raw) return footballData.mapMatches(raw, league, season)
  }
  // ESPN sadece güncel sezonun günlük maçlarını verir
  if (season !== league.currentSeason) return null
  return espn.getMatchesAround(source.espn, league, season, 7, 7)
}

export async function getLeagueFixtures(leagueId: string, season: number, kind: FixtureKind): Promise<Match[] | null> {
  const all = await loadFixtures(leagueId, season)
  if (!all) return null
  // Maç sayfası bu maçları açabilsin diye kaydet
  registerMatches(all)
  return kind === 'results'
    ? all.filter((m) => m.status === 'finished').sort((a, b) => b.startTime.localeCompare(a.startTime))
    : all.filter((m) => m.status !== 'finished').sort((a, b) => a.startTime.localeCompare(b.startTime))
}

// ---------- Lig maçından maç sayfasına ----------
// football-data / ESPN maçlarının id'si API-Football'unkinden farklı ("fd-123", "espn-456").
// Maç sayfası API-Football'dan açıldığı için o günün listesinde aynı ligde aynı takımların maçı aranır.
export async function resolveLeagueMatch(match: Match): Promise<string | null> {
  if (!/^(fd|espn)-/.test(match.id)) return match.id
  const day = await fetchMatches('football', new Date(match.startTime))
  const leagueId = apiLeagueId(match.leagueId)
  const found = day.find((m) => m.leagueId === leagueId && sameTeamName(m.homeTeam, match.homeTeam) && sameTeamName(m.awayTeam, match.awayTeam))
  return found?.id ?? null
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
