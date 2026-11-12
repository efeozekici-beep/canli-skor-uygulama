// Takım sayfası (#/takim/...) için sade tipler. API'den gelen veri bunlara çevrilir.

export interface TeamInfo {
  /** API-Football takım id'si */
  id: string
  name: string
  logo?: string
  /** Türkçe ülke adı (Türkiye, İngiltere...) */
  country: string
  founded: number | null
  venue: { name: string; city: string | null; capacity: number | null; image?: string } | null
}

export type SquadPosition = 'G' | 'D' | 'M' | 'F'

export interface SquadPlayer {
  /** API-Football oyuncu id'si (oyuncu sayfası bununla açılır) */
  id: string
  name: string
  age: number | null
  number: number | null
  position: SquadPosition
  photo?: string
}

// ---------- İki spor için ortak ----------

// Takımın sezon özeti (puan tablosundaki satırından). Basketbolda beraberlik yok: draw null.
export interface TeamStatsSummary {
  played: number
  won: number
  draw: number | null
  lost: number
  scored: number
  conceded: number
}

// ---------- Basketbol takım sayfası (api/team.ts) ----------
export interface BasketballSquadPlayer {
  id: string
  name: string
  number: string | null
  /** G (guard), F (forward), C (center) */
  position: 'G' | 'F' | 'C'
  age: number | null
  photo: string | null
  /** Bu sezon maç başı ortalamalar; hiç oynamadıysa null */
  stats: { games: number; minutes: number; points: number; rebounds: number; assists: number } | null
}

export interface BasketballTeamGame {
  id: string
  date: string
  /** Turnuva adı (EuroLeague, Basketbol Süper Ligi...) */
  competition?: string
  /** Maç sayfası açılabiliyorsa (API-Basketball maçı) id'si */
  matchId?: string
  status: 'finished' | 'live' | 'upcoming'
  home: { name: string; logo: string | null; score: number | null }
  away: { name: string; logo: string | null; score: number | null }
}

export interface BasketballTeamRef {
  /** NBA: ESPN takım id'si, EuroLeague / EuroCup: kulüp kodu */
  id: string
  name: string
  shortName?: string | null
  logo: string | null
}

// ---------- Basketbol oyuncu sayfası (api/team.ts part=player) ----------
export interface BasketballPlayerProfile {
  name: string
  photo: string | null
  position: string | null
  number: string | null
  age: number | null
  height: string | null
  weight: string | null
  nationality: string | null
  team: string | null
  teamLogo: string | null
}

// Bir sezon + takım + turnuva; maç başı ortalamalar, yüzdeler 0-100
export interface BasketballCareerSeason {
  season: string
  competition: string
  team: string | null
  teamLogo: string | null
  games: number
  starts: number | null
  minutes: number
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  fgPct: number | null
  threePct: number | null
  ftPct: number | null
  /** EuroLeague verimlilik puanı (NBA'de yok) */
  pir: number | null
}
