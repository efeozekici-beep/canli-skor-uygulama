import type { Match } from '../types/match'

// Takım adından sabit bir kimlik üretir: "Kasımpaşa" -> "kasimpasa".
// Mock veride gerçek takım id'si olmadığı için kullanılır.
export function teamIdOf(name: string) {
  return name
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// API'den id gelmişse onu, gelmemişse addan üretileni kullan.
export function matchTeamIds(match: Match) {
  return {
    home: match.homeTeamId ?? teamIdOf(match.homeTeam),
    away: match.awayTeamId ?? teamIdOf(match.awayTeam),
  }
}

// Logo yokken her takım için hep aynı kalan bir renk.
export function teamColor(name: string) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return `hsl(${Math.abs(hash) % 360} 55% 40%)`
}

// "Mohamed Salah" -> "M. Salah" (dar ekranda zaman çizelgesi için)
export function abbreviateName(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name
}

// "Mohamed Salah" -> "Salah" (sahada yer kazanmak için soyadı)
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(1).join(' ') : name
}
