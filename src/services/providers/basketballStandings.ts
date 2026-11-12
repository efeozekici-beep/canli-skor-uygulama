import type { BasketballStandingRow, BasketballStandings } from '../../types/basketball'
import { createCache, fetchJson } from './common'

// Bu sezonun basketbol puan durumları (API-Basketball'un ücretsiz planı bu sezonu vermiyor):
//  - NBA: ESPN (Doğu / Batı konferansı)
//  - EuroLeague, EuroCup: EuroLeague'in resmi API'si (güncel turun tablosu)
// İkisi de anahtar ve kota istemiyor; backend önbellekler.

const cached = createCache('bbStandings')
const MIN = 60_000

// ---------- NBA (ESPN) ----------
interface EspnNbaStandings {
  children?: {
    name: string
    standings: { entries: { team: { id: string; displayName: string; logos?: { href: string }[] }; stats: { name: string; value?: number }[] }[] }
  }[]
}

const CONFERENCES: Record<string, string> = { 'Eastern Conference': 'Doğu Konferansı', 'Western Conference': 'Batı Konferansı' }

// NBA: 1-6 doğrudan play-off, 7-10 play-in
const nbaZone = (seed: number) => (seed <= 6 ? 'Play-off' : seed <= 10 ? 'Play-in' : null)

function mapNba(raw: EspnNbaStandings, leagueId: string, season: string): BasketballStandings | null {
  const groups = (raw.children ?? []).map((c) => {
    const rows = c.standings.entries.map((e): BasketballStandingRow => {
      const stat = (name: string) => e.stats.find((s) => s.name === name)?.value ?? 0
      const seed = stat('playoffSeed')
      const won = stat('wins')
      const lost = stat('losses')
      return {
        rank: seed,
        team: { id: `espn-${e.team.id}`, name: e.team.displayName, logo: e.team.logos?.[0]?.href },
        played: won + lost,
        won,
        lost,
        winPct: won + lost > 0 ? won / (won + lost) : null,
        pointsFor: stat('pointsFor'),
        pointsAgainst: stat('pointsAgainst'),
        form: null,
        description: nbaZone(seed),
      }
    })
    return { name: CONFERENCES[c.name] ?? c.name, rows: rows.sort((a, b) => a.rank - b.rank) }
  })
  return groups.some((g) => g.rows.length > 0) ? { leagueId, season, groups } : null
}

export function getNbaStandings(leagueId: string, season: string): Promise<BasketballStandings | null> {
  return cached(`nba:${season}`, 30 * MIN, async () => {
    const raw = await fetchJson<EspnNbaStandings>('ESPN', '/api/espn/apis/v2/sports/basketball/nba/standings')
    return raw ? mapNba(raw, leagueId, season) : null
  })
}

// ---------- EuroLeague / EuroCup (resmi API) ----------
interface ElRound {
  round: number
  minGameStartDate: string
}

interface ElStandingGroup {
  group: { name: string; rawName?: string }
  standings: {
    club: { code: string; name: string; abbreviatedName?: string; images?: { crest?: string } }
    data: { position: number; gamesPlayed: number; gamesWon: number; gamesLost: number; pointsFavour: number; pointsAgainst: number }
  }[]
}

// EuroLeague: 1-6 play-off, 7-10 play-in. EuroCup'ta gruplar var, bölge gösterilmez.
const euroleagueZone = (position: number) => (position <= 6 ? 'Play-off' : position <= 10 ? 'Play-in' : null)

// competition: "E" EuroLeague, "U" EuroCup. season: "2026-2027" (API-Basketball biçimi) -> sezon kodu "E2026"
export function getEuroleagueStandings(competition: 'E' | 'U', leagueId: string, season: string): Promise<BasketballStandings | null> {
  const seasonCode = `${competition}${season.slice(0, 4)}`
  return cached(`el:${seasonCode}`, 10 * MIN, async () => {
    const base = `/api/euroleague/v2/competitions/${competition}/seasons/${seasonCode}`
    // Güncel tur: başlamış en son tur
    const rounds = (await fetchJson<{ data: ElRound[] }>('EuroLeague', `${base}/rounds`))?.data ?? []
    const now = new Date().toISOString()
    const current = rounds.filter((r) => r.minGameStartDate <= now).sort((a, b) => b.round - a.round)[0]
    if (!current) return null
    const raw = await fetchJson<ElStandingGroup[]>('EuroLeague', `${base}/rounds/${current.round}/standings`)
    // "Regular Season" -> "Normal Sezon"; EuroCup grupları "A".."D" -> "Grup A" (alfabetik)
    const groupName = (g: ElStandingGroup) => {
      const name = g.group.rawName ?? g.group.name
      return /^[A-Z]$/.test(name) ? `Grup ${name}` : /regular season/i.test(name) ? 'Normal Sezon' : name
    }
    const groups = [...(raw ?? [])].sort((a, b) => groupName(a).localeCompare(groupName(b), 'tr')).map((g) => ({
      name: groupName(g),
      rows: g.standings.map(
        (s): BasketballStandingRow => ({
          rank: s.data.position,
          team: { id: `el-${s.club.code}`, name: s.club.abbreviatedName ?? s.club.name, logo: s.club.images?.crest },
          played: s.data.gamesPlayed,
          won: s.data.gamesWon,
          lost: s.data.gamesLost,
          winPct: s.data.gamesPlayed > 0 ? s.data.gamesWon / s.data.gamesPlayed : null,
          pointsFor: s.data.pointsFavour,
          pointsAgainst: s.data.pointsAgainst,
          form: null,
          description: competition === 'E' ? euroleagueZone(s.data.position) : null,
        }),
      ),
    }))
    return groups.some((g) => g.rows.length > 0) ? { leagueId, season, groups } : null
  })
}
