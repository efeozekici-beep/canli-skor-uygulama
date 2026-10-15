import type { Match } from '../types/match'
import type { LeagueInfo, LeagueStandingRow, LeagueStandings, PlayerStatEntry, PlayerStatKind, StandingSplit } from '../types/league'
import { teamIdOf } from '../lib/team'
import { addDays, startOfDay } from '../lib/date'

// ---------- Örnek lig tanımları ----------
// Her lig için takımlar, bölgeler ve oyuncu havuzu. Puan durumu ve fikstür bu tanımdan
// "tohumlu" (her seferinde aynı sonucu veren) bir sezon simülasyonuyla üretilir.

interface MockLeagueConfig {
  id: string
  /** API-Football'daki gerçek lig id'leri: gerçek listeden gelince de bu örnek veri gösterilir */
  aliases: string[]
  name: string
  region: string
  season: number
  /** Güçlüden zayıfa sıralı takımlar (simülasyonda güç bu sıraya göre) */
  teams: string[]
  playedRounds: number
  zones: { from: number; to: number; description: string }[]
  players: [name: string, team: string][]
}

const CONFIGS: MockLeagueConfig[] = [
  {
    id: 'ucl',
    aliases: ['2'],
    name: 'UEFA Champions League',
    region: 'Avrupa',
    season: 2026,
    teams: ['Liverpool', 'Real Madrid', 'Man City', 'PSG', 'Dortmund', 'Feyenoord', 'Aston Villa', 'Fenerbahçe', 'Roma', 'Porto',
      'Como', 'Real Betis', 'Club Brugge', 'Shakhtar', 'AEK', 'Bodø/Glimt', 'LASK', 'Slovan Bratislava'],
    playedRounds: 2,
    zones: [
      { from: 1, to: 8, description: 'Son 16 (doğrudan)' },
      { from: 9, to: 16, description: 'Eleme play-off’ları' },
      { from: 17, to: 18, description: 'Elendi' },
    ],
    players: [['Mohamed Salah', 'Liverpool'], ['Cody Gakpo', 'Liverpool'], ['Kylian Mbappé', 'Real Madrid'], ['Vinícius Júnior', 'Real Madrid'],
      ['Jude Bellingham', 'Real Madrid'], ['Erling Haaland', 'Man City'], ['Phil Foden', 'Man City'], ['Ousmane Dembélé', 'PSG'],
      ['Bradley Barcola', 'PSG'], ['Serhou Guirassy', 'Dortmund'], ['Santiago Giménez', 'Feyenoord'], ['Anis Hadj Moussa', 'Feyenoord'],
      ['Nico Paz', 'Como'], ['Ollie Watkins', 'Aston Villa'], ['Edin Džeko', 'Fenerbahçe'], ['Youssef En-Nesyri', 'Fenerbahçe'],
      ['Paulo Dybala', 'Roma'], ['Samu Aghehowa', 'Porto'], ['Kasper Høgh', 'Bodø/Glimt'], ['Hans Vanaken', 'Club Brugge']],
  },
  {
    id: 'tsl',
    aliases: ['203'],
    name: 'Trendyol Süper Lig',
    region: 'Türkiye',
    season: 2026,
    teams: ['Galatasaray', 'Fenerbahçe', 'Beşiktaş', 'Samsunspor', 'Trabzonspor', 'Göztepe', 'Başakşehir', 'Eyüpspor', 'Kasımpaşa',
      'Konyaspor', 'Alanyaspor', 'Kayserispor', 'Rizespor', 'Gaziantep FK', 'Antalyaspor', 'Kocaelispor', 'Gençlerbirliği', 'Karagümrük'],
    playedRounds: 8,
    zones: [
      { from: 1, to: 2, description: 'Şampiyonlar Ligi (ön eleme)' },
      { from: 3, to: 3, description: 'Avrupa Ligi (ön eleme)' },
      { from: 4, to: 4, description: 'Konferans Ligi (ön eleme)' },
      { from: 16, to: 18, description: 'Düşme (1. Lig)' },
    ],
    players: [['Victor Osimhen', 'Galatasaray'], ['Mauro Icardi', 'Galatasaray'], ['Barış Alper Yılmaz', 'Galatasaray'], ['Youssef En-Nesyri', 'Fenerbahçe'],
      ['Dušan Tadić', 'Fenerbahçe'], ['Ciro Immobile', 'Beşiktaş'], ['Rafa Silva', 'Beşiktaş'], ['Marius Mouandilmadji', 'Samsunspor'],
      ['Anthony Musaba', 'Samsunspor'], ['Paul Onuachu', 'Trabzonspor'], ['Edin Višća', 'Trabzonspor'], ['Romulo', 'Göztepe'],
      ['Krzysztof Piątek', 'Başakşehir'], ['Mame Thiam', 'Eyüpspor'], ['Mamadou Fall', 'Kasımpaşa'], ['Umut Nayir', 'Konyaspor'],
      ['Efecan Karaca', 'Alanyaspor'], ['Carlos Mané', 'Kayserispor'], ['Ali Sowe', 'Rizespor'], ['Mohamed Bayo', 'Gaziantep FK']],
  },
  {
    id: 'pl',
    aliases: ['39'],
    name: 'Premier League',
    region: 'İngiltere',
    season: 2026,
    teams: ['Liverpool', 'Arsenal', 'Manchester City', 'Chelsea', 'Newcastle', 'Aston Villa', 'Tottenham', 'Manchester United', 'Brighton',
      'Bournemouth', 'Nottingham Forest', 'Fulham', 'Brentford', 'Crystal Palace', 'Everton', 'West Ham', 'Wolves', 'Leeds', 'Burnley', 'Sunderland'],
    playedRounds: 8,
    zones: [
      { from: 1, to: 4, description: 'Şampiyonlar Ligi' },
      { from: 5, to: 5, description: 'Avrupa Ligi' },
      { from: 6, to: 6, description: 'Konferans Ligi (ön eleme)' },
      { from: 18, to: 20, description: 'Düşme (Championship)' },
    ],
    players: [['Mohamed Salah', 'Liverpool'], ['Hugo Ekitiké', 'Liverpool'], ['Viktor Gyökeres', 'Arsenal'], ['Bukayo Saka', 'Arsenal'],
      ['Erling Haaland', 'Manchester City'], ['Cole Palmer', 'Chelsea'], ['Alexander Isak', 'Newcastle'], ['Ollie Watkins', 'Aston Villa'],
      ['Dominic Solanke', 'Tottenham'], ['Bryan Mbeumo', 'Manchester United'], ['Matheus Cunha', 'Manchester United'], ['Danny Welbeck', 'Brighton'],
      ['Antoine Semenyo', 'Bournemouth'], ['Chris Wood', 'Nottingham Forest'], ['Raúl Jiménez', 'Fulham'], ['Igor Thiago', 'Brentford'],
      ['Jean-Philippe Mateta', 'Crystal Palace'], ['Iliman Ndiaye', 'Everton'], ['Jarrod Bowen', 'West Ham'], ['Jørgen Strand Larsen', 'Wolves']],
  },
]

const findConfig = (leagueId: string) => CONFIGS.find((c) => c.id === leagueId || c.aliases.includes(leagueId)) ?? null

// ---------- Tohumlu rastgele sayı ve simülasyon yardımcıları ----------

// Aynı tohumla her seferinde aynı sayı dizisini üretir (mulberry32)
function random(seedText: string) {
  let a = 0
  for (const ch of seedText) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Ortalama "lambda" gole göre rastgele gol sayısı (Poisson dağılımı)
function goals(lambda: number, rnd: () => number) {
  const limit = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rnd()
  } while (p > limit)
  return k - 1
}

// Herkesin herkesle oynadığı fikstür (daire yöntemi): her tur için [ev, deplasman] indeksleri
function roundRobin(teamCount: number): [number, number][][] {
  const order = Array.from({ length: teamCount }, (_, i) => i)
  const rounds: [number, number][][] = []
  for (let r = 0; r < teamCount - 1; r++) {
    const pairs: [number, number][] = []
    for (let i = 0; i < teamCount / 2; i++) {
      const a = order[i]
      const b = order[teamCount - 1 - i]
      pairs.push(r % 2 === 0 ? [a, b] : [b, a])
    }
    rounds.push(pairs)
    order.splice(1, 0, order.pop() as number)
  }
  return rounds
}

const KICKOFFS = ['17:00', '19:00', '20:00', '21:45']

// Bir ligin bütün maçlarını üretir: oynanan turlar biten, sonraki 2 tur oynanacak
function simulate(config: MockLeagueConfig): Match[] {
  const rnd = random(`${config.id}-${config.season}`)
  const n = config.teams.length
  const strength = (i: number) => 1 - i / (n - 1) // listede üstteki takım daha güçlü
  const rounds = roundRobin(n).slice(0, config.playedRounds + 2)
  const today = startOfDay(new Date())

  return rounds.flatMap((pairs, r) => {
    const played = r < config.playedRounds
    // Biten turlar haftada bir geriye, oynanacaklar 3 gün sonradan itibaren ileriye
    const day = played ? addDays(today, -7 * (config.playedRounds - r) + 2) : addDays(today, 3 + 7 * (r - config.playedRounds))
    return pairs.map(([h, a], i): Match => {
      const [hh, mm] = KICKOFFS[i % KICKOFFS.length].split(':').map(Number)
      const start = new Date(day)
      start.setHours(hh, mm)
      const homeGoals = goals(Math.max(0.2, 1.35 + 0.9 * (strength(h) - strength(a))), rnd)
      const awayGoals = goals(Math.max(0.2, 1.05 + 0.9 * (strength(a) - strength(h))), rnd)
      return {
        id: `${config.id}-r${r + 1}-${i + 1}`,
        sport: 'football',
        leagueId: config.id,
        leagueName: config.name,
        region: config.region,
        featured: true,
        homeTeam: config.teams[h],
        awayTeam: config.teams[a],
        homeScore: played ? homeGoals : null,
        awayScore: played ? awayGoals : null,
        status: played ? 'finished' : 'upcoming',
        minute: null,
        startTime: start.toISOString(),
        season: config.season,
      }
    })
  })
}

// Biten maçlardan puan durumunu hesaplar (genel + iç saha + deplasman + son 5 maç)
function buildStandings(config: MockLeagueConfig, matches: Match[]): LeagueStandingRow[] {
  const empty = (): StandingSplit => ({ played: 0, win: 0, draw: 0, lose: 0, goalsFor: 0, goalsAgainst: 0 })
  const table = new Map(config.teams.map((t) => [t, { all: empty(), home: empty(), away: empty(), form: '' }]))

  const record = (team: string, side: 'home' | 'away', scored: number, conceded: number) => {
    const entry = table.get(team)
    if (!entry) return
    const result = scored > conceded ? 'W' : scored === conceded ? 'D' : 'L'
    for (const split of [entry.all, entry[side]]) {
      split.played++
      split.goalsFor += scored
      split.goalsAgainst += conceded
      if (result === 'W') split.win++
      else if (result === 'D') split.draw++
      else split.lose++
    }
    entry.form += result
  }

  const finished = matches.filter((m) => m.status === 'finished').sort((a, b) => a.startTime.localeCompare(b.startTime))
  for (const m of finished) {
    record(m.homeTeam, 'home', m.homeScore ?? 0, m.awayScore ?? 0)
    record(m.awayTeam, 'away', m.awayScore ?? 0, m.homeScore ?? 0)
  }

  const rows = config.teams.map((name) => {
    const entry = table.get(name)!
    return {
      rank: 0,
      team: { id: teamIdOf(name), name },
      points: entry.all.win * 3 + entry.all.draw,
      goalsDiff: entry.all.goalsFor - entry.all.goalsAgainst,
      form: entry.form.slice(-5) || null,
      description: null as string | null,
      all: entry.all,
      home: entry.home,
      away: entry.away,
    }
  })
  rows.sort((a, b) => b.points - a.points || b.goalsDiff - a.goalsDiff || b.all.goalsFor - a.all.goalsFor || a.team.name.localeCompare(b.team.name, 'tr'))
  rows.forEach((row, i) => {
    row.rank = i + 1
    row.description = config.zones.find((z) => row.rank >= z.from && row.rank <= z.to)?.description ?? null
  })
  return rows
}

// ---------- Dışa açılanlar (leagueService kullanır) ----------

// Simülasyon her lig için bir kez yapılır, sonra hafızada tutulur
const simulated = new Map<string, Match[]>()
function matchesFor(config: MockLeagueConfig) {
  if (!simulated.has(config.id)) simulated.set(config.id, simulate(config))
  return simulated.get(config.id)!
}

// Arama için: örnek ligler ve takımları (takımın ülkesi olarak ligin bölgesi)
export function mockLeagueList(): LeagueInfo[] {
  return CONFIGS.map((c) => ({ id: c.id, name: c.name, region: c.region, currentSeason: c.season, isMock: true }))
}

export function mockTeamList(): { name: string; country: string }[] {
  return CONFIGS.flatMap((c) => c.teams.map((name) => ({ name, country: c.region })))
}

export function mockLeagueInfo(leagueId: string): LeagueInfo | null {
  const config = findConfig(leagueId)
  return config ? { id: leagueId, name: config.name, region: config.region, currentSeason: config.season, isMock: true } : null
}

export function mockStandings(leagueId: string, season: number): LeagueStandings | null {
  const config = findConfig(leagueId)
  if (!config || season !== config.season) return null
  return { leagueId, season, groups: [{ name: config.name, rows: buildStandings(config, matchesFor(config)) }] }
}

export function mockFixtures(leagueId: string, season: number): Match[] | null {
  const config = findConfig(leagueId)
  if (!config || season !== config.season) return null
  return matchesFor(config)
}

// Oyuncu listeleri: her istatistik için havuzdan tohumlu değerler, büyükten küçüğe
export function mockPlayerStats(leagueId: string, season: number, kind: PlayerStatKind): PlayerStatEntry[] | null {
  const config = findConfig(leagueId)
  if (!config || season !== config.season) return null
  const rnd = random(`${config.id}-${kind}`)
  const max = { goals: config.playedRounds * 0.9 + 1, assists: config.playedRounds * 0.6 + 1, yellow: config.playedRounds * 0.45 + 1, red: 1.6 }[kind]
  return config.players
    .map(([name, team], i) => ({
      playerId: `${config.id}-p${i}`,
      name,
      team: { id: teamIdOf(team), name: team },
      value: Math.floor(rnd() * max) + (kind === 'red' ? 0 : 1),
    }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'tr'))
    .slice(0, 20)
}
