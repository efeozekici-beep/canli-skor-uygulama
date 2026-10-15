import type { BasketballExtras } from './basketball'

export type MatchStatus = 'live' | 'finished' | 'upcoming'

export interface Match {
  id: string
  sport: string
  leagueId: string
  leagueName: string
  leagueLogo?: string
  region: string
  /** Popular leagues start expanded and are listed first. */
  featured?: boolean
  homeTeam: string
  awayTeam: string
  /** API team ids; mock data leaves them empty and derives one from the name. */
  homeTeamId?: string
  awayTeamId?: string
  homeLogo?: string
  awayLogo?: string
  homeScore: number | null
  awayScore: number | null
  status: MatchStatus
  /** Elapsed minute while live, null otherwise. */
  minute: number | null
  /** Short label shown instead of the minute/"MS", e.g. "İY", "ERT", "90+3'". */
  statusLabel?: string
  /** Kick-off time as an ISO string. */
  startTime: string
  /** League season (API-Football), needed for the standings request. */
  season?: number
  /** Basketball only: quarter scores, period and clock. */
  basketball?: BasketballExtras
}
