import type { TeamRef } from './matchDetail'

// Oyuncu sayfası başlığı (API: /players/profiles?player=)
export interface PlayerProfile {
  id: string
  name: string
  photo?: string
  age: number | null
  /** ISO tarih: "2007-07-13" */
  birthDate: string | null
  nationality: string | null
  /** "180 cm" */
  height: string | null
  /** "72 kg" */
  weight: string | null
  number: number | null
  position: string | null
  team: TeamRef | null
  /** true ise örnek (mock) veri; sayfada etiketle belirtilir */
  isMock?: boolean
}

// Bir sezonda tek bir ligdeki istatistikler (API: /players?id=&season=)
// Değer yoksa null: arayüz sadece verisi olan alanları gösterir.
export interface PlayerLeagueStats {
  league: { id: string; name: string; logo?: string; country?: string }
  team: TeamRef
  appearances: number | null
  lineups: number | null
  minutes: number | null
  goals: number | null
  assists: number | null
  rating: number | null
  yellow: number | null
  red: number | null
  passes: number | null
  shots: number | null
  shotsOnTarget: number | null
  duelsTotal: number | null
  duelsWon: number | null
}

export interface PlayerSeasonStats {
  season: number
  leagues: PlayerLeagueStats[]
}

// Kariyer tablosunun bir satırı: bir sezon + bir takım (API: /players/teams?player=)
// Not: API bu uç noktada sadece takım ve sezonları verir; lig ve sayılar orada null kalır.
export interface CareerEntry {
  season: number
  team: TeamRef
  league: string | null
  appearances: number | null
  /** İlk 11'de başladığı maç (ESPN toplam maç vermiyor, bunu veriyor) */
  starts?: number | null
  goals: number | null
  assists: number | null
}

// Transfer türü: bonservis bedeli / kiralık / serbest / bilinmiyor (API: /transfers?player=)
export type TransferKind = 'fee' | 'loan' | 'free' | 'unknown'

export interface PlayerTransfer {
  date: string
  from: TeamRef
  to: TeamRef
  kind: TransferKind
  /** Bedel varsa ("€ 20M"); yoksa null — uydurulmaz */
  fee: string | null
}

// Kupa / derece (API: /trophies?player=)
export interface PlayerTrophy {
  competition: string
  country: string | null
  /** "2024/2025" veya "2024" */
  season: string
  place: 'winner' | 'runnerup' | 'other'
  /** place "other" ise API'nin yazdığı derece */
  placeLabel?: string
}
