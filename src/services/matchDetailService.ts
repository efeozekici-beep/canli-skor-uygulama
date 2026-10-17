import type { FormH2H, Lineups, MatchDetail, TeamLineup, MatchEvent, StatItem, Standings } from '../types/matchDetail'
import type { PlayerMatchStats } from '../types/playerStats'
import { MOCK_DETAILS } from '../data/mockMatchDetails'
import { MOCK_STANDINGS, mockHeadToHead, mockLastMatches } from '../data/mockStandings'
import { MOCK_MATCHES } from '../data/mockMatches'
import { findMatchById } from './matchService'
import { fetchCurrentCoach, fetchFixtureBundle, fetchHeadToHead, fetchStandings, type FixtureBundle } from './apiFootballDetail'
import { matchTeamIds } from '../lib/team'
import { readStore, removeStore, writeStore } from '../lib/storageCache'
import { getPlayerPhotos } from './photoService'

// Maç detayının tek veri kapısı. Bileşenler sadece bu fonksiyonları çağırır.
//  - Mock maçlar (ucl-1, tsl-2...) ve VITE_USE_MOCK=true iken: src/data altındaki örnek veri
//  - Gerçek maçlar (sayısal id): API-Football
//      getEvents / getLineups / getStatistics / getPlayerStats -> hepsi tek /fixtures?id= isteğinden
//      getStandings -> /standings      getH2H -> /fixtures/headtohead
// "null" dönmesi = bu maç için veri yok.

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const isApiMatch = (id: string) => !USE_MOCK && !(id in MOCK_DETAILS) && /^\d+$/.test(id)

// ---------- Hafıza önbelleği ----------
// Aynı istek tekrar gelirse ağ yerine hafızadaki sonuç (Promise) döner.
const SHORT = 2 * 60_000
const LONG = 30 * 60_000

const cache = new Map<string, { at: number; promise: Promise<unknown> }>()

function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.promise as Promise<T>
  const promise = load()
  cache.set(key, { at: Date.now(), promise })
  // Hata olursa önbellekte tutma, bir sonraki denemede tekrar istesin.
  promise.catch(() => cache.delete(key))
  return promise
}

// Mock'ta yükleniyor durumunu görebilmek için küçük bir gecikme.
const delay = <T>(value: T, ms = 300) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

// ---------- API: tek maç paketi ----------
// Biten maç değişmez (6 saat sakla), canlı maç 1 dakikada bir, başlamamış maç 10 dakikada bir yenilenir.
// Dönüştürme mantığı değişirse sürümü artır, eski kayıtlar kullanılmaz.
const bundleKey = (id: string) => `canliskor:fixture:v7:${id}`
const bundleTtl = (b: FixtureBundle) => (b.match.status === 'finished' ? 6 * 60 * 60_000 : b.match.status === 'live' ? 60_000 : 10 * 60_000)

function peekBundle(id: string): FixtureBundle | null {
  const stored = readStore<FixtureBundle>(bundleKey(id), 6 * 60 * 60_000)
  return stored && readStore<FixtureBundle>(bundleKey(id), bundleTtl(stored)) ? stored : null
}

function getBundle(id: string): Promise<FixtureBundle | null> {
  return cached(`bundle:${id}`, 60_000, async () => {
    const stored = peekBundle(id)
    if (stored) return stored
    const bundle = await fetchFixtureBundle(id)
    if (bundle) writeStore(bundleKey(id), bundle)
    return bundle
  })
}

// Canlı maçta yeni olay olunca (gol vb.): bu maçın önbelleklerini sil, sekmeler yeniden çeksin.
// Sunucu canlı maç detayını 1 dk sakladığı için en fazla dakikada bir yeni veri gelir.
export function invalidateMatch(id: string) {
  for (const key of cache.keys()) if (key.endsWith(`:${id}`)) cache.delete(key)
  removeStore(bundleKey(id))
}

// ---------- Dışa açılan fonksiyonlar ----------

export function getMatchDetail(id: string): Promise<MatchDetail | null> {
  return cached(`detail:${id}`, 60_000, async () => {
    // Önce listenin zaten indirdiği veriden oku (ağ isteği yok)
    const match = findMatchById(id)
    if (isApiMatch(id)) {
      const bundle = match ? peekBundle(id) : await getBundle(id)
      const found = match ?? bundle?.match
      return found ? { match: found, round: bundle?.round, venue: bundle?.venue, referee: bundle?.referee } : null
    }
    if (!match) return null
    const extra = MOCK_DETAILS[id]
    return { match, round: extra?.round, venue: extra?.venue, referee: extra?.referee }
  })
}

export function getEvents(id: string): Promise<MatchEvent[] | null> {
  if (isApiMatch(id)) return getBundle(id).then((b) => b?.events ?? null)
  return cached(`events:${id}`, SHORT, () => delay(MOCK_DETAILS[id]?.events ?? null))
}

// Takımın teknik direktörü: 1 gün saklanır (tarayıcıda localStorage, sunucuda Redis)
function getCurrentCoach(teamId: string) {
  const key = `canliskor:coach:v1:${teamId}`
  return cached(`coach:${teamId}`, LONG, async () => {
    const stored = readStore<{ name: string; photo?: string } | false>(key, 24 * 60 * 60_000, 'local')
    if (stored !== null) return stored || null
    const coach = await fetchCurrentCoach(teamId)
    writeStore(key, coach ?? false, 'local')
    return coach
  })
}

// Kadroda teknik direktör yoksa ayrı sorguyla doldur; o da olmazsa "—" kalır
async function withCoach(lineup: TeamLineup): Promise<TeamLineup> {
  if (lineup.coach !== '—') return lineup
  const coach = await getCurrentCoach(lineup.team.id).catch(() => null)
  return coach ? { ...lineup, coach: coach.name, coachPhoto: coach.photo } : lineup
}

export function getLineups(id: string): Promise<Lineups | null> {
  if (isApiMatch(id)) {
    return getBundle(id).then(async (b) => {
      if (!b?.lineups) return null
      const [home, away] = await Promise.all([withCoach(b.lineups.home), withCoach(b.lineups.away)])
      // API-Football hoca fotoğrafı çoğu zaman "fotoğraf yok" resmi: önce Wikipedia'daki gerçek fotoğrafa bak
      const coaches = [home.coach, away.coach].filter((c) => c !== '—')
      const photos = await getPlayerPhotos('football-coach', coaches).catch(() => ({}) as Record<string, string | null>)
      const withPhoto = (l: TeamLineup) => ({ ...l, coachPhoto: photos[l.coach] ?? l.coachPhoto })
      return { home: withPhoto(home), away: withPhoto(away) }
    })
  }
  return cached(`lineups:${id}`, SHORT, () => delay(MOCK_DETAILS[id]?.lineups ?? null))
}

export function getStatistics(id: string): Promise<StatItem[] | null> {
  if (isApiMatch(id)) return getBundle(id).then((b) => b?.statistics ?? null)
  return cached(`stats:${id}`, SHORT, () => delay(MOCK_DETAILS[id]?.statistics ?? null))
}

export function getPlayerStats(matchId: string): Promise<PlayerMatchStats[] | null> {
  if (isApiMatch(matchId)) return getBundle(matchId).then((b) => b?.players ?? null)
  return cached(`players:${matchId}`, SHORT, () => delay(MOCK_DETAILS[matchId]?.players ?? null))
}

export function getStandings(leagueId: string, season?: number, teamIds: string[] = []): Promise<Standings | null> {
  if (leagueId in MOCK_STANDINGS || USE_MOCK) {
    return cached(`standings:${leagueId}`, LONG, () => delay(MOCK_STANDINGS[leagueId] ?? null))
  }
  if (!season) return Promise.resolve(null)
  return cached(`standings:${leagueId}:${season}`, LONG, async () => {
    const key = `canliskor:standings:${leagueId}:${season}`
    const stored = readStore<Standings>(key, LONG)
    if (stored) return stored
    // Plan hatası da saklanır; yoksa sekme her açıldığında aynı hata için kota harcanır.
    const storedError = readStore<string>(`${key}:error`, LONG)
    if (storedError) throw new Error(storedError)
    try {
      const standings = await fetchStandings(leagueId, season, teamIds)
      if (standings) writeStore(key, standings)
      return standings
    } catch (err) {
      if (err instanceof Error) writeStore(`${key}:error`, err.message)
      throw err
    }
  })
}

// Mock takım adı (geçmiş maç üretici için)
function teamNameById(id: string): string | null {
  for (const m of MOCK_MATCHES) {
    const ids = matchTeamIds(m)
    if (id === ids.home) return m.homeTeam
    if (id === ids.away) return m.awayTeam
  }
  for (const standings of Object.values(MOCK_STANDINGS)) {
    const row = standings.rows.find((r) => r.team.id === id)
    if (row) return row.team.name
  }
  return null
}

export function getH2H(homeId: string, awayId: string): Promise<FormH2H | null> {
  // Gerçek takım id'leri sayısaldır
  if (!USE_MOCK && /^\d+$/.test(homeId) && /^\d+$/.test(awayId)) {
    return cached(`h2h:${homeId}:${awayId}`, LONG, async () => {
      const key = `canliskor:h2h:${homeId}:${awayId}`
      const stored = readStore<FormH2H>(key, LONG)
      if (stored) return stored
      // Takımların son 5 maçı ücretsiz planda alınamıyor ("last" ve sezon parametreleri kapalı);
      // bu yüzden şimdilik sadece aralarındaki maçlar.
      const data: FormH2H = { homeLast: [], awayLast: [], h2h: await fetchHeadToHead(homeId, awayId) }
      writeStore(key, data)
      return data
    })
  }
  return cached(`h2h:${homeId}:${awayId}`, LONG, () => {
    const home = teamNameById(homeId)
    const away = teamNameById(awayId)
    if (!home || !away) return delay(null)
    return delay({
      homeLast: mockLastMatches(home, 'Hazırlık / Lig'),
      awayLast: mockLastMatches(away, 'Hazırlık / Lig'),
      h2h: mockHeadToHead(home, away, 'Avrupa'),
    })
  })
}
