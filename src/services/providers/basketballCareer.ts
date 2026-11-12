import { createCache, fetchJson } from './common'
import { teamIdOf } from '../../lib/team'

// Basketbol oyuncu geçmişi (sezon sezon ortalamalar), kota yok:
//  - NBA: ESPN (oyuncu adından bulunur)
//  - EuroLeague / EuroCup: EuroLeague'in resmi API'si (oyuncu o sezonun oyuncu listesinde adından bulunur,
//    son 8 sezonun istatistikleri tek tek istenir; 1 gün saklanır)

const cached = createCache('bbCareer')
const DAY = 24 * 60 * 60_000

export interface BasketballSeasonLine {
  /** "2025-26" */
  season: string
  team: string | null
  teamLogo?: string
  games: number
  minutes: number | null
  points: number
  rebounds: number
  assists: number
}

const tokens = (s: string) => teamIdOf(s).split('-').filter(Boolean)
const round1 = (n: number) => Math.round(n * 10) / 10

// "S. Larkin", "Larkin Shane", "LARKIN, SHANE": bütün tam kelimeler adayda geçmeli, baş harfler tutmalı
function sameName(query: string, candidate: string) {
  const q = tokens(query)
  const c = tokens(candidate)
  const full = q.filter((t) => t.length > 1)
  const initials = q.filter((t) => t.length === 1)
  return full.length > 0 && full.every((t) => c.includes(t)) && initials.every((i) => c.some((t) => t.startsWith(i)))
}

// ---------- NBA (ESPN) ----------
interface EspnSearch {
  results?: { type: string; contents?: { uid: string; displayName: string; subtitle?: string }[] }[]
}

interface EspnNbaStats {
  categories?: { name: string; names?: string[]; labels?: string[]; statistics?: { season: { displayName: string }; teamSlug?: string; stats: string[] }[] }[]
}

// "denver-nuggets" -> "Denver Nuggets"
const slugToName = (slug?: string) => (slug ? slug.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') : null)

export function getNbaCareer(name: string, teamName: string | null): Promise<BasketballSeasonLine[] | null> {
  return cached(`nba:${name}:${teamName ?? ''}`, DAY, async () => {
    const parts = tokens(name)
    const surname = parts[parts.length - 1]
    if (!surname || surname.length < 3) return null
    const search = await fetchJson<EspnSearch>('ESPN', `/api/espn/apis/search/v2?query=${encodeURIComponent(surname)}&limit=15&type=player`)
    // s:40~l:46 = NBA
    const people = (search?.results ?? []).flatMap((r) => (r.type === 'player' ? (r.contents ?? []) : [])).filter((p) => p.uid.startsWith('s:40~l:46~'))
    const matches = people.filter((p) => sameName(name, p.displayName))
    const byTeam = teamName ? matches.filter((p) => p.subtitle && tokens(p.subtitle).some((t) => tokens(teamName).includes(t))) : []
    const pick = byTeam.length === 1 ? byTeam[0] : matches.length === 1 ? matches[0] : null
    const id = pick?.uid.match(/a:(\d+)/)?.[1]
    if (!id) return null

    const stats = await fetchJson<EspnNbaStats>('ESPN', `/api/espn/apis/common/v3/sports/basketball/nba/athletes/${id}/stats`)
    const averages = stats?.categories?.find((c) => c.name === 'averages')
    if (!averages?.statistics) return null
    const cols = averages.labels ?? averages.names ?? []
    const at = (row: string[], label: string) => Number(row[cols.indexOf(label)] ?? 0) || 0
    return averages.statistics
      .map((s) => ({
        season: s.season.displayName.replace(/^(\d{4})-(\d{2}).*$/, '$1-$2'),
        team: slugToName(s.teamSlug),
        teamLogo: undefined,
        games: at(s.stats, 'GP'),
        minutes: at(s.stats, 'MIN'),
        points: at(s.stats, 'PTS'),
        rebounds: at(s.stats, 'REB'),
        assists: at(s.stats, 'AST'),
      }))
      .reverse()
  })
}

// ---------- EuroLeague / EuroCup (resmi API) ----------
interface ElPeople {
  data: { person: { code: string; name: string; alias?: string } }[]
}

interface ElPersonStats {
  games: { playerClubCode: string; game: { local: ElSide; road: ElSide } }[]
  averagePerGame?: { timePlayed: number; points: number; totalRebounds: number; assistances: number; gamesPlayed: number }
}
interface ElSide {
  club: { code: string; abbreviatedName?: string; name: string; images?: { crest?: string } }
}

// Ekim'de başlayan sezon "2026"
const currentElSeason = () => {
  const now = new Date()
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

export function getEuroleagueCareer(name: string, competition: 'E' | 'U'): Promise<BasketballSeasonLine[] | null> {
  return cached(`el:${competition}:${name}`, DAY, async () => {
    const year = currentElSeason()
    const people = await fetchJson<ElPeople>('EuroLeague', `/api/euroleague/v2/competitions/${competition}/seasons/${competition}${year}/people?personType=J`)
    const found = (people?.data ?? []).filter((p) => sameName(name, p.person.alias ?? p.person.name))
    if (found.length !== 1) return null // bulunamadı ya da aynı adlı birden fazla oyuncu: yanlış kişiyi göstermektense hiç
    const code = found[0].person.code

    const seasons = Array.from({ length: 8 }, (_, i) => year - i)
    const lines = await Promise.all(
      seasons.map(async (y): Promise<BasketballSeasonLine | null> => {
        const s = await fetchJson<ElPersonStats>('EuroLeague', `/api/euroleague/v2/competitions/${competition}/seasons/${competition}${y}/people/${code}/stats`).catch(() => null)
        const avg = s?.averagePerGame
        if (!s || !avg || s.games.length === 0) return null
        // O sezon oynadığı takım: maç kayıtlarındaki kulüp kodundan
        const g = s.games[s.games.length - 1]
        const club = g.game.local.club.code === g.playerClubCode ? g.game.local.club : g.game.road.club
        return {
          season: `${y}-${String(y + 1).slice(2)}`,
          team: club.abbreviatedName ?? club.name,
          teamLogo: club.images?.crest,
          games: s.games.length,
          minutes: round1(avg.timePlayed / 60),
          points: round1(avg.points),
          rebounds: round1(avg.totalRebounds),
          assists: round1(avg.assistances),
        }
      }),
    )
    return lines.filter((l): l is BasketballSeasonLine => l !== null)
  })
}
