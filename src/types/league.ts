import type { TeamRef } from './matchDetail'

// Lig sayfasının başlığı için temel bilgiler
export interface LeagueInfo {
  id: string
  name: string
  logo?: string
  region: string
  /** Varsayılan (güncel) sezon, örn. 2026 = 2026/27 */
  currentSeason: number
  /** true ise veriler örnek (mock) veridir; sayfada etiketle belirtilir */
  isMock?: boolean
}

// Bir takımın oynadığı/galibiyet/... sayıları (genel, iç saha veya deplasman için)
export interface StandingSplit {
  played: number
  win: number
  draw: number
  lose: number
  goalsFor: number
  goalsAgainst: number
}

export interface LeagueStandingRow {
  rank: number
  team: TeamRef
  points: number
  goalsDiff: number
  /** Son maçlar, eskiden yeniye: "WWDLW" (W=galibiyet, D=beraberlik, L=mağlubiyet) */
  form: string | null
  /** Bölge açıklaması (Şampiyonlar Ligi, Düşme...); yoksa null */
  description: string | null
  all: StandingSplit
  home: StandingSplit
  away: StandingSplit
}

// Çok gruplu turnuvalarda her grup ayrı tablo (Grup A, Grup B...)
export interface StandingGroup {
  name: string
  rows: LeagueStandingRow[]
}

export interface LeagueStandings {
  leagueId: string
  season: number
  groups: StandingGroup[]
  /** false: kaynak ev/deplasman ayrımı vermiyor (sekmeler gizlenir). Belirtilmemişse var sayılır. */
  hasSplits?: boolean
}

export type StandingsView = 'all' | 'home' | 'away'

// Oyuncu istatistik listeleri (gol, asist, sarı/kırmızı kart)
export type PlayerStatKind = 'goals' | 'assists' | 'yellow' | 'red'

export interface PlayerStatEntry {
  playerId: string
  name: string
  photo?: string
  team: TeamRef
  value: number
}

// Lig maçları: biten (sonuçlar) veya oynanacak (fikstür)
export type FixtureKind = 'results' | 'fixtures'
