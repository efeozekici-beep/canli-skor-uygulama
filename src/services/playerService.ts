import type { CareerEntry, PlayerLeagueStats, PlayerProfile, PlayerSeasonStats, PlayerTransfer, PlayerTrophy } from '../types/player'
import { findMockPlayer } from '../data/mockPlayers'
import { fetchProfile, fetchTransfers, fetchTrophies } from './apiFootballPlayer'
import { findAthlete, getAthleteProfile, getCareer, type CareerRow } from './providers/espnAthlete'
import { getPlayerPhotos } from './photoService'
import { teamIdOf } from '../lib/team'
import { readStore, writeStore } from '../lib/storageCache'
import { currentSeasonFor } from '../lib/league'

// Oyuncu sayfasının tek veri kapısı.
//  - Gerçek oyuncular (API-Football id'si, sayı):
//      profil, transferler, kupalar -> API-Football
//      sezon istatistikleri ve kariyer -> ESPN (bütün sezonlar; API-Football'un ücretsiz planı sadece 2022-24'ü veriyor)
//  - Aramadan / krallık listesinden açılan oyuncular (espn-253989): profil ve kariyer ESPN'den, fotoğraf Wikipedia'dan
//    (transfer ve kupa bilgisi yok)
//  - Örnek oyuncular (p-yamal gibi): src/data/mockPlayers.ts
// "null" / boş liste = veri yok (hata değil).

const HOUR = 60 * 60_000
const WEEK = 7 * 24 * HOUR

// ---------- Önbellek: hafıza + localStorage ----------
const memory = new Map<string, { at: number; promise: Promise<unknown> }>()

function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = memory.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.promise as Promise<T>
  const promise = (async () => {
    const stored = readStore<T>(`canliskor:player:${key}`, ttl, 'local')
    if (stored !== null) return stored
    const value = await load()
    if (value !== null) writeStore(`canliskor:player:${key}`, value, 'local')
    return value
  })()
  memory.set(key, { at: Date.now(), promise })
  promise.catch(() => memory.delete(key))
  return promise
}

// Mock'ta yükleniyor iskeletini görebilmek için küçük gecikme
const delay = <T>(value: T, ms = 250) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

// Doğum tarihinden yaş
function ageFrom(birthDate: string | null) {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

const isApiPlayer = (id: string) => /^\d+$/.test(id)
const espnIdOf = (id: string) => /^espn-(\d+)$/.exec(id)?.[1] ?? null
// Gerçek veriyle açılan oyuncu (API-Football ya da ESPN)
const isRealPlayer = (id: string) => isApiPlayer(id) || espnIdOf(id) !== null

// Oyuncu sayfası takım kadrosundan / maçtan açıldıysa takımın adı: ESPN'de doğru oyuncuyu seçmeye yardım eder
const teamHints = new Map<string, string>()
export function rememberPlayerTeam(id: string, teamName: string | null) {
  if (teamName) teamHints.set(id, teamName)
}

// ESPN'de oyuncuyu bul (adı + takımı). Bulunamazsa null: sezon/kariyer sekmeleri "veri yok" der.
async function espnAthlete(id: string) {
  const profile = await getApiProfile(id)
  if (!profile) return null
  return findAthlete(profile.name, null, teamHints.get(id) ?? null)
}

function getApiProfile(id: string): Promise<PlayerProfile | null> {
  return cached(`api-profile:${id}`, WEEK, () => fetchProfile(id))
}

// ESPN kariyer satırları (sezon + takım + lig); 1 gün
function getCareerRows(id: string): Promise<CareerRow[] | null> {
  return cached(`career-rows:v2:${id}`, 24 * HOUR, async () => {
    const espnId = espnIdOf(id)
    if (espnId) {
      const profile = await getAthleteProfile(espnId)
      return getCareer(espnId, profile?.nationality ?? null)
    }
    const [profile, athlete] = await Promise.all([getApiProfile(id), espnAthlete(id)])
    return athlete ? getCareer(athlete.id, profile?.nationality ?? null) : null
  })
}

// Profil: 7 gün. Gerçek oyuncuda güncel takım ESPN'den (API-Football profili takım vermiyor).
export function getPlayerProfile(id: string): Promise<PlayerProfile | null> {
  const espnId = espnIdOf(id)
  if (espnId) {
    return (async () => {
      const profile = await getAthleteProfile(espnId)
      if (!profile) return null
      // ESPN futbolcu fotoğrafı vermiyor: kendi backend'imiz Wikipedia'dan bulur
      const photos = await getPlayerPhotos('football', [profile.name]).catch(() => ({}) as Record<string, string | null>)
      return { ...profile, photo: photos[profile.name] ?? undefined }
    })()
  }
  if (isApiPlayer(id)) {
    return (async () => {
      const profile = await getApiProfile(id)
      if (!profile) return null
      // Güncel kulüp: kariyerin en son satırı (ESPN aramasının alt yazısı bazen milli takım oluyor: "Norway")
      const rows = await getCareerRows(id).catch(() => null)
      const latest = rows?.[0]
      const teamName = latest?.team ?? teamHints.get(id) ?? null
      return {
        ...profile,
        age: profile.age ?? ageFrom(profile.birthDate),
        team: teamName ? { id: teamIdOf(teamName), name: teamName, logo: latest?.teamLogo } : null,
      }
    })()
  }
  return cached(`profile:${id}`, WEEK, () => {
    const profile = findMockPlayer(id)?.profile ?? null
    return delay(profile ? { ...profile, age: profile.age ?? ageFrom(profile.birthDate) } : null)
  })
}

// Oynadığı sezonlar (yeniden eskiye): 7 gün
export function getPlayerSeasons(id: string): Promise<number[]> {
  if (isRealPlayer(id)) return getCareerRows(id).then((rows) => [...new Set((rows ?? []).map((r) => r.season))].sort((a, b) => b - a))
  return cached(`seasons:${id}`, WEEK, () => delay(findMockPlayer(id)?.seasons.map((s) => s.season).sort((a, b) => b - a) ?? []))
}

// ESPN satırı -> sezon kartı (ESPN'de olmayan alanlar null: arayüz göstermez)
const toLeagueStats = (r: CareerRow): PlayerLeagueStats => ({
  league: { id: r.leagueSlug, name: r.league, logo: r.leagueLogo },
  team: { id: `espn-${r.teamId}`, name: r.team, logo: r.teamLogo },
  appearances: null,
  lineups: r.starts,
  minutes: null,
  goals: r.goals,
  assists: r.assists,
  rating: null,
  yellow: r.yellow,
  red: r.red,
  passes: null,
  shots: r.shots,
  shotsOnTarget: r.shotsOnTarget,
  duelsTotal: null,
  duelsWon: null,
})

// Sezon istatistikleri: güncel sezon 1 saat (değişiyor), geçmiş sezonlar 7 gün
export function getPlayerSeasonStats(id: string, season: number): Promise<PlayerSeasonStats | null> {
  if (isRealPlayer(id)) {
    return getCareerRows(id).then((rows) => {
      const leagues = (rows ?? []).filter((r) => r.season === season).map(toLeagueStats)
      return leagues.length > 0 ? { season, leagues } : null
    })
  }
  const ttl = season >= currentSeasonFor() ? HOUR : WEEK
  return cached(`stats:${id}:${season}`, ttl, () => delay(findMockPlayer(id)?.seasons.find((s) => s.season === season) ?? null))
}

// Kariyer (takım geçmişi): her sezon + takım için bütün turnuvaların toplamı; 7 gün
export function getPlayerTeams(id: string): Promise<CareerEntry[]> {
  if (isRealPlayer(id)) {
    return getCareerRows(id).then((rows) => {
      const byKey = new Map<string, CareerEntry & { leagues: string[] }>()
      for (const r of rows ?? []) {
        const key = `${r.season}:${r.teamId}`
        const e = byKey.get(key) ?? {
          season: r.season,
          team: { id: `espn-${r.teamId}`, name: r.team, logo: r.teamLogo },
          league: null,
          appearances: null,
          starts: 0,
          goals: 0,
          assists: 0,
          leagues: [],
        }
        e.starts = (e.starts ?? 0) + r.starts
        e.goals = (e.goals ?? 0) + r.goals
        e.assists = (e.assists ?? 0) + r.assists
        e.leagues.push(r.league)
        byKey.set(key, e)
      }
      return [...byKey.values()].map(({ leagues, ...e }) => ({ ...e, league: leagues.join(', ') }))
    })
  }
  return cached(`teams:${id}`, WEEK, () => delay(findMockPlayer(id)?.career ?? []))
}

// Transferler: 7 gün
export function getPlayerTransfers(id: string): Promise<PlayerTransfer[]> {
  if (espnIdOf(id)) return Promise.resolve([])
  return cached(`transfers:${id}`, WEEK, () => (isApiPlayer(id) ? fetchTransfers(id) : delay(findMockPlayer(id)?.transfers ?? [])))
}

// Kupalar: 7 gün
export function getPlayerTrophies(id: string): Promise<PlayerTrophy[]> {
  if (espnIdOf(id)) return Promise.resolve([])
  return cached(`trophies:${id}`, WEEK, () => (isApiPlayer(id) ? fetchTrophies(id) : delay(findMockPlayer(id)?.trophies ?? [])))
}
