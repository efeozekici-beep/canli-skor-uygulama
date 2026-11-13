import type { Match, MatchStatus } from '../../types/match'
import type { LeagueInfo, LeagueStandingRow, LeagueStandings, PlayerStatEntry, StandingSplit } from '../../types/league'
import { createCache, fetchJson } from './common'
import { currentSeasonFor } from '../../lib/league'
import { COUNTRY_TR } from '../../lib/leagueOrder'

// ESPN adaptörü (anahtar gerekmez, kendi backend'imiz /api/espn üzerinden önbellekler):
// lig puan durumu + bölge açıklamaları, gol/asist krallığı, günlük maç listesi.

const BASE = '/api/espn'
const LABEL = 'ESPN'
const cached = createCache('espn')
const MIN = 60_000

// ---------- Ham API tipleri ----------
interface EspnTeam {
  id: string
  displayName: string
  logo?: string
  logos?: { href: string }[]
}

interface EspnStandingEntry {
  team: EspnTeam
  note?: { description?: string }
  stats: { name: string; value?: number }[]
}

export interface EspnStandings {
  children?: { name: string; standings: { entries: EspnStandingEntry[] } }[]
}

interface EspnLeader {
  value: number
  athlete: { id: string; displayName: string; team?: EspnTeam }
}

export interface EspnStatistics {
  stats?: { name: string; leaders?: EspnLeader[] }[]
}

interface EspnStatus {
  displayClock?: string
  type: { name: string; state: 'pre' | 'in' | 'post'; completed: boolean }
}

// Günlük listede durum maçta, skor yazı ("2"); takım takviminde durum competition'da, skor nesne ({ value: 2 })
interface EspnEvent {
  id: string
  date: string
  status?: EspnStatus
  competitions: {
    status?: EspnStatus
    competitors: { homeAway: 'home' | 'away'; score?: string | { value?: number; displayValue?: string }; team: EspnTeam }[]
  }[]
}

export interface EspnScoreboard {
  events?: EspnEvent[]
}

// ---------- Dönüştürücüler ----------
const logoOf = (team?: EspnTeam) => team?.logo ?? team?.logos?.[0]?.href

// ESPN Türk takım adlarını Türkçe harfsiz yazıyor: bilinenleri düzelt
const TURKISH_NAMES: Record<string, string> = {
  Besiktas: 'Beşiktaş',
  Fenerbahce: 'Fenerbahçe',
  Kasimpasa: 'Kasımpaşa',
  'Caykur Rizespor': 'Çaykur Rizespor',
  'Istanbul Basaksehir': 'Başakşehir',
  Genclerbirligi: 'Gençlerbirliği',
  Goztepe: 'Göztepe',
  Eyupspor: 'Eyüpspor',
  'Fatih Karagumruk': 'Fatih Karagümrük',
  Bodrumspor: 'Bodrum FK',
  'Erzurum BB': 'Erzurumspor FK',
}
// Milli takımlar (Uluslar Ligi, Dünya Kupası elemeleri): "France" -> "Fransa"
export const turkishTeamName = (name: string) => TURKISH_NAMES[name] ?? COUNTRY_TR[name] ?? name
const teamName = (team?: EspnTeam) => (team ? turkishTeamName(team.displayName) : '')

export function mapStandings(raw: EspnStandings, leagueId: string, season: number): LeagueStandings | null {
  const groups = (raw.children ?? []).map((child) => {
    const rows = child.standings.entries.map((e): LeagueStandingRow => {
      const stat = (name: string) => e.stats.find((s) => s.name === name)?.value ?? 0
      const all: StandingSplit = {
        played: stat('gamesPlayed'),
        win: stat('wins'),
        draw: stat('ties'),
        lose: stat('losses'),
        goalsFor: stat('pointsFor'),
        goalsAgainst: stat('pointsAgainst'),
      }
      const empty: StandingSplit = { played: 0, win: 0, draw: 0, lose: 0, goalsFor: 0, goalsAgainst: 0 }
      return {
        rank: stat('rank'),
        team: { id: `espn-${e.team.id}`, name: teamName(e.team), logo: logoOf(e.team) },
        points: stat('points'),
        goalsDiff: all.goalsFor - all.goalsAgainst,
        form: null,
        description: e.note?.description ?? null,
        all,
        home: empty,
        away: empty,
      }
    })
    // "Group A1" -> "Grup A1"
    return { name: child.name.replace(/^Group\b/, 'Grup'), rows: rows.sort((a, b) => a.rank - b.rank) }
  })
  if (groups.every((g) => g.rows.length === 0)) return null
  // ESPN ev/deplasman ayrımı ve form vermiyor
  return { leagueId, season, groups, hasSplits: false }
}

// Sıra → bölge açıklaması (football-data bölge vermediği için büyük liglerde de buradan alınır)
export function zonesByRank(raw: EspnStandings): Map<number, string> {
  const zones = new Map<number, string>()
  const entries = raw.children?.length === 1 ? raw.children[0].standings.entries : []
  for (const e of entries) {
    const rank = e.stats.find((s) => s.name === 'rank')?.value
    if (rank && e.note?.description) zones.set(rank, e.note.description)
  }
  return zones
}

export function mapLeaders(raw: EspnStatistics, statName: 'goalsLeaders' | 'assistsLeaders'): PlayerStatEntry[] | null {
  const leaders = raw.stats?.find((s) => s.name === statName)?.leaders
  if (!leaders?.length) return null
  return leaders.map((l) => ({
    playerId: `espn-${l.athlete.id}`,
    name: l.athlete.displayName,
    team: { id: `espn-${l.athlete.team?.id ?? ''}`, name: teamName(l.athlete.team), logo: logoOf(l.athlete.team) },
    value: l.value,
  }))
}

function mapStatus(e: EspnEvent): { status: MatchStatus; minute: number | null; statusLabel?: string } {
  const status = e.status ?? e.competitions[0]?.status
  if (!status) return { status: 'upcoming', minute: null }
  const { state, completed, name } = status.type
  if (state === 'post' && completed) return { status: 'finished', minute: null }
  if (state === 'in') {
    if (name === 'STATUS_HALFTIME') return { status: 'live', minute: null, statusLabel: 'İY' }
    const minute = Number.parseInt(status.displayClock ?? '', 10)
    return Number.isFinite(minute) ? { status: 'live', minute } : { status: 'live', minute: null, statusLabel: 'Canlı' }
  }
  if (name === 'STATUS_POSTPONED') return { status: 'upcoming', minute: null, statusLabel: 'Ert.' }
  if (name === 'STATUS_CANCELED') return { status: 'upcoming', minute: null, statusLabel: 'İptal' }
  return { status: 'upcoming', minute: null }
}

export function mapScoreboard(raw: EspnScoreboard, league: LeagueInfo, season: number): Match[] {
  return (raw.events ?? []).flatMap((e) => {
    const competitors = e.competitions[0]?.competitors ?? []
    const home = competitors.find((c) => c.homeAway === 'home')
    const away = competitors.find((c) => c.homeAway === 'away')
    if (!home || !away) return []
    const state = mapStatus(e)
    const score = (s?: string | { value?: number }) =>
      state.status === 'upcoming' || s === undefined ? null : typeof s === 'string' ? Number(s) : (s.value ?? null)
    return [
      {
        id: `espn-${e.id}`,
        sport: 'football',
        leagueId: league.id,
        leagueName: league.name,
        leagueLogo: league.logo,
        region: league.region,
        homeTeam: teamName(home.team),
        awayTeam: teamName(away.team),
        homeTeamId: `espn-${home.team.id}`,
        awayTeamId: `espn-${away.team.id}`,
        homeLogo: logoOf(home.team),
        awayLogo: logoOf(away.team),
        homeScore: score(home.score),
        awayScore: score(away.score),
        startTime: e.date,
        season,
        ...state,
      } satisfies Match,
    ]
  })
}

// ---------- İstekler ----------

// Ligdeki takımlar (takım sayfası ESPN takvimi için takımı adından bulur)
export function getTeams(slug: string): Promise<{ id: string; name: string }[]> {
  return cached(`teams:${slug}`, 24 * 60 * MIN, async () => {
    const raw = await fetchJson<{ sports: { leagues: { teams: { team: EspnTeam }[] }[] }[] }>(LABEL, `${BASE}/apis/site/v2/sports/soccer/${slug}/teams`)
    return (raw?.sports[0]?.leagues[0]?.teams ?? []).map(({ team }) => ({ id: team.id, name: team.displayName }))
  })
}

// Kadrodaki oyuncuların bu sezonki lig istatistikleri (ESPN takım kadrosu; kota yok)
export interface EspnRosterStats {
  jersey: number | null
  name: string
  appearances: number
  starts: number
  goals: number
  assists: number
  yellow: number
  red: number
}

interface EspnRosterAthlete {
  displayName: string
  jersey?: string
  statistics?: { splits?: { categories?: { stats: { name: string; value: number }[] }[] } }
}

export function getRosterStats(slug: string, espnTeamId: string): Promise<EspnRosterStats[]> {
  return cached(`roster:${slug}:${espnTeamId}`, 3 * 60 * MIN, async () => {
    const raw = await fetchJson<{ athletes?: EspnRosterAthlete[] }>(LABEL, `${BASE}/apis/site/v2/sports/soccer/${slug}/teams/${espnTeamId}/roster`)
    return (raw?.athletes ?? []).flatMap((a) => {
      // İstatistiği hiç olmayan oyuncu bu sezon ligde oynamamış: hepsi 0
      const cats = a.statistics?.splits?.categories ?? []
      const v: Record<string, number> = Object.fromEntries(cats.flatMap((c) => c.stats.map((s) => [s.name, s.value ?? 0])))
      const appearances = v.appearances ?? 0
      return [
        {
          jersey: a.jersey ? Number(a.jersey) : null,
          name: a.displayName,
          appearances,
          // ESPN "maça girdi" ve "yedekten girdi" veriyor: ilk 11 = ikisinin farkı
          starts: Math.max(0, appearances - (v.subIns ?? 0)),
          goals: v.totalGoals ?? 0,
          assists: v.goalAssists ?? 0,
          yellow: v.yellowCards ?? 0,
          red: v.redCards ?? 0,
        },
      ]
    })
  })
}

// Takımın bu sezonki lig maçları: oynananlar + gelecek maçlar (iki istek, kota yok)
export async function getTeamSchedule(slug: string, espnTeamId: string, league: LeagueInfo, season: number): Promise<Match[]> {
  const load = (fixtures: boolean) =>
    cached(`schedule:${slug}:${espnTeamId}:${fixtures ? 'next' : 'past'}`, 10 * MIN, () =>
      fetchJson<EspnScoreboard>(LABEL, `${BASE}/apis/site/v2/sports/soccer/${slug}/teams/${espnTeamId}/schedule${fixtures ? '?fixture=true' : ''}`),
    ).catch(() => null)
  const [past, next] = await Promise.all([load(false), load(true)])
  const byId = new Map<string, Match>()
  for (const raw of [past, next]) if (raw) for (const m of mapScoreboard(raw, league, season)) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.startTime.localeCompare(b.startTime))
}
// Güncel sezonda ?season= gönderilmez: takvim yılına göre işleyen turnuvalarda (Dünya Kupası elemeleri gibi)
// "2026" sorusu boş dönebiliyor; ESPN parametresiz en güncel sezonu verir.
const seasonQuery = (season: number) => (season === currentSeasonFor() ? '' : `?season=${season}`)

export function getStandingsRaw(slug: string, season: number): Promise<EspnStandings | null> {
  return cached(`standings:${slug}:${season}`, 30 * MIN, () =>
    fetchJson<EspnStandings>(LABEL, `${BASE}/apis/v2/sports/soccer/${slug}/standings${seasonQuery(season)}`),
  )
}

export function getStatistics(slug: string, season: number): Promise<EspnStatistics | null> {
  return cached(`stats:${slug}:${season}`, 3 * 60 * MIN, () =>
    fetchJson<EspnStatistics>(LABEL, `${BASE}/apis/site/v2/sports/soccer/${slug}/statistics${seasonQuery(season)}`),
  )
}

// "20261017" (UTC)
const espnDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

// ESPN tarih aralığı kabul etmiyor: gün gün istenir (kota yok, backend önbellekler)
export async function getMatchesAround(slug: string, league: LeagueInfo, season: number, daysBack: number, daysForward: number): Promise<Match[]> {
  const days = Array.from({ length: daysBack + daysForward + 1 }, (_, i) => new Date(Date.now() + (i - daysBack) * 24 * 60 * MIN))
  const lists = await Promise.all(
    days.map((d) => {
      const date = espnDate(d)
      return cached(`scoreboard:${slug}:${date}`, 5 * MIN, () => fetchJson<EspnScoreboard>(LABEL, `${BASE}/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${date}`)).catch(
        () => null, // bir gün alınamazsa diğer günler yine gösterilir
      )
    }),
  )
  const byId = new Map<string, Match>()
  for (const raw of lists) if (raw) for (const m of mapScoreboard(raw, league, season)) byId.set(m.id, m)
  return [...byId.values()]
}
