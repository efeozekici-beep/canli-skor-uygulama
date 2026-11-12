// Arama sonuçları üç gruptur: Takımlar | Ligler | Oyuncular

export interface TeamSearchResult {
  id: string
  name: string
  logo?: string
  country: string | null
  /** Takım sayfası adresi */
  href: string
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
  /** Oyuncu sayfası adresi */
  href: string
}

export interface SearchResults {
  teams: TeamSearchResult[]
  leagues: LeagueSearchResult[]
  players: PlayerSearchResult[]
}
