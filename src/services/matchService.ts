import type { Match } from '../types/match'
import { MOCK_MATCHES } from '../data/mockMatches'
import { isSameDay, startOfDay } from '../lib/date'
import { fetchFixtures } from './apiFootball'
import { getBasketballGames } from './basketballService'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// The free API-Football plan allows 100 requests a day, and one request
// returns a whole day, so each day is cached in sessionStorage.
const TTL_TODAY = 90_000
const TTL_PAST = 12 * 60 * 60_000
const TTL_FUTURE = 30 * 60_000

const inflight = new Map<string, Promise<Match[]>>()

function ttlFor(date: Date) {
  const today = startOfDay(new Date()).getTime()
  const day = startOfDay(date).getTime()
  if (day === today) return TTL_TODAY
  return day < today ? TTL_PAST : TTL_FUTURE
}

function cacheKey(date: Date) {
  return `canliskor:fixtures:${date.toDateString()}`
}

function readCache(date: Date): Match[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(date))
    if (!raw) return null
    const { at, matches } = JSON.parse(raw) as { at: number; matches: Match[] }
    return Date.now() - at < ttlFor(date) ? matches : null
  } catch {
    return null
  }
}

function writeCache(date: Date, matches: Match[]) {
  try {
    sessionStorage.setItem(cacheKey(date), JSON.stringify({ at: Date.now(), matches }))
  } catch {
    // Storage full or unavailable; the next call will just refetch.
  }
}

// Matches loaded elsewhere (e.g. a league's fixtures) are remembered here so the match page can open them.
const registry = new Map<string, Match>()
export function registerMatches(matches: Match[]) {
  for (const m of matches) registry.set(m.id, m)
}

// Every match we already know for a day, without a network request (list cache or mock data).
export function knownMatchesForDate(date: Date): Match[] {
  if (USE_MOCK) return MOCK_MATCHES.filter((m) => isSameDay(new Date(m.startTime), date))
  try {
    const { matches } = JSON.parse(sessionStorage.getItem(cacheKey(date)) ?? '{}') as { matches?: Match[] }
    return matches ?? []
  } catch {
    return []
  }
}

// Looks a match up without a network request: mock data, or any day already cached by the list.
export function findMatchById(id: string): Match | null {
  const registered = registry.get(id)
  if (registered) return registered
  if (USE_MOCK) return MOCK_MATCHES.find((m) => m.id === id) ?? null
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (!key?.startsWith('canliskor:fixtures:')) continue
      const { matches } = JSON.parse(sessionStorage.getItem(key) ?? '{}') as { matches?: Match[] }
      const found = matches?.find((m) => m.id === id)
      if (found) return found
    }
  } catch {
    // Ignore unreadable storage.
  }
  return MOCK_MATCHES.find((m) => m.id === id) ?? null
}

// The only place the UI gets match data from.
export async function fetchMatches(sport: string, date: Date, { force = false } = {}): Promise<Match[]> {
  // Basketball has its own providers (and mock switch); see basketballService.
  if (sport === 'basketball') {
    const games = await getBasketballGames(date)
    registerMatches(games)
    return games
  }
  if (USE_MOCK) return MOCK_MATCHES.filter((m) => m.sport === sport && isSameDay(new Date(m.startTime), date))
  // Only football is wired to an API so far.
  if (sport !== 'football') return []

  if (!force) {
    const cached = readCache(date)
    if (cached) return cached
  }

  // Share one request between simultaneous callers (e.g. StrictMode's double effect in dev).
  const key = cacheKey(date)
  const pending = inflight.get(key)
  if (pending) return pending
  const request = fetchFixtures(date)
    .then((matches) => {
      writeCache(date, matches)
      return matches
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, request)
  return request
}
