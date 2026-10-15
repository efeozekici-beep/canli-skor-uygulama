import type { PlayerMatchStats } from '../types/playerStats'

// API-Football reyting'i string döndürür ("7.3"). Sayıya çevirir, geçersizse null verir.
export function normalizeRating(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 10) / 10
}

// Rozet rengi: 9+ mavi, 8-8.9 yeşil, 7-7.9 sarı-yeşil, 6-6.9 turuncu, 6 altı kırmızı
export function ratingTone(rating: number) {
  if (rating >= 9) return 'bg-sky-500 text-white'
  if (rating >= 8) return 'bg-green-500 text-pitch-950'
  if (rating >= 7) return 'bg-lime-400 text-pitch-950'
  if (rating >= 6) return 'bg-amber-400 text-pitch-950'
  return 'bg-red-500 text-white'
}

export function formatRating(rating: number) {
  return rating.toFixed(1)
}

// Reytingi olan oyuncuların ortalaması (örn. 6.89). Hiç reyting yoksa null.
export function teamAverageRating(players: PlayerMatchStats[]): number | null {
  const rated = players.filter((p) => p.rating !== null)
  if (rated.length === 0) return null
  const sum = rated.reduce((total, p) => total + (p.rating ?? 0), 0)
  return Math.round((sum / rated.length) * 100) / 100
}

// Maçın adamı: en yüksek reyting; eşitlikte gol+asist, sonra gol fazla olan, sonra isim.
export function getManOfTheMatch(players: PlayerMatchStats[]): PlayerMatchStats | null {
  const rated = players.filter((p) => p.rating !== null)
  if (rated.length === 0) return null
  return [...rated].sort(
    (a, b) =>
      (b.rating ?? 0) - (a.rating ?? 0) ||
      b.goals + b.assists - (a.goals + a.assists) ||
      b.goals - a.goals ||
      a.name.localeCompare(b.name, 'tr'),
  )[0]
}
