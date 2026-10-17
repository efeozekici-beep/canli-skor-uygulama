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

// Farklı kaynaklar aynı takımı farklı yazar ("Real Betis" / "Real Betis Balompié", "Besiktas" / "Beşiktaş").
// Ortak ayırt edici bir kelime varsa aynı takım sayılır. Birçok kulübün adında geçen genel kelimeler
// (FC, City, Maccabi, Dinamo...) sayılmaz: yoksa "Maccabi Haifa" ile "Maccabi Netanya" aynı sanılır.
const GENERIC_TEAM_WORDS = new Set([
  'fc', 'afc', 'cf', 'sc', 'club', 'calcio', 'sport', 'sporting', 'united', 'city', 'real', 'town', 'county', 'women',
  'maccabi', 'hapoel', 'beitar', 'bnei', 'dinamo', 'dynamo', 'atletico', 'athletic', 'deportivo', 'racing', 'olympique',
  'union', 'inter', 'rapid', 'spartak', 'lokomotiv', 'cska', 'young', 'boys', 'rovers', 'wanderers', 'saint', 'san',
])
const allTokens = (name: string) =>
  teamIdOf(name)
    .split('-')
    .filter((t) => t.length > 2)
// Ayırt edici kelimeler; adı sadece genel kelimelerden oluşuyorsa ("Lokomotiv") onlar
const distinctTokens = (name: string) => {
  const all = allTokens(name)
  const distinct = all.filter((t) => !GENERIC_TEAM_WORDS.has(t))
  return distinct.length > 0 ? distinct : all
}

export function sameTeamName(a: string, b: string) {
  if (teamIdOf(a) === teamIdOf(b)) return true
  // Birinin ayırt edici kelimesi diğerinin adında geçmeli ("Lokomotiv" ~ "Lokomotiv Moscow",
  // ama "Maccabi Haifa" !~ "Maccabi Netanya")
  const inName = (tokens: string[], name: string) => tokens.some((t) => allTokens(name).includes(t))
  return inName(distinctTokens(a), b) || inName(distinctTokens(b), a)
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
