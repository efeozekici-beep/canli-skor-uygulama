// Arama sonuçları üç gruptur: Takımlar | Ligler | Oyuncular

export interface TeamSearchResult {
  id: string
  name: string
  logo?: string
  country: string | null
}

export interface LeagueSearchResult {
  id: string
  name: string
  logo?: string
  region: string | null
}

export interface PlayerSearchResult {
  id: string
  name: string
  photo?: string
  /** Oyuncunun güncel takımı (biliniyorsa) */
  teamName: string | null
  teamLogo?: string
}

export interface SearchResults {
  teams: TeamSearchResult[]
  leagues: LeagueSearchResult[]
  players: PlayerSearchResult[]
}
