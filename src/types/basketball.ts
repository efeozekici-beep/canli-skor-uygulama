import type { TeamRef } from './matchDetail'

// ---------- Maça eklenen basketbol bilgileri (Match.basketball) ----------
export interface PeriodScore {
  /** "1Ç", "2Ç", "3Ç", "4Ç", "Uz" */
  label: string
  home: number | null
  away: number | null
}

export interface BasketballExtras {
  /** Çeyrek skorları (oynanmamış çeyrekler null) + varsa uzatma */
  periods: PeriodScore[]
  /** Oynanan çeyrek (canlıyken), yoksa null */
  period: number | null
  /** Çeyrekte kalan süre "05:42" (canlıyken), yoksa null */
  clock: string | null
  /** Puan durumu isteği için sezon ("2026-2027") */
  season: string | null
}

// ---------- Basketbol puan durumu (beraberlik yok: galibiyet / mağlubiyet / yüzde) ----------
export interface BasketballStandingRow {
  rank: number
  team: TeamRef
  played: number
  won: number
  lost: number
  /** 0.750 gibi; bilinmiyorsa null */
  winPct: number | null
  pointsFor: number
  pointsAgainst: number
  form: string | null
  description: string | null
}

export interface BasketballStandingGroup {
  /** "Doğu Konferansı", "Batı Konferansı" ya da lig adı */
  name: string
  rows: BasketballStandingRow[]
}

export interface BasketballStandings {
  leagueId: string
  season: string
  groups: BasketballStandingGroup[]
}

// ---------- Box score (NBA: API-NBA, diğer ligler: API-Basketball) ----------
// Bazı kaynaklar top çalma / blok / top kaybı / +/- vermez: o alanlar null kalır, tabloda "–" görünür.
export interface NbaPlayerLine {
  playerId: string
  name: string
  position: string | null
  minutes: string | null
  points: number
  rebounds: number
  assists: number
  steals: number | null
  blocks: number | null
  turnovers: number | null
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  plusMinus: number | null
}

export interface NbaTeamBox {
  team: TeamRef
  players: NbaPlayerLine[]
}

export interface NbaBoxScore {
  gameId: string
  home: NbaTeamBox
  away: NbaTeamBox
  /** Oyuncu profili hangi kaynakta var: NBA maçlarında API-NBA, diğerlerinde yok */
  profiles: 'nba' | null
}

export interface NbaPlayerProfile {
  id: string
  name: string
  position: string | null
  jersey: number | null
  /** "2.06 m" */
  height: string | null
  /** "113 kg" */
  weight: string | null
  birthDate: string | null
  country: string | null
  college: string | null
  nbaStart: number | null
}

// Box score sonucu: eşleşen NBA maçı bulunamazsa hata değil "no-match"
export type NbaDetailResult = { kind: 'matched'; box: NbaBoxScore } | { kind: 'no-match' }
