import type { Match } from './match'

// Ev sahibi mi deplasman mı? Olaylar ve kadrolar bu alana göre sola/sağa yerleşir.
export type Side = 'home' | 'away'

export interface TeamRef {
  id: string
  name: string
  logo?: string
}

// Panel başlığı için maçın kendisi + ek bilgiler (API: /fixtures?id=)
export interface MatchDetail {
  match: Match
  round?: string
  venue?: string
  referee?: string
}

// ---------- Olaylar (API: /fixtures/events) ----------
export type MatchEventKind = 'goal' | 'own-goal' | 'penalty' | 'missed-penalty' | 'yellow' | 'red' | 'second-yellow' | 'sub'

export interface MatchEvent {
  id: string
  minute: number
  /** Uzatma dakikası (45+2 için 2) */
  extra: number | null
  /** Olayın gösterileceği taraf. Kendi kalesine golde golü kazanan takım. */
  side: Side
  kind: MatchEventKind
  playerId?: string
  /** Golü atan / kartı gören / oyuna giren oyuncu */
  player: string
  /** Asist yapan oyuncu ya da oyundan çıkan oyuncu */
  secondPlayer?: string
  secondPlayerId?: string
}

// ---------- Kadrolar (API: /fixtures/lineups) ----------
export type PlayerPosition = 'G' | 'D' | 'M' | 'F'

export interface LineupPlayer {
  id: string
  name: string
  number: number
  position: PlayerPosition
  /** API-Football biçimi "satır:sütun" (1:1 kaleci). Yedeklerde null. */
  grid: string | null
  photo?: string
}

export interface TeamLineup {
  team: TeamRef
  formation: string
  coach: string
  coachPhoto?: string
  startXI: LineupPlayer[]
  substitutes: LineupPlayer[]
}

export interface Lineups {
  home: TeamLineup
  away: TeamLineup
}

// ---------- İstatistikler (API: /fixtures/statistics) ----------
export interface StatItem {
  key: string
  label: string
  home: number
  away: number
  /** Yüzde değerler (topla oynama gibi) */
  unit?: '%'
}

// ---------- Puan durumu (API: /standings) ----------
export interface StandingRow {
  rank: number
  team: TeamRef
  played: number
  win: number
  draw: number
  lose: number
  goalsFor: number
  goalsAgainst: number
  goalsDiff: number
  points: number
}

export interface Standings {
  leagueId: string
  leagueName: string
  rows: StandingRow[]
}

// ---------- Form ve aralarındaki maçlar (API: /fixtures?team=&last=5, /fixtures/headtohead) ----------
export interface PastMatch {
  id: string
  date: string
  leagueName: string
  home: TeamRef
  away: TeamRef
  homeScore: number
  awayScore: number
}

export interface FormH2H {
  homeLast: PastMatch[]
  awayLast: PastMatch[]
  h2h: PastMatch[]
}
