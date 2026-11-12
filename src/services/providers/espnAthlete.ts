import type { PlayerProfile } from '../../types/player'
import { createCache, fetchJson } from './common'
import { teamIdOf } from '../../lib/team'
import { turkishTeamName } from './espnSoccer'
import { LEAGUE_SOURCES } from '../../config/leagueSources'

// ESPN futbolcu adaptörü (kota yok, backend /api/espn önbellekler): oyuncuyu adından bulur ve kulüp kariyerini
// sezon sezon toplar. ESPN tek istekte bir takım + bir lig verir; bu yüzden oyuncunun her kulübü için ayrı,
// Avrupa kupası oynadıysa onun için de ayrı istek atılır (en fazla ~15 istek, 1 gün saklanır).
// Not: ESPN toplam maç sayısını vermiyor, "ilk 11" (starts) veriyor.

const BASE = '/api/espn'
const LABEL = 'ESPN'
const cached = createCache('espnAthlete')
const DAY = 24 * 60 * 60_000

// ---------- Ham API tipleri ----------
interface EspnSearch {
  results?: { type: string; contents?: { uid: string; displayName: string; subtitle?: string }[] }[]
}

interface EspnFilter {
  name: string
  value: string
  options: { value: string; displayValue: string }[]
}

export interface EspnAthleteStats {
  filters?: EspnFilter[]
  /** Lig kodu -> kısa ad ("eng.1" -> "Premier League") */
  leagues?: Record<string, { displayName?: string }>
  categories?: { names: string[]; statistics: { season: { displayName: string }; stats: string[] }[] }[]
}

// Kariyer tablosunun bir satırı: bir sezon + bir takım + bir lig
export interface CareerRow {
  season: number
  league: string
  leagueSlug: string
  leagueLogo?: string
  teamId: string
  team: string
  teamLogo: string
  starts: number
  goals: number
  assists: number
  yellow: number
  red: number
  shots: number
  shotsOnTarget: number
}

// ---------- Oyuncuyu bulma ----------
const tokens = (s: string) => teamIdOf(s).split('-').filter(Boolean)

// API-Football adları kısaltılmış olabilir ("E. Haaland"): soyadıyla aranır, sonuçlarda ad baş harfi ve
// (biliniyorsa) takım kontrol edilir. Kesin aday yoksa null — yanlış oyuncunun kariyerini göstermektense hiç.
export function findAthlete(name: string, firstName: string | null, teamName: string | null): Promise<{ id: string; team: string | null } | null> {
  return cached(`search:${name}:${teamName ?? ''}`, 7 * DAY, async () => {
    const parts = tokens(name)
    const surname = parts[parts.length - 1]
    if (!surname || surname.length < 3) return null
    const raw = await fetchJson<EspnSearch>(LABEL, `${BASE}/apis/search/v2?query=${encodeURIComponent(surname)}&limit=15&type=player`)
    const people = (raw?.results ?? []).flatMap((r) => (r.type === 'player' ? (r.contents ?? []) : []))
    // s:600 = futbol
    const soccer = people.filter((p) => p.uid.startsWith('s:600~'))
    const initial = (firstName ? tokens(firstName)[0] : parts.length > 1 ? parts[0] : '')?.[0]
    const candidates = soccer.filter((p) => {
      const t = tokens(p.displayName)
      return t.includes(surname) && (!initial || t[0]?.startsWith(initial))
    })
    const byTeam = teamName ? candidates.filter((p) => p.subtitle && tokens(p.subtitle).some((t) => tokens(teamName).includes(t))) : []
    const pick = byTeam.length === 1 ? byTeam[0] : candidates.length === 1 ? candidates[0] : null
    const id = pick?.uid.match(/a:(\d+)/)?.[1]
    return id && pick ? { id, team: pick.subtitle ? turkishTeamName(pick.subtitle) : null } : null
  })
}

// ---------- Kariyer ----------
const statsUrl = (id: string, query = '') => `${BASE}/apis/common/v3/sports/soccer/athletes/${id}/stats${query}`

// "2025-26 English Premier League" -> 2025 ve "English Premier League"; "2026 MLS" -> 2026
function parseSeason(displayName: string) {
  const m = displayName.match(/^(\d{4})(?:-\d{2})?\s+(.*)$/)
  return m ? { season: Number(m[1]), league: m[2] } : null
}

// ESPN lig logo adresleri tutarsız (bazıları 404): logo, sitenin her yerinde olduğu gibi API-Football'dan.
// ESPN lig kodu -> API-Football lig id'si: lig sayfası olan 29 lig + sık görülen kupalar
const CUP_IDS: Record<string, number> = {
  'eng.fa': 45, 'eng.league_cup': 48, 'eng.charity': 528, 'esp.copa_del_rey': 143, 'esp.super_cup': 556,
  'ger.dfb_pokal': 81, 'ger.super_cup': 529, 'ita.coppa_italia': 137, 'ita.super_cup': 547, 'fra.coupe_de_france': 66,
  'tur.cup': 206, 'uefa.super_cup': 531, 'uefa.nations': 5, 'fifa.cwc': 15, 'fifa.world': 1, 'uefa.euro': 4,
}
const API_LEAGUE_BY_SLUG = new Map<string, number>([
  ...Object.entries(LEAGUE_SOURCES).map(([id, src]) => [src.espn, Number(id)] as [string, number]),
  ...Object.entries(CUP_IDS),
])
const leagueLogo = (slug: string) => {
  const id = API_LEAGUE_BY_SLUG.get(slug)
  return id ? `https://media.api-sports.io/football/leagues/${id}.png` : undefined
}

function rowsFrom(raw: EspnAthleteStats, team: { id: string; name: string }, leagueSlug: string): CareerRow[] {
  const cat = raw.categories?.[0]
  if (!cat) return []
  // Sütun adı bazen uzun ("totalGoals"), bazen kısaltma ("G") geliyor: ikisi de aranır
  const at = (row: string[], name: string) => {
    const i = cat.names.findIndex((n) => n === name || n === SHORT[name])
    return i === -1 ? 0 : Number(row[i]) || 0
  }
  return cat.statistics.flatMap((s) => {
    const parsed = parseSeason(s.season.displayName)
    if (!parsed) return []
    return [
      {
        season: parsed.season,
        // ESPN'in kısa adı varsa o ("English Premier League" yerine "Premier League")
        league: raw.leagues?.[leagueSlug]?.displayName ?? parsed.league,
        leagueSlug,
        leagueLogo: leagueLogo(leagueSlug),
        teamId: team.id,
        team: turkishTeamName(team.name),
        teamLogo: `https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png`,
        starts: at(s.stats, 'starts'),
        goals: at(s.stats, 'totalGoals'),
        assists: at(s.stats, 'goalAssists'),
        yellow: at(s.stats, 'yellowCards'),
        red: at(s.stats, 'redCards'),
        shots: at(s.stats, 'totalShots'),
        shotsOnTarget: at(s.stats, 'shotsOnTarget'),
      },
    ]
  })
}

const SHORT: Record<string, string> = {
  starts: 'STRT',
  totalGoals: 'G',
  goalAssists: 'A',
  yellowCards: 'YC',
  redCards: 'RC',
  totalShots: 'SHOT',
  shotsOnTarget: 'SOG',
}

const CUPS = ['uefa.champions', 'uefa.europa', 'uefa.europa.conf']

// nationality: oyuncunun milli takımı kariyerden çıkarılsın diye (ESPN takım listesinde milli takımlar da var)
export function getCareer(athleteId: string, nationality: string | null): Promise<CareerRow[]> {
  return cached(`career:v2:${athleteId}`, DAY, async () => {
    const first = await fetchJson<EspnAthleteStats>(LABEL, statsUrl(athleteId))
    const teams = (first?.filters?.find((f) => f.name === 'team')?.options ?? []).filter(
      (t) => !/\bU\d{2}\b/.test(t.displayValue) && (!nationality || teamIdOf(t.displayValue) !== teamIdOf(nationality)),
    )
    // Her kulüp: önce kendi ligi (varsayılan), sonra oynadığı Avrupa kupaları
    const lists = await Promise.all(
      teams.slice(0, 8).map(async (team) => {
        const domestic = await fetchJson<EspnAthleteStats>(LABEL, statsUrl(athleteId, `?team=${team.value}`)).catch(() => null)
        if (!domestic) return []
        const leagueFilter = domestic.filters?.find((f) => f.name === 'league')
        const ref = { id: team.value, name: team.displayValue }
        const rows = rowsFrom(domestic, ref, leagueFilter?.value ?? '')
        const cups = (leagueFilter?.options ?? []).map((o) => o.value).filter((v) => CUPS.includes(v) && v !== leagueFilter?.value)
        const cupRows = await Promise.all(
          cups.map((cup) =>
            fetchJson<EspnAthleteStats>(LABEL, statsUrl(athleteId, `?team=${team.value}&league=${cup}`))
              .then((raw) => (raw ? rowsFrom(raw, ref, cup) : []))
              .catch(() => []),
          ),
        )
        return [...rows, ...cupRows.flat()]
      }),
    )
    // Hiç izi olmayan satırlar (transfer döneminde kadroda görünüp oynamadığı sezon) gösterilmez
    const played = lists.flat().filter((r) => r.starts + r.goals + r.assists + r.yellow + r.red + r.shots > 0)
    return played.sort((a, b) => b.season - a.season || a.team.localeCompare(b.team))
  })
}

// ---------- Profil ----------
interface EspnAthleteProfile {
  athlete?: {
    displayName: string
    age?: number
    dateOfBirth?: string
    citizenship?: string
    displayHeight?: string
    displayWeight?: string
    position?: { displayName?: string }
    jersey?: string
    team?: { id: string; displayName: string; logos?: { href: string }[] }
  }
}

const POSITIONS: Record<string, string> = { Goalkeeper: 'Kaleci', Defender: 'Defans', Midfielder: 'Orta saha', Forward: 'Forvet' }

// ESPN boy/kilo ABD ölçüsünde: 6' 5" -> 196 cm, 205 lbs -> 93 kg
function heightCm(display?: string) {
  const m = display?.match(/(\d+)'\s*(\d+)/)
  return m ? `${Math.round((Number(m[1]) * 12 + Number(m[2])) * 2.54)} cm` : null
}
function weightKg(display?: string) {
  const m = display?.match(/(\d+)\s*lbs/)
  return m ? `${Math.round(Number(m[1]) * 0.4536)} kg` : null
}

// Aramadan ya da krallık listesinden açılan oyuncu (ESPN id'si): profil ESPN'den
export function getAthleteProfile(athleteId: string): Promise<PlayerProfile | null> {
  return cached(`profile:${athleteId}`, DAY, async () => {
    const a = (await fetchJson<EspnAthleteProfile>(LABEL, `${BASE}/apis/common/v3/sports/soccer/athletes/${athleteId}`))?.athlete
    if (!a) return null
    const position = a.position?.displayName
    return {
      id: `espn-${athleteId}`,
      name: a.displayName,
      age: a.age ?? null,
      birthDate: a.dateOfBirth ?? null,
      nationality: a.citizenship ?? null,
      height: heightCm(a.displayHeight),
      weight: weightKg(a.displayWeight),
      number: a.jersey ? Number(a.jersey) : null,
      position: position ? (POSITIONS[position] ?? position) : null,
      team: a.team ? { id: `espn-${a.team.id}`, name: turkishTeamName(a.team.displayName), logo: a.team.logos?.[0]?.href } : null,
    }
  })
}
