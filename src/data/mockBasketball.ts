import type { ApiBasketballGame, ApiBasketballStanding } from '../services/providers/apiBasketball'
import type { ApiNbaGame, ApiNbaPlayer, ApiNbaPlayerStat } from '../services/providers/apiNba'
import { addDays, startOfDay } from '../lib/date'

// Örnek basketbol verisi — bilerek API'lerin HAM cevap biçiminde yazıldı.
// Adaptörler bunu gerçek cevap gibi dönüştürücülerden (mapper) geçirir; böylece mock'la çalışırken
// dönüştürücüler de denenmiş olur. Gerçek API'ye geçince sadece veri kaynağı değişir.

// Bugüne göre tarih (yerel saat): at(0, '20:00')
function at(dayOffset: number, time: string) {
  const [h, m] = time.split(':').map(Number)
  const d = addDays(startOfDay(new Date()), dayOffset)
  d.setHours(h, m)
  return d.toISOString()
}

// ================= API-Basketball (tüm ligler) =================

const NBA = { id: 12, name: 'NBA', type: 'League', season: '2026-2027', logo: '' }
const EUROLEAGUE = { id: 120, name: 'EuroLeague', type: 'League', season: '2026-2027', logo: '' }
const team = (id: number, name: string) => ({ id, name, logo: '' })

// Çeyrek skorları: [ev Q1, dep Q1, ev Q2, dep Q2, ...], oynanmamış çeyrek null; uzatma ayrı
type Quarters = (number | null)[]

function game(
  id: number,
  league: typeof NBA,
  country: string,
  date: string,
  home: ReturnType<typeof team>,
  away: ReturnType<typeof team>,
  status: { short: string; long: string; timer: string | null },
  quarters: Quarters,
  overtime: [number, number] | null = null,
): ApiBasketballGame {
  const side = (offset: number) => {
    const q = [quarters[offset], quarters[offset + 2], quarters[offset + 4], quarters[offset + 6]].map((v) => v ?? null)
    const ot = overtime ? overtime[offset] : null
    const played = [...q, ot].filter((v): v is number => v !== null)
    return {
      quarter_1: q[0],
      quarter_2: q[1],
      quarter_3: q[2],
      quarter_4: q[3],
      over_time: ot,
      total: played.length > 0 ? played.reduce((a, b) => a + b, 0) : null,
    }
  }
  return { id, date, status, league, country: { name: country }, teams: { home, away }, scores: { home: side(0), away: side(1) } }
}

const FT = { short: 'FT', long: 'Game Finished', timer: null }
const AOT = { short: 'AOT', long: 'After Over Time', timer: null }
const NS = { short: 'NS', long: 'Not Started', timer: null }

// Takımlar
const LAKERS = team(145, 'Los Angeles Lakers')
const CELTICS = team(133, 'Boston Celtics')
const WARRIORS = team(141, 'Golden State Warriors')
const NUGGETS = team(139, 'Denver Nuggets')
const BUCKS = team(147, 'Milwaukee Bucks')
const KNICKS = team(151, 'New York Knicks')
const HEAT = team(146, 'Miami Heat')
const SIXERS = team(153, 'Philadelphia 76ers')
const MAVS = team(138, 'Dallas Mavericks')
const SUNS = team(155, 'Phoenix Suns')
const FENER = team(2101, 'Fenerbahçe Beko')
const REAL = team(2102, 'Real Madrid')
const EFES = team(2103, 'Anadolu Efes')
const OLYMPIACOS = team(2104, 'Olympiacos')
const PAO = team(2105, 'Panathinaikos')
const BARCA = team(2106, 'Barcelona')
const MONACO = team(2107, 'AS Monaco')
const PARTIZAN = team(2108, 'Partizan')
const MACCABI = team(2109, 'Maccabi Tel Aviv')
const ZALGIRIS = team(2110, 'Žalgiris')

export function mockBasketballGames(): ApiBasketballGame[] {
  return [
    // --- Dün ---
    game(9001, NBA, 'USA', at(-1, '03:00'), HEAT, SIXERS, FT, [27, 30, 25, 22, 31, 24, 26, 28]),
    game(9002, EUROLEAGUE, 'Europe', at(-1, '21:00'), MONACO, PARTIZAN, FT, [22, 18, 20, 19, 24, 21, 17, 20]),
    // --- Bugün ---
    game(9003, NBA, 'USA', at(0, '02:30'), BUCKS, KNICKS, FT, [29, 31, 27, 24, 30, 28, 32, 29]),
    game(9004, NBA, 'USA', at(0, '04:00'), WARRIORS, NUGGETS, AOT, [30, 28, 26, 29, 27, 30, 25, 21], [13, 11]),
    game(9005, NBA, 'USA', at(0, '20:00'), LAKERS, CELTICS, { short: 'Q3', long: 'Quarter 3', timer: '05:42' }, [28, 25, 30, 27, 18, 20, null, null]),
    game(9006, EUROLEAGUE, 'Europe', at(0, '19:00'), PAO, BARCA, FT, [21, 19, 18, 22, 23, 17, 20, 16]),
    game(9007, EUROLEAGUE, 'Europe', at(0, '20:30'), FENER, REAL, { short: 'Q2', long: 'Quarter 2', timer: '03:15' }, [24, 19, 12, 15, null, null, null, null]),
    game(9008, EUROLEAGUE, 'Europe', at(0, '21:45'), EFES, OLYMPIACOS, NS, []),
    // --- Yarın ---
    game(9009, NBA, 'USA', at(1, '03:30'), MAVS, SUNS, NS, []),
    game(9010, EUROLEAGUE, 'Europe', at(1, '20:45'), MACCABI, ZALGIRIS, NS, []),
  ]
}

// Puan durumu: NBA iki konferans (grup), EuroLeague tek tablo. [takım, O, G, M, atılan, yenilen]
type StandingRaw = [ReturnType<typeof team>, number, number, number, number, number]

function standings(league: typeof NBA, group: string, rows: StandingRaw[], description: (rank: number) => string | null): ApiBasketballStanding[] {
  return rows.map(([t, played, win, lose, pf, pa], i) => ({
    position: i + 1,
    stage: 'Regular Season',
    group: { name: group },
    team: t,
    league: { id: league.id, season: league.season },
    games: {
      played,
      win: { total: win, percentage: played ? (win / played).toFixed(3) : null },
      lose: { total: lose, percentage: played ? (lose / played).toFixed(3) : null },
    },
    points: { for: pf, against: pa },
    form: null,
    description: description(i + 1),
  }))
}

export function mockBasketballStandings(leagueId: number, season: string): ApiBasketballStanding[][] | null {
  if (leagueId === NBA.id && season === NBA.season) {
    const nbaZone = (rank: number) => (rank <= 6 ? 'Play-off' : rank <= 10 ? 'Play-in' : null)
    return [
      standings(NBA, 'Eastern Conference', [[CELTICS, 6, 5, 1, 702, 655], [KNICKS, 6, 4, 2, 690, 668], [BUCKS, 5, 3, 2, 580, 571], [HEAT, 6, 3, 3, 671, 673], [SIXERS, 6, 2, 4, 650, 680]], nbaZone),
      standings(NBA, 'Western Conference', [[NUGGETS, 6, 5, 1, 721, 670], [LAKERS, 6, 4, 2, 705, 690], [WARRIORS, 5, 3, 2, 590, 577], [MAVS, 6, 3, 3, 660, 661], [SUNS, 6, 1, 5, 640, 702]], nbaZone),
    ]
  }
  if (leagueId === EUROLEAGUE.id && season === EUROLEAGUE.season) {
    return [
      standings(EUROLEAGUE, 'EuroLeague', [[FENER, 4, 4, 0, 352, 301], [REAL, 4, 3, 1, 338, 320], [PAO, 4, 3, 1, 330, 318], [OLYMPIACOS, 4, 2, 2, 321, 317], [EFES, 4, 2, 2, 318, 322], [MONACO, 4, 2, 2, 325, 329], [BARCA, 4, 1, 3, 309, 330], [MACCABI, 4, 1, 3, 312, 335], [PARTIZAN, 4, 1, 3, 300, 326], [ZALGIRIS, 4, 1, 3, 298, 315]],
        (rank) => (rank <= 6 ? 'Play-off' : rank <= 10 ? 'Play-in' : null)),
    ]
  }
  return null
}

// ================= API-NBA (sadece NBA detayı) =================
// ID'ler API-Basketball'dakinden FARKLI: maçlar takım adı + tarihle eşleştirilir.

const nbaTeam = (id: number, name: string, nickname: string, code: string) => ({ id, name, nickname, code, logo: '' })
const N_LAKERS = nbaTeam(17, 'Los Angeles Lakers', 'Lakers', 'LAL')
const N_CELTICS = nbaTeam(2, 'Boston Celtics', 'Celtics', 'BOS')
const N_WARRIORS = nbaTeam(11, 'Golden State Warriors', 'Warriors', 'GSW')
const N_NUGGETS = nbaTeam(9, 'Denver Nuggets', 'Nuggets', 'DEN')
const N_HEAT = nbaTeam(20, 'Miami Heat', 'Heat', 'MIA')
const N_SIXERS = nbaTeam(27, 'Philadelphia 76ers', '76ers', 'PHI')

function nbaGame(id: number, start: string, home: typeof N_LAKERS, visitors: typeof N_LAKERS, short: number, homeLines: number[], awayLines: number[], clock: string | null = null): ApiNbaGame {
  const sum = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) : null)
  return {
    id,
    date: { start },
    status: { clock, halftime: false, short, long: short === 3 ? 'Finished' : short === 2 ? 'In Play' : 'Scheduled' },
    periods: { current: homeLines.length, total: 4 },
    teams: { visitors, home },
    scores: { visitors: { linescore: awayLines.map(String), points: sum(awayLines) }, home: { linescore: homeLines.map(String), points: sum(homeLines) } },
  }
}

// Bucks–Knicks (bugün 02:30) bilerek yok: "Detaylı istatistik bulunmuyor" durumunu göstermek için
export function mockNbaGames(): ApiNbaGame[] {
  return [
    nbaGame(15001, at(0, '20:00'), N_LAKERS, N_CELTICS, 2, [28, 30, 18], [25, 27, 20], '5:42'),
    nbaGame(15002, at(0, '04:00'), N_WARRIORS, N_NUGGETS, 3, [30, 26, 27, 25, 13], [28, 29, 30, 21, 11]),
    nbaGame(15003, at(-1, '03:00'), N_HEAT, N_SIXERS, 3, [27, 25, 31, 26], [30, 22, 24, 28]),
  ]
}

// Oyuncu satırı: [id, ad, soyad, mevki, dk, sayı, rib, ast, top çalma, blok, top kaybı, isabetli, deneme, 3 isabetli, 3 deneme, serbest isabetli, serbest deneme, +/-]
type Line = [number, string, string, string, string, number, number, number, number, number, number, number, number, number, number, number, number, number]

function lines(gameId: number, t: typeof N_LAKERS, rows: Line[]): ApiNbaPlayerStat[] {
  return rows.map(([id, firstname, lastname, pos, min, points, totReb, assists, steals, blocks, turnovers, fgm, fga, tpm, tpa, ftm, fta, pm]) => ({
    player: { id, firstname, lastname },
    team: t,
    game: { id: gameId },
    points, pos, min, fgm, fga, ftm, fta, tpm, tpa, totReb, assists, steals, turnovers, blocks,
    plusMinus: pm > 0 ? `+${pm}` : String(pm),
  }))
}

// Heat–76ers (15003) için oyuncu istatistiği yok: maç eşleşir ama box score boş gelir
const PLAYER_STATS: Record<number, ApiNbaPlayerStat[]> = {
  15001: [
    ...lines(15001, N_LAKERS, [
      [265, 'LeBron', 'James', 'F', '26:10', 19, 7, 6, 1, 1, 2, 7, 14, 2, 5, 3, 4, 6],
      [963, 'Luka', 'Dončić', 'G', '27:40', 24, 6, 8, 2, 0, 3, 8, 17, 3, 8, 5, 6, 4],
      [2563, 'Austin', 'Reaves', 'G', '24:05', 12, 3, 4, 1, 0, 1, 4, 9, 2, 5, 2, 2, 3],
      [2584, 'Rui', 'Hachimura', 'F', '22:30', 9, 4, 1, 0, 0, 0, 4, 7, 1, 3, 0, 0, 1],
      [2650, 'Jaxson', 'Hayes', 'C', '15:20', 6, 5, 0, 0, 2, 1, 3, 4, 0, 0, 0, 0, -2],
      [2833, 'Dalton', 'Knecht', 'G', '11:00', 6, 1, 1, 0, 0, 0, 2, 5, 2, 4, 0, 0, 2],
    ]),
    ...lines(15001, N_CELTICS, [
      [882, 'Jayson', 'Tatum', 'F', '27:15', 22, 8, 4, 1, 1, 2, 8, 18, 3, 8, 3, 3, -3],
      [883, 'Jaylen', 'Brown', 'G', '26:30', 18, 5, 3, 2, 0, 3, 7, 15, 1, 4, 3, 4, -5],
      [1046, 'Derrick', 'White', 'G', '25:40', 13, 3, 5, 1, 1, 1, 5, 10, 3, 6, 0, 0, -2],
      [2600, 'Payton', 'Pritchard', 'G', '19:10', 10, 2, 3, 0, 0, 0, 4, 8, 2, 5, 0, 0, 1],
      [2604, 'Sam', 'Hauser', 'F', '16:20', 6, 3, 1, 0, 0, 0, 2, 5, 2, 5, 0, 0, -1],
      [2700, 'Neemias', 'Queta', 'C', '14:05', 3, 6, 0, 0, 1, 1, 1, 3, 0, 0, 1, 2, -4],
    ]),
  ],
  15002: [
    ...lines(15002, N_WARRIORS, [
      [124, 'Stephen', 'Curry', 'G', '40:12', 38, 5, 7, 2, 0, 3, 13, 25, 7, 14, 5, 5, 6],
      [415, 'Jimmy', 'Butler', 'F', '37:30', 24, 7, 5, 2, 1, 2, 8, 15, 1, 3, 7, 8, 4],
      [196, 'Draymond', 'Green', 'F', '34:20', 9, 10, 9, 1, 2, 4, 4, 8, 1, 3, 0, 0, 3],
      [2610, 'Brandin', 'Podziemski', 'G', '30:05', 14, 6, 3, 1, 0, 1, 5, 11, 3, 6, 1, 1, 2],
      [2550, 'Moses', 'Moody', 'G', '24:40', 11, 3, 1, 0, 0, 0, 4, 8, 3, 6, 0, 0, -1],
      [2820, 'Quinten', 'Post', 'C', '18:10', 8, 6, 1, 0, 1, 1, 3, 6, 2, 3, 0, 0, -4],
    ]),
    ...lines(15002, N_NUGGETS, [
      [279, 'Nikola', 'Jokić', 'C', '42:00', 34, 15, 12, 2, 1, 4, 13, 22, 2, 5, 6, 7, -1],
      [1012, 'Jamal', 'Murray', 'G', '39:40', 27, 4, 6, 1, 0, 2, 10, 21, 4, 9, 3, 3, -3],
      [948, 'Aaron', 'Gordon', 'F', '35:10', 15, 7, 3, 1, 1, 1, 6, 10, 1, 2, 2, 2, -2],
      [2570, 'Christian', 'Braun', 'G', '33:30', 12, 5, 2, 2, 0, 1, 5, 9, 1, 3, 1, 2, 1],
      [1100, 'Cameron', 'Johnson', 'F', '31:20', 14, 4, 1, 0, 0, 1, 5, 11, 4, 8, 0, 0, -4],
      [2622, 'Peyton', 'Watson', 'F', '17:00', 5, 3, 1, 0, 2, 0, 2, 4, 1, 2, 0, 0, 0],
    ]),
  ],
}

export const mockNbaPlayerStats = (gameId: number): ApiNbaPlayerStat[] => PLAYER_STATS[gameId] ?? []

// Birkaç oyuncunun profili (diğerlerinde "profil bilgisi yok" görünür)
const PROFILES: ApiNbaPlayer[] = [
  { id: 265, firstname: 'LeBron', lastname: 'James', birth: { date: '1984-12-30', country: 'USA' }, nba: { start: 2003 }, height: { meters: '2.06' }, weight: { kilograms: '113.4' }, college: null, leagues: { standard: { jersey: 23, pos: 'F' } } },
  { id: 963, firstname: 'Luka', lastname: 'Dončić', birth: { date: '1999-02-28', country: 'Slovenia' }, nba: { start: 2018 }, height: { meters: '2.01' }, weight: { kilograms: '104.3' }, college: null, leagues: { standard: { jersey: 77, pos: 'G' } } },
  { id: 882, firstname: 'Jayson', lastname: 'Tatum', birth: { date: '1998-03-03', country: 'USA' }, nba: { start: 2017 }, height: { meters: '2.03' }, weight: { kilograms: '95.3' }, college: 'Duke', leagues: { standard: { jersey: 0, pos: 'F' } } },
  { id: 124, firstname: 'Stephen', lastname: 'Curry', birth: { date: '1988-03-14', country: 'USA' }, nba: { start: 2009 }, height: { meters: '1.88' }, weight: { kilograms: '83.9' }, college: 'Davidson', leagues: { standard: { jersey: 30, pos: 'G' } } },
  { id: 279, firstname: 'Nikola', lastname: 'Jokić', birth: { date: '1995-02-19', country: 'Serbia' }, nba: { start: 2015 }, height: { meters: '2.11' }, weight: { kilograms: '129.3' }, college: null, leagues: { standard: { jersey: 15, pos: 'C' } } },
]

export const mockNbaPlayer = (id: number): ApiNbaPlayer[] => PROFILES.filter((p) => p.id === id)
