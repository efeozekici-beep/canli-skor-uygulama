import type { CareerEntry, PlayerProfile, PlayerSeasonStats, PlayerTransfer, PlayerTrophy } from '../types/player'
import { findMockPlayer } from '../data/mockPlayers'
import { readStore, writeStore } from '../lib/storageCache'
import { currentSeasonFor } from '../lib/league'

// Oyuncu sayfasının tek veri kapısı. Şimdilik mock döndürür (src/data/mockPlayers.ts).
// API-Football'a geçerken her fonksiyondaki mock çağrısı apiFootballPlayer.ts'deki karşılığıyla değişir:
//   getPlayerProfile -> fetchProfile        getPlayerSeasonStats -> fetchSeasonStats
//   getPlayerSeasons -> fetchSeasons        getPlayerTeams -> fetchCareer
//   getPlayerTransfers -> fetchTransfers    getPlayerTrophies -> fetchTrophies
// "null" / boş liste = veri yok (hata değil).

const HOUR = 60 * 60_000
const WEEK = 7 * 24 * HOUR

// ---------- Önbellek: hafıza + localStorage ----------
const memory = new Map<string, { at: number; promise: Promise<unknown> }>()

function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = memory.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.promise as Promise<T>
  const promise = (async () => {
    const stored = readStore<T>(`canliskor:player:${key}`, ttl, 'local')
    if (stored !== null) return stored
    const value = await load()
    if (value !== null) writeStore(`canliskor:player:${key}`, value, 'local')
    return value
  })()
  memory.set(key, { at: Date.now(), promise })
  promise.catch(() => memory.delete(key))
  return promise
}

// Mock'ta yükleniyor iskeletini görebilmek için küçük gecikme
const delay = <T>(value: T, ms = 250) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

// Doğum tarihinden yaş
function ageFrom(birthDate: string | null) {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

// Profil: 7 gün
export function getPlayerProfile(id: string): Promise<PlayerProfile | null> {
  return cached(`profile:${id}`, WEEK, () => {
    const profile = findMockPlayer(id)?.profile ?? null
    return delay(profile ? { ...profile, age: profile.age ?? ageFrom(profile.birthDate) } : null)
  })
}

// Oynadığı sezonlar (yeniden eskiye): 7 gün
export function getPlayerSeasons(id: string): Promise<number[]> {
  return cached(`seasons:${id}`, WEEK, () => delay(findMockPlayer(id)?.seasons.map((s) => s.season).sort((a, b) => b - a) ?? []))
}

// Sezon istatistikleri: güncel sezon 1 saat (değişiyor), geçmiş sezonlar 7 gün
export function getPlayerSeasonStats(id: string, season: number): Promise<PlayerSeasonStats | null> {
  const ttl = season >= currentSeasonFor() ? HOUR : WEEK
  return cached(`stats:${id}:${season}`, ttl, () => delay(findMockPlayer(id)?.seasons.find((s) => s.season === season) ?? null))
}

// Kariyer (takım geçmişi): 7 gün
export function getPlayerTeams(id: string): Promise<CareerEntry[]> {
  return cached(`teams:${id}`, WEEK, () => delay(findMockPlayer(id)?.career ?? []))
}

// Transferler: 7 gün
export function getPlayerTransfers(id: string): Promise<PlayerTransfer[]> {
  return cached(`transfers:${id}`, WEEK, () => delay(findMockPlayer(id)?.transfers ?? []))
}

// Kupalar: 7 gün
export function getPlayerTrophies(id: string): Promise<PlayerTrophy[]> {
  return cached(`trophies:${id}`, WEEK, () => delay(findMockPlayer(id)?.trophies ?? []))
}
