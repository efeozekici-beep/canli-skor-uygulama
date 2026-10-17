import type { Match, MatchStatus } from '../../types/match'
import type { LeagueInfo, LeagueStandingRow, LeagueStandings, StandingSplit } from '../../types/league'
import { createCache, fetchJson } from './common'

// football-data.org adaptörü (büyük 12 lig, anahtar backend'de): bütün sezonun maçları ve genel puan tablosu.
// Ücretsiz plan ev/deplasman tablosu ve form vermiyor: ikisi de sezonun biten maçlarından hesaplanır.

const BASE = '/api/footballdata'
const LABEL = 'football-data.org'
const cached = createCache('footballData')
const MIN = 60_000

// ---------- Ham API tipleri ----------
interface FdTeam {
  id: number
  name: string
  crest?: string
}

interface FdTableRow {
  position: number
  team: FdTeam
  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
}

export interface FdStandings {
  standings: { type: string; group: string | null; table: FdTableRow[] }[]
}

type FdStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'LIVE' | 'FINISHED' | 'AWARDED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED'

interface FdMatch {
  id: number
  utcDate: string
  status: FdStatus
  homeTeam: FdTeam
  awayTeam: FdTeam
  score: { fullTime: { home: number | null; away: number | null } }
}

export interface FdMatches {
  matches: FdMatch[]
}

// ---------- Dönüştürücüler ----------

// "Manchester City FC" -> "Manchester City", "FC Barcelona" -> "Barcelona" (ana listedeki adlara yakın olsun)
export const cleanTeamName = (name: string) =>
  name
    .replace(/^(FC|AFC|AC|AS|SS|SSC|SC|CF|CD|RC|RCD|UD|SD|OGC)\s+/i, '')
    .replace(/\s+(FC|AFC|CF|SC|AC|FK|CFC)$/i, '')
    .trim()

const team = (t: FdTeam) => ({ id: `fd-${t.id}`, name: cleanTeamName(t.name), logo: t.crest })

const isFinished = (m: FdMatch) => (m.status === 'FINISHED' || m.status === 'AWARDED') && m.score.fullTime.home !== null && m.score.fullTime.away !== null

// Biten maçlardan takım başına ev/deplasman istatistikleri ve son 5 maç formu
function splitsFromMatches(matches: FdMatch[]) {
  const empty = (): StandingSplit => ({ played: 0, win: 0, draw: 0, lose: 0, goalsFor: 0, goalsAgainst: 0 })
  const byTeam = new Map<number, { home: StandingSplit; away: StandingSplit; results: { date: string; r: string }[] }>()
  const entry = (id: number) => {
    let e = byTeam.get(id)
    if (!e) byTeam.set(id, (e = { home: empty(), away: empty(), results: [] }))
    return e
  }
  const add = (s: StandingSplit, scored: number, conceded: number) => {
    s.played++
    s.goalsFor += scored
    s.goalsAgainst += conceded
    if (scored > conceded) s.win++
    else if (scored === conceded) s.draw++
    else s.lose++
  }
  const result = (scored: number, conceded: number) => (scored > conceded ? 'W' : scored === conceded ? 'D' : 'L')
  for (const m of matches.filter(isFinished)) {
    const h = m.score.fullTime.home ?? 0
    const a = m.score.fullTime.away ?? 0
    const home = entry(m.homeTeam.id)
    const away = entry(m.awayTeam.id)
    add(home.home, h, a)
    add(away.away, a, h)
    home.results.push({ date: m.utcDate, r: result(h, a) })
    away.results.push({ date: m.utcDate, r: result(a, h) })
  }
  return byTeam
}

// zones: sıra → bölge açıklaması (ESPN'den; yoksa boş)
export function mapStandings(raw: FdStandings, matches: FdMatch[] | null, zones: Map<number, string>, leagueId: string, season: number): LeagueStandings | null {
  const totals = raw.standings.filter((s) => s.type === 'TOTAL')
  const splits = matches ? splitsFromMatches(matches) : null
  const groups = totals.map((s, i) => ({
    name: s.group?.replace(/^GROUP_/, 'Grup ') ?? (totals.length > 1 ? `Grup ${i + 1}` : 'Puan Durumu'),
    rows: s.table.map((r): LeagueStandingRow => {
      const sp = splits?.get(r.team.id)
      const empty: StandingSplit = { played: 0, win: 0, draw: 0, lose: 0, goalsFor: 0, goalsAgainst: 0 }
      const form = sp
        ? sp.results
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-5)
            .map((x) => x.r)
            .join('')
        : ''
      return {
        rank: r.position,
        team: team(r.team),
        points: r.points,
        goalsDiff: r.goalsFor - r.goalsAgainst,
        form: form || null,
        description: totals.length === 1 ? (zones.get(r.position) ?? null) : null,
        all: { played: r.playedGames, win: r.won, draw: r.draw, lose: r.lost, goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst },
        home: sp?.home ?? empty,
        away: sp?.away ?? empty,
      }
    }),
  }))
  if (groups.every((g) => g.rows.length === 0)) return null
  return { leagueId, season, groups, hasSplits: splits !== null }
}

function mapStatus(m: FdMatch): { status: MatchStatus; statusLabel?: string } {
  if (m.status === 'FINISHED' || m.status === 'AWARDED') return { status: 'finished' }
  if (m.status === 'PAUSED') return { status: 'live', statusLabel: 'İY' }
  if (m.status === 'IN_PLAY' || m.status === 'LIVE') return { status: 'live', statusLabel: 'Canlı' }
  if (m.status === 'POSTPONED') return { status: 'upcoming', statusLabel: 'Ert.' }
  if (m.status === 'CANCELLED') return { status: 'upcoming', statusLabel: 'İptal' }
  return { status: 'upcoming' }
}

export function mapMatches(raw: FdMatch[], league: LeagueInfo, season: number): Match[] {
  return raw.map((m) => {
    const state = mapStatus(m)
    const home = team(m.homeTeam)
    const away = team(m.awayTeam)
    return {
      id: `fd-${m.id}`,
      sport: 'football',
      leagueId: league.id,
      leagueName: league.name,
      leagueLogo: league.logo,
      region: league.region,
      homeTeam: home.name,
      awayTeam: away.name,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeLogo: home.logo,
      awayLogo: away.logo,
      homeScore: state.status === 'upcoming' ? null : m.score.fullTime.home,
      awayScore: state.status === 'upcoming' ? null : m.score.fullTime.away,
      minute: null,
      startTime: m.utcDate,
      season,
      ...state,
    }
  })
}

// ---------- İstekler ----------
export function getStandingsRaw(code: string, season: number): Promise<FdStandings | null> {
  return cached(`standings:${code}:${season}`, 30 * MIN, () => fetchJson<FdStandings>(LABEL, `${BASE}/competitions/${code}/standings?season=${season}`))
}

export function getMatchesRaw(code: string, season: number): Promise<FdMatch[] | null> {
  return cached(`matches:${code}:${season}`, 10 * MIN, async () => {
    const raw = await fetchJson<FdMatches>(LABEL, `${BASE}/competitions/${code}/matches?season=${season}`)
    return raw?.matches ?? null
  })
}
