import type { Match, MatchStatus } from '../../types/match'
import type { LeagueInfo, LeagueStandingRow, LeagueStandings, PlayerStatEntry, StandingSplit } from '../../types/league'
import { createCache, fetchJson } from './common'

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

interface EspnEvent {
  id: string
  date: string
  status: { displayClock?: string; type: { name: string; state: 'pre' | 'in' | 'post'; completed: boolean } }
  competitions: { competitors: { homeAway: 'home' | 'away'; score?: string; team: EspnTeam }[] }[]
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
const teamName = (team?: EspnTeam) => (team ? (TURKISH_NAMES[team.displayName] ?? team.displayName) : '')

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
    return { name: child.name, rows: rows.sort((a, b) => a.rank - b.rank) }
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
  const { state, completed, name } = e.status.type
  if (state === 'post' && completed) return { status: 'finished', minute: null }
  if (state === 'in') {
    if (name === 'STATUS_HALFTIME') return { status: 'live', minute: null, statusLabel: 'İY' }
    const minute = Number.parseInt(e.status.displayClock ?? '', 10)
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
    const score = (s?: string) => (state.status === 'upcoming' || s === undefined ? null : Number(s))
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
export function getStandingsRaw(slug: string, season: number): Promise<EspnStandings | null> {
  return cached(`standings:${slug}:${season}`, 30 * MIN, () => fetchJson<EspnStandings>(LABEL, `${BASE}/apis/v2/sports/soccer/${slug}/standings?season=${season}`))
}

export function getStatistics(slug: string, season: number): Promise<EspnStatistics | null> {
  return cached(`stats:${slug}:${season}`, 3 * 60 * MIN, () =>
    fetchJson<EspnStatistics>(LABEL, `${BASE}/apis/site/v2/sports/soccer/${slug}/statistics?season=${season}`),
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
