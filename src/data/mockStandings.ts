import type { PastMatch, Standings } from '../types/matchDetail'
import { teamIdOf } from '../lib/team'
import { addDays, startOfDay } from '../lib/date'

// [takım, O, G, B, M, AG, YG] -> puan ve averaj otomatik hesaplanır
type Raw = [string, number, number, number, number, number, number]

function table(leagueId: string, leagueName: string, raws: Raw[]): Standings {
  const rows = raws
    .map(([name, played, win, draw, lose, goalsFor, goalsAgainst]) => ({
      rank: 0,
      team: { id: teamIdOf(name), name },
      played,
      win,
      draw,
      lose,
      goalsFor,
      goalsAgainst,
      goalsDiff: goalsFor - goalsAgainst,
      points: win * 3 + draw,
    }))
    // Puan, averaj, atılan gol sırasıyla
    .sort((a, b) => b.points - a.points || b.goalsDiff - a.goalsDiff || b.goalsFor - a.goalsFor)
  rows.forEach((row, i) => (row.rank = i + 1))
  return { leagueId, leagueName, rows }
}

export const MOCK_STANDINGS: Record<string, Standings> = {
  ucl: table('ucl', 'UEFA Champions League', [
    ['Liverpool', 1, 1, 0, 0, 3, 0], ['Real Madrid', 1, 1, 0, 0, 2, 0], ['Man City', 1, 1, 0, 0, 2, 1],
    ['PSG', 1, 1, 0, 0, 1, 0], ['Dortmund', 1, 1, 0, 0, 3, 2], ['Feyenoord', 1, 0, 1, 0, 1, 1],
    ['Como', 1, 0, 1, 0, 1, 1], ['Aston Villa', 1, 0, 1, 0, 0, 0], ['Fenerbahçe', 1, 0, 1, 0, 0, 0],
    ['Roma', 1, 0, 0, 1, 1, 2], ['Porto', 1, 0, 0, 1, 0, 1], ['Real Betis', 1, 0, 0, 1, 2, 3],
    ['Shakhtar', 1, 0, 0, 1, 0, 2], ['AEK', 1, 0, 0, 1, 1, 3], ['LASK', 1, 0, 0, 1, 0, 3],
    ['Slovan Bratislava', 1, 0, 0, 1, 0, 2], ['Club Brugge', 1, 0, 1, 0, 2, 2], ['Bodø/Glimt', 1, 0, 0, 1, 1, 3],
  ]),
  tsl: table('tsl', 'Trendyol Süper Lig', [
    ['Galatasaray', 8, 7, 1, 0, 21, 6], ['Fenerbahçe', 8, 6, 1, 1, 18, 7], ['Samsunspor', 8, 5, 2, 1, 14, 8],
    ['Beşiktaş', 8, 5, 1, 2, 15, 9], ['Trabzonspor', 8, 4, 3, 1, 13, 8], ['Göztepe', 8, 4, 2, 2, 12, 9],
    ['Başakşehir', 8, 3, 3, 2, 11, 10], ['Eyüpspor', 8, 3, 2, 3, 10, 11], ['Kasımpaşa', 8, 3, 2, 3, 12, 13],
    ['Konyaspor', 8, 2, 4, 2, 9, 10], ['Alanyaspor', 8, 2, 3, 3, 8, 10], ['Kayserispor', 8, 2, 3, 3, 9, 12],
    ['Rizespor', 8, 2, 2, 4, 8, 12], ['Gaziantep FK', 8, 2, 2, 4, 9, 14], ['Antalyaspor', 8, 1, 4, 3, 7, 11],
    ['Kocaelispor', 8, 1, 3, 4, 6, 12], ['Gençlerbirliği', 8, 1, 2, 5, 6, 14], ['Karagümrük', 8, 0, 3, 5, 5, 15],
  ]),
}

// Form ve H2H için sahte geçmiş maç üretici: aynı takım için her seferinde aynı sonuç çıkar.
const OPPONENTS = ['Ajax', 'Benfica', 'Sevilla', 'Celtic', 'Napoli', 'Sporting CP', 'PSV', 'Villarreal', 'Marseille', 'Rangers']

function seed(text: string) {
  let h = 11
  for (const ch of text) h = (h * 33 + ch.charCodeAt(0)) >>> 0
  return h
}

function past(id: string, daysAgo: number, league: string, home: string, away: string, key: string): PastMatch {
  const h = seed(key)
  return {
    id,
    date: addDays(startOfDay(new Date()), -daysAgo).toISOString(),
    leagueName: league,
    home: { id: teamIdOf(home), name: home },
    away: { id: teamIdOf(away), name: away },
    homeScore: h % 4,
    awayScore: (h >>> 3) % 3,
  }
}

export function mockLastMatches(teamName: string, league: string): PastMatch[] {
  return Array.from({ length: 5 }, (_, i) => {
    const opponent = OPPONENTS[(seed(teamName) + i * 3) % OPPONENTS.length]
    const atHome = i % 2 === 0
    return past(`${teamIdOf(teamName)}-last-${i}`, 4 + i * 7, league, atHome ? teamName : opponent, atHome ? opponent : teamName, `${teamName}${i}`)
  })
}

export function mockHeadToHead(homeName: string, awayName: string, league: string): PastMatch[] {
  return Array.from({ length: 3 }, (_, i) =>
    past(`h2h-${teamIdOf(homeName)}-${teamIdOf(awayName)}-${i}`, 200 + i * 365, league, i % 2 ? awayName : homeName, i % 2 ? homeName : awayName, `${homeName}${awayName}${i}`),
  )
}
