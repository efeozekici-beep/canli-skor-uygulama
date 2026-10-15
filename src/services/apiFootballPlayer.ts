import type { CareerEntry, PlayerLeagueStats, PlayerProfile, PlayerSeasonStats, PlayerTransfer, PlayerTrophy, TransferKind } from '../types/player'
import { apiGet } from './apiFootball'
import { normalizeRating } from '../lib/ratings'

// API-Football oyuncu uç noktaları ve dönüştürücüleri. Henüz playerService'e bağlı değil (şimdilik mock).
// Ücretsiz planda sezon kısıtı olabilir (2022–2024); boş dönen yanıt hata değil, "veri yok" sayılır.

// ---------- /players/profiles?player= ----------
interface ApiPlayer {
  id: number
  name: string
  photo: string
  age: number | null
  birth: { date: string | null }
  nationality: string | null
  height: string | null
  weight: string | null
  number: number | null
  position: string | null
}

const POSITIONS: Record<string, string> = { Goalkeeper: 'Kaleci', Defender: 'Defans', Midfielder: 'Orta saha', Attacker: 'Forvet' }

export function mapProfile(items: { player: ApiPlayer }[]): PlayerProfile | null {
  const p = items[0]?.player
  if (!p) return null
  return {
    id: String(p.id),
    name: p.name,
    photo: p.photo,
    age: p.age,
    birthDate: p.birth.date,
    nationality: p.nationality,
    height: p.height,
    weight: p.weight,
    number: p.number,
    position: p.position ? (POSITIONS[p.position] ?? p.position) : null,
    team: null, // profil uç noktası takımı vermez; güncel sezon istatistiklerinden doldurulabilir
  }
}

export async function fetchProfile(id: string) {
  return mapProfile(await apiGet<{ player: ApiPlayer }[]>(`/players/profiles?player=${id}`))
}

// ---------- /players?id=&season= ----------
interface ApiStatBlock {
  team: { id: number; name: string; logo: string }
  league: { id: number | null; name: string; logo: string; country: string }
  games: { appearences: number | null; lineups: number | null; minutes: number | null; rating: string | null }
  goals: { total: number | null; assists: number | null }
  cards: { yellow: number | null; red: number | null }
  passes: { total: number | null }
  shots: { total: number | null; on: number | null }
  duels: { total: number | null; won: number | null }
}

export function mapSeasonStats(items: { statistics: ApiStatBlock[] }[], season: number): PlayerSeasonStats | null {
  const blocks = items[0]?.statistics ?? []
  // Hiç maça çıkmadığı ligleri gösterme
  const leagues: PlayerLeagueStats[] = blocks
    .filter((s) => (s.games.appearences ?? 0) > 0)
    .map((s) => ({
      league: { id: String(s.league.id ?? s.league.name), name: s.league.name, logo: s.league.logo, country: s.league.country },
      team: { id: String(s.team.id), name: s.team.name, logo: s.team.logo },
      // Not: API'de alan adı "appearences" (yazım hatası API'ye ait)
      appearances: s.games.appearences,
      lineups: s.games.lineups,
      minutes: s.games.minutes,
      goals: s.goals.total,
      assists: s.goals.assists,
      rating: normalizeRating(s.games.rating),
      yellow: s.cards.yellow,
      red: s.cards.red,
      passes: s.passes.total,
      shots: s.shots.total,
      shotsOnTarget: s.shots.on,
      duelsTotal: s.duels.total,
      duelsWon: s.duels.won,
    }))
  return leagues.length > 0 ? { season, leagues } : null
}

export async function fetchSeasonStats(id: string, season: number) {
  return mapSeasonStats(await apiGet<{ statistics: ApiStatBlock[] }[]>(`/players?id=${id}&season=${season}`), season)
}

// ---------- /players/seasons?player= ----------
export async function fetchSeasons(id: string): Promise<number[]> {
  const seasons = await apiGet<number[]>(`/players/seasons?player=${id}`)
  return [...seasons].sort((a, b) => b - a)
}

// ---------- /players/teams?player= ----------
interface ApiPlayerTeam {
  team: { id: number; name: string; logo: string }
  seasons: number[]
}

// API sadece takım + sezon listesi verir; her sezon ayrı satır olur, lig ve sayılar null kalır.
export function mapCareer(items: ApiPlayerTeam[]): CareerEntry[] {
  return items
    .flatMap(({ team, seasons }) =>
      seasons.map((season) => ({
        season,
        team: { id: String(team.id), name: team.name, logo: team.logo },
        league: null,
        appearances: null,
        goals: null,
        assists: null,
      })),
    )
    .sort((a, b) => b.season - a.season)
}

export async function fetchCareer(id: string) {
  return mapCareer(await apiGet<ApiPlayerTeam[]>(`/players/teams?player=${id}`))
}

// ---------- /transfers?player= ----------
interface ApiTransfer {
  date: string
  type: string | null // "€ 20M", "Loan", "Free", "N/A", "Back from Loan"...
  teams: { in: { id: number; name: string; logo: string }; out: { id: number; name: string; logo: string } }
}

function transferKind(type: string | null): { kind: TransferKind; fee: string | null } {
  if (!type || /^n\/?a$/i.test(type) || type === '-') return { kind: 'unknown', fee: null }
  if (/loan/i.test(type)) return { kind: 'loan', fee: null }
  if (/free/i.test(type)) return { kind: 'free', fee: null }
  // Bedel içeriyorsa (para birimi ya da rakam) bonservis bedeli
  if (/[€$£]|\d/.test(type)) return { kind: 'fee', fee: type }
  return { kind: 'unknown', fee: null }
}

export function mapTransfers(items: { transfers: ApiTransfer[] }[]): PlayerTransfer[] {
  return (items[0]?.transfers ?? [])
    .map((t) => ({
      date: t.date,
      from: { id: String(t.teams.out.id), name: t.teams.out.name, logo: t.teams.out.logo },
      to: { id: String(t.teams.in.id), name: t.teams.in.name, logo: t.teams.in.logo },
      ...transferKind(t.type),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function fetchTransfers(id: string) {
  return mapTransfers(await apiGet<{ transfers: ApiTransfer[] }[]>(`/transfers?player=${id}`))
}

// ---------- /trophies?player= ----------
interface ApiTrophy {
  league: string
  country: string | null
  season: string
  place: string // "Winner", "2nd Place"...
}

export function mapTrophies(items: ApiTrophy[]): PlayerTrophy[] {
  return items.map((t) => {
    const place = /winner/i.test(t.place) ? 'winner' : /2nd/i.test(t.place) ? 'runnerup' : 'other'
    return { competition: t.league, country: t.country, season: t.season, place, placeLabel: place === 'other' ? t.place : undefined }
  })
}

export async function fetchTrophies(id: string) {
  return mapTrophies(await apiGet<ApiTrophy[]>(`/trophies?player=${id}`))
}
