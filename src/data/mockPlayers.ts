import type { CareerEntry, PlayerLeagueStats, PlayerProfile, PlayerSeasonStats, PlayerTransfer, PlayerTrophy } from '../types/player'
import type { TeamRef } from '../types/matchDetail'
import { teamIdOf } from '../lib/team'

// Örnek oyuncu verisi (Lamine Yamal, Harry Kane, Arda Güler).
// Sayfada "Örnek veri" etiketiyle gösterilir; API'ye bağlanınca bunların yerini gerçek veri alır.

const team = (name: string): TeamRef => ({ id: teamIdOf(name), name })

const LEAGUES = {
  laliga: { id: '140', name: 'La Liga', country: 'İspanya' },
  bundesliga: { id: '78', name: 'Bundesliga', country: 'Almanya' },
  pl: { id: '39', name: 'Premier League', country: 'İngiltere' },
  superlig: { id: '203', name: 'Trendyol Süper Lig', country: 'Türkiye' },
  ucl: { id: '2', name: 'UEFA Champions League', country: 'Avrupa' },
}

// Kısa istatistik tanımı:
// [maç, ilk 11, dakika, gol, asist, reyting, sarı, kırmızı, pas, şut, isabetli şut, ikili mücadele, kazanılan ikili]
type Row = [number, number, number, number, number, number, number, number, number, number, number, number, number]

const stats = (league: keyof typeof LEAGUES, teamName: string, r: Row): PlayerLeagueStats => ({
  league: LEAGUES[league],
  team: team(teamName),
  appearances: r[0],
  lineups: r[1],
  minutes: r[2],
  goals: r[3],
  assists: r[4],
  rating: r[5],
  yellow: r[6],
  red: r[7],
  passes: r[8],
  shots: r[9],
  shotsOnTarget: r[10],
  duelsTotal: r[11],
  duelsWon: r[12],
})

interface MockPlayer {
  profile: PlayerProfile
  seasons: PlayerSeasonStats[]
  career: CareerEntry[]
  transfers: PlayerTransfer[]
  trophies: PlayerTrophy[]
}

const career = (season: number, teamName: string, league: string, apps: number, goals: number, assists: number): CareerEntry => ({
  season,
  team: team(teamName),
  league,
  appearances: apps,
  goals,
  assists,
})

export const MOCK_PLAYERS: MockPlayer[] = [
  {
    profile: {
      id: 'p-yamal',
      name: 'Lamine Yamal',
      age: null, // doğum tarihinden hesaplanır
      birthDate: '2007-07-13',
      nationality: 'İspanya',
      height: '180 cm',
      weight: '72 kg',
      number: 10,
      position: 'Forvet (sağ kanat)',
      team: team('Barcelona'),
      isMock: true,
    },
    seasons: [
      { season: 2026, leagues: [stats('laliga', 'Barcelona', [8, 8, 690, 4, 5, 8.1, 1, 0, 310, 24, 11, 88, 41]), stats('ucl', 'Barcelona', [2, 2, 178, 1, 2, 8.3, 0, 0, 84, 7, 3, 21, 11])] },
      { season: 2025, leagues: [stats('laliga', 'Barcelona', [35, 32, 2810, 9, 13, 7.9, 3, 0, 1260, 98, 41, 402, 180]), stats('ucl', 'Barcelona', [13, 13, 1120, 5, 5, 8.0, 1, 0, 520, 42, 19, 151, 70])] },
      { season: 2024, leagues: [stats('laliga', 'Barcelona', [37, 28, 2410, 5, 9, 7.4, 4, 0, 980, 71, 26, 340, 148]), stats('ucl', 'Barcelona', [10, 8, 760, 1, 3, 7.2, 1, 0, 300, 20, 7, 99, 43])] },
      { season: 2023, leagues: [stats('laliga', 'Barcelona', [1, 0, 7, 0, 0, 6.4, 0, 0, 3, 0, 0, 2, 1])] },
    ],
    career: [
      career(2026, 'Barcelona', 'La Liga', 10, 5, 7),
      career(2025, 'Barcelona', 'La Liga', 48, 14, 18),
      career(2024, 'Barcelona', 'La Liga', 47, 6, 12),
      career(2023, 'Barcelona', 'La Liga', 1, 0, 0),
    ],
    transfers: [], // Altyapıdan yetişti: transfer kaydı yok (boş durum örneği)
    trophies: [
      { competition: 'La Liga', country: 'İspanya', season: '2024/2025', place: 'winner' },
      { competition: 'Copa del Rey', country: 'İspanya', season: '2024/2025', place: 'winner' },
      { competition: 'UEFA Avrupa Şampiyonası', country: 'Avrupa', season: '2024', place: 'winner' },
      { competition: 'La Liga', country: 'İspanya', season: '2022/2023', place: 'winner' },
    ],
  },
  {
    profile: {
      id: 'p-kane',
      name: 'Harry Kane',
      age: null,
      birthDate: '1993-07-28',
      nationality: 'İngiltere',
      height: '188 cm',
      weight: '86 kg',
      number: 9,
      position: 'Forvet',
      team: team('Bayern Münih'),
      isMock: true,
    },
    seasons: [
      { season: 2026, leagues: [stats('bundesliga', 'Bayern Münih', [7, 7, 605, 9, 2, 8.2, 1, 0, 160, 31, 17, 70, 33]), stats('ucl', 'Bayern Münih', [2, 2, 180, 3, 0, 8.4, 0, 0, 44, 9, 6, 18, 9])] },
      { season: 2025, leagues: [stats('bundesliga', 'Bayern Münih', [31, 29, 2560, 26, 9, 7.9, 3, 0, 610, 112, 58, 330, 160]), stats('ucl', 'Bayern Münih', [12, 12, 1050, 11, 3, 7.8, 1, 0, 230, 41, 22, 120, 55])] },
      { season: 2024, leagues: [stats('bundesliga', 'Bayern Münih', [32, 32, 2790, 36, 8, 8.1, 4, 0, 690, 138, 72, 360, 170]), stats('ucl', 'Bayern Münih', [12, 12, 1060, 8, 4, 7.6, 1, 0, 250, 39, 19, 110, 50])] },
      { season: 2023, leagues: [stats('pl', 'Tottenham', [38, 38, 3400, 30, 3, 7.7, 5, 0, 900, 125, 58, 420, 190]), stats('ucl', 'Tottenham', [2, 2, 180, 0, 0, 6.6, 0, 0, 40, 5, 1, 20, 8])] },
    ],
    career: [
      career(2026, 'Bayern Münih', 'Bundesliga', 9, 12, 2),
      career(2025, 'Bayern Münih', 'Bundesliga', 46, 38, 12),
      career(2024, 'Bayern Münih', 'Bundesliga', 45, 44, 12),
      career(2023, 'Tottenham', 'Premier League', 40, 30, 3),
      career(2022, 'Tottenham', 'Premier League', 49, 28, 3),
      career(2021, 'Tottenham', 'Premier League', 50, 27, 9),
      career(2012, 'Leicester City', 'Championship', 13, 2, 1),
      career(2012, 'Norwich City', 'Premier League', 3, 0, 0),
      career(2011, 'Millwall', 'Championship', 27, 9, 0),
      career(2010, 'Leyton Orient', 'League One', 18, 5, 0),
    ],
    transfers: [
      { date: '2023-08-12', from: team('Tottenham'), to: team('Bayern Münih'), kind: 'fee', fee: '€ 95M' },
      { date: '2013-05-31', from: team('Leicester City'), to: team('Tottenham'), kind: 'loan', fee: null },
      { date: '2013-02-21', from: team('Tottenham'), to: team('Leicester City'), kind: 'loan', fee: null },
      { date: '2012-08-31', from: team('Tottenham'), to: team('Norwich City'), kind: 'loan', fee: null },
      { date: '2012-01-01', from: team('Tottenham'), to: team('Millwall'), kind: 'loan', fee: null },
      { date: '2011-01-07', from: team('Tottenham'), to: team('Leyton Orient'), kind: 'loan', fee: null },
    ],
    trophies: [
      { competition: 'Bundesliga', country: 'Almanya', season: '2024/2025', place: 'winner' },
      { competition: 'UEFA Avrupa Şampiyonası', country: 'Avrupa', season: '2024', place: 'runnerup' },
      { competition: 'UEFA Avrupa Şampiyonası', country: 'Avrupa', season: '2020', place: 'runnerup' },
      { competition: 'UEFA Champions League', country: 'Avrupa', season: '2018/2019', place: 'runnerup' },
    ],
  },
  {
    profile: {
      id: 'p-guler',
      name: 'Arda Güler',
      age: null,
      birthDate: '2005-02-25',
      nationality: 'Türkiye',
      height: '176 cm',
      weight: '68 kg',
      number: 15,
      position: 'Orta saha',
      team: team('Real Madrid'),
      isMock: true,
    },
    seasons: [
      { season: 2026, leagues: [stats('laliga', 'Real Madrid', [8, 6, 540, 2, 3, 7.6, 1, 0, 390, 14, 6, 40, 19]), stats('ucl', 'Real Madrid', [2, 1, 120, 0, 1, 7.1, 0, 0, 75, 3, 1, 9, 4])] },
      { season: 2025, leagues: [stats('laliga', 'Real Madrid', [33, 15, 1520, 3, 6, 7.2, 2, 0, 1050, 38, 15, 140, 62]), stats('ucl', 'Real Madrid', [9, 2, 260, 0, 1, 6.8, 0, 0, 180, 6, 2, 25, 10])] },
      { season: 2024, leagues: [stats('laliga', 'Real Madrid', [10, 4, 380, 6, 0, 7.3, 0, 0, 190, 15, 9, 30, 13])] },
      { season: 2022, leagues: [stats('superlig', 'Fenerbahçe', [32, 14, 1530, 5, 6, 7.1, 3, 0, 640, 44, 16, 160, 70])] },
    ],
    career: [
      career(2026, 'Real Madrid', 'La Liga', 10, 2, 4),
      career(2025, 'Real Madrid', 'La Liga', 49, 6, 10),
      career(2024, 'Real Madrid', 'La Liga', 12, 6, 0),
      career(2023, 'Real Madrid', 'La Liga', 4, 0, 0),
      career(2022, 'Fenerbahçe', 'Trendyol Süper Lig', 39, 7, 6),
      career(2021, 'Fenerbahçe', 'Trendyol Süper Lig', 21, 3, 4),
      career(2020, 'Fenerbahçe', 'Trendyol Süper Lig', 1, 0, 0),
    ],
    transfers: [{ date: '2023-07-06', from: team('Fenerbahçe'), to: team('Real Madrid'), kind: 'fee', fee: '€ 20M' }],
    trophies: [
      { competition: 'UEFA Champions League', country: 'Avrupa', season: '2023/2024', place: 'winner' },
      { competition: 'La Liga', country: 'İspanya', season: '2023/2024', place: 'winner' },
      { competition: 'Türkiye Kupası', country: 'Türkiye', season: '2022/2023', place: 'winner' },
      { competition: 'Trendyol Süper Lig', country: 'Türkiye', season: '2021/2022', place: 'runnerup' },
    ],
  },
]

export const findMockPlayer = (id: string) => MOCK_PLAYERS.find((p) => p.profile.id === id) ?? null
