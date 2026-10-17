import { createCache } from './providers/common'

// Oyuncu fotoğrafları kendi backend'imizden gelir (api/photos.ts): API-NBA ve API-Basketball fotoğraf vermiyor,
// API-Football da teknik direktörlerin çoğunda boş yer tutucu resim veriyor.
// Bir maçtaki bütün oyuncular tek istekte sorulur; cevap tarayıcıda 1 gün saklanır.

export type PhotoLeague = 'nba' | 'basketball' | 'football' | 'football-coach'
export type PhotoMap = Record<string, string | null>

const cached = createCache('photos')
const DAY = 24 * 60 * 60 * 1000

export function getPlayerPhotos(league: PhotoLeague, names: string[]): Promise<PhotoMap> {
  const unique = [...new Set(names)].slice(0, 40) // backend en fazla 40 isim kabul ediyor
  if (unique.length === 0) return Promise.resolve({})
  const query = unique.join('|')
  return cached(`${league}:${query}`, DAY, async () => {
    const res = await fetch(`/api/photos?league=${league}&names=${encodeURIComponent(query)}`)
    if (!res.ok) throw new Error(`Fotoğraflar alınamadı (HTTP ${res.status}).`)
    return ((await res.json()) as { photos: PhotoMap }).photos
  })
}
