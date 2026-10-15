import type { Side } from './matchDetail'

// Uygulamanın kullandığı sade oyuncu istatistiği. API'den gelen veri bu şekle çevrilir,
// böylece API değişse bile bileşenler etkilenmez.
export interface PlayerMatchStats {
  playerId: string
  name: string
  side: Side
  photo?: string
  /** 6.7 gibi; veri yoksa null (maç başlamadı, oyuncu oynamadı) */
  rating: number | null
  minutes: number | null
  goals: number
  assists: number
  ownGoals: number
  shots: number | null
  shotsOnTarget: number | null
  passes: number | null
  /** İsabetli pas yüzdesi (0-100) */
  passAccuracy: number | null
  duelsWon: number | null
  duelsTotal: number | null
  yellow: number
  red: number
  /** Oyuna girdiği / oyundan çıktığı dakika */
  subIn: number | null
  subOut: number | null
}

// ---------- API-Football /fixtures/players ham yanıt tipleri ----------
// Not: API sayısal değerleri bazen string döndürür (rating: "7.3"), bu yüzden union tipler var.
export interface ApiPlayerStatistics {
  games: { minutes: number | null; number: number | null; position: string | null; rating: string | null; substitute: boolean }
  shots: { total: number | null; on: number | null }
  goals: { total: number | null; assists: number | null; conceded: number | null; saves: number | null }
  passes: { total: number | null; key: number | null; accuracy: string | number | null }
  duels: { total: number | null; won: number | null }
  cards: { yellow: number | null; red: number | null }
}

export interface ApiFixturePlayersTeam {
  team: { id: number; name: string; logo: string }
  players: {
    player: { id: number; name: string; photo: string }
    statistics: ApiPlayerStatistics[]
  }[]
}
