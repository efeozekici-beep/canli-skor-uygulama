import type { Match } from '../types/match'
import { addDays, startOfDay } from '../lib/date'

// Kick-off times are built relative to today so the mock always has
// matches on "Bugün", "Dün" and "Yarın".
function at(dayOffset: number, time: string) {
  const [h, m] = time.split(':').map(Number)
  const d = addDays(startOfDay(new Date()), dayOffset)
  d.setHours(h, m)
  return d.toISOString()
}

const ucl = { sport: 'football', leagueId: 'ucl', leagueName: 'UEFA Champions League', region: 'Avrupa', featured: true }
const uel = { sport: 'football', leagueId: 'uel', leagueName: 'UEFA Europa League', region: 'Avrupa', featured: true }
const tsl = { sport: 'football', leagueId: 'tsl', leagueName: 'Trendyol Süper Lig', region: 'Türkiye', featured: true }
const pl = { sport: 'football', leagueId: 'pl', leagueName: 'Premier League', region: 'İngiltere', featured: true }

const upcoming = { homeScore: null, awayScore: null, status: 'upcoming', minute: null } as const

export const MOCK_MATCHES: Match[] = [
  // Bugün — Şampiyonlar Ligi
  { ...ucl, id: 'ucl-1', homeTeam: 'Feyenoord', awayTeam: 'Como', homeScore: 2, awayScore: 1, status: 'live', minute: 61, startTime: at(0, '19:45') },
  { ...ucl, id: 'ucl-2', homeTeam: 'LASK', awayTeam: 'Liverpool', homeScore: 1, awayScore: 4, status: 'live', minute: 66, startTime: at(0, '19:45') },
  { ...ucl, ...upcoming, id: 'ucl-3', homeTeam: 'Roma', awayTeam: 'Real Madrid', startTime: at(0, '22:00') },
  { ...ucl, ...upcoming, id: 'ucl-4', homeTeam: 'Aston Villa', awayTeam: 'Fenerbahçe', startTime: at(0, '22:00') },
  { ...ucl, ...upcoming, id: 'ucl-5', homeTeam: 'Bodø/Glimt', awayTeam: 'Dortmund', startTime: at(0, '22:00') },
  { ...ucl, ...upcoming, id: 'ucl-6', homeTeam: 'Man City', awayTeam: 'PSG', startTime: at(0, '22:00') },
  { ...ucl, ...upcoming, id: 'ucl-7', homeTeam: 'Real Betis', awayTeam: 'Porto', startTime: at(0, '22:00') },
  { ...ucl, ...upcoming, id: 'ucl-8', homeTeam: 'Shakhtar', awayTeam: 'AEK', startTime: at(0, '22:00') },
  { ...ucl, ...upcoming, id: 'ucl-9', homeTeam: 'Slovan Bratislava', awayTeam: 'Club Brugge', startTime: at(0, '22:00') },

  // Bugün — Süper Lig (biten + canlı maçlar, filtreleri test etmek için)
  { ...tsl, id: 'tsl-1', homeTeam: 'Göztepe', awayTeam: 'Alanyaspor', homeScore: 0, awayScore: 0, status: 'finished', minute: null, startTime: at(0, '14:30') },
  { ...tsl, id: 'tsl-2', homeTeam: 'Samsunspor', awayTeam: 'Kasımpaşa', homeScore: 3, awayScore: 1, status: 'finished', minute: null, startTime: at(0, '17:00') },
  { ...tsl, id: 'tsl-3', homeTeam: 'Trabzonspor', awayTeam: 'Konyaspor', homeScore: 1, awayScore: 0, status: 'live', minute: 78, startTime: at(0, '19:00') },

  // Bugün — Premier League
  { ...pl, id: 'pl-1', homeTeam: 'Newcastle', awayTeam: 'Brighton', homeScore: 1, awayScore: 0, status: 'live', minute: 34, startTime: at(0, '21:00') },
  { ...pl, ...upcoming, id: 'pl-2', homeTeam: 'Arsenal', awayTeam: 'Chelsea', startTime: at(0, '22:00') },

  // Dün
  { ...tsl, id: 'tsl-4', homeTeam: 'Galatasaray', awayTeam: 'Beşiktaş', homeScore: 2, awayScore: 1, status: 'finished', minute: null, startTime: at(-1, '20:00') },
  { ...tsl, id: 'tsl-5', homeTeam: 'Kayserispor', awayTeam: 'Rizespor', homeScore: 1, awayScore: 1, status: 'finished', minute: null, startTime: at(-1, '17:00') },

  // Yarın — Avrupa Ligi
  { ...uel, ...upcoming, id: 'uel-1', homeTeam: 'Lyon', awayTeam: 'Beşiktaş', startTime: at(1, '19:45') },
  { ...uel, ...upcoming, id: 'uel-2', homeTeam: 'Lazio', awayTeam: 'Ajax', startTime: at(1, '22:00') },
  { ...uel, ...upcoming, id: 'uel-3', homeTeam: 'Galatasaray', awayTeam: 'Tottenham', startTime: at(1, '22:00') },
]
