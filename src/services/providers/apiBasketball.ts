import type { Match, MatchStatus } from '../../types/match'
import type { BasketballStandings, NbaBoxScore, NbaPlayerLine, PeriodScore } from '../../types/basketball'
import type { StatItem } from '../../types/matchDetail'
import { PROVIDERS } from '../../config/providers'
import { mockBasketballGames, mockBasketballStandings } from '../../data/mockBasketball'
import { isSameDay } from '../../lib/date'
import { createCache, mockDelay, providerGet, ymd } from './common'

// API-Basketball adaptörü: basketbol sekmesindeki bütün ligler (NBA dahil), maç listesi, canlı skor, puan durumu.
// Bileşenler bu dosyayı bilmez; basketballService üzerinden kendi tiplerimizi (Match, BasketballStandings) alır.

const config = PROVIDERS.apiBasketball
// Mock ve gerçek veri ayrı önbellekte: mock'tan gerçeğe geçince eski örnek veri görünmesin
const cached = createCache(config.useMock ? 'apiBasketball:mock' : 'apiBasketball')

// ---------- Ham API tipleri (sadece kullandığımız alanlar) ----------
interface ApiScore {
  quarter_1: number | null
  quarter_2: number | null
  quarter_3: number | null
  quarter_4: number | null
  over_time: number | null
  total: number | null
}

export interface ApiBasketballGame {
  id: number
  date: string
  status: { long: string; short: string; timer: string | null }
  league: { id: number; name: string; type: string; season: string | number; logo: string }
  country: { name: string }
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } }
  scores: { home: ApiScore; away: ApiScore }
}

export interface ApiBasketballStanding {
  position: number
  stage: string
  group: { name: string }
  team: { id: number; name: string; logo: string }
  league: { id: number; season: string | number }
  games: { played: number; win: { total: number; percentage: string | null }; lose: { total: number; percentage: string | null } }
  points: { for: number; against: number }
  form: string | null
  description: string | null
}

// ---------- Dönüştürücüler (mapper) ----------
const LIVE = new Set(['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'BT', 'HT'])
const FINISHED = new Set(['FT', 'AOT', 'CANC', 'ABD', 'AWD'])
const FEATURED = ['12', '120'] // NBA, EuroLeague: listede üstte ve açık

const REGIONS: Record<string, string> = { USA: 'ABD', Europe: 'Avrupa', World: 'Dünya', Turkey: 'Türkiye', Spain: 'İspanya', Greece: 'Yunanistan' }

function toStatus(short: string): MatchStatus {
  if (LIVE.has(short)) return 'live'
  if (FINISHED.has(short)) return 'finished'
  return 'upcoming'
}

// Süre: API çeyreğin dakikasını düz sayı verir ("8" -> "8'"); "05:42" gibi saat biçimi gelirse aynen
export const formatTimer = (timer: string | null) => (!timer ? null : /^\d+$/.test(timer) ? `${timer}'` : timer)

// Futboldaki dakika yerine: "3. Çeyrek 8'", "Devre arası", "Uzatma 2'"
function statusLabel(short: string, timer: string | null): string | undefined {
  const formatted = formatTimer(timer)
  const clock = formatted ? ` ${formatted}` : ''
  const quarter = /^Q([1-4])$/.exec(short)
  if (quarter) return `${quarter[1]}. Çeyrek${clock}`
  const labels: Record<string, string> = { OT: `Uzatma${clock}`, BT: 'Çeyrek arası', HT: 'Devre arası', FT: 'MS', AOT: 'UZ', POST: 'ERT', CANC: 'İPT', ABD: 'YRD' }
  return labels[short]
}

function periodNumber(short: string) {
  const quarter = /^Q([1-4])$/.exec(short)
  if (quarter) return Number(quarter[1])
  return short === 'OT' ? 5 : null
}

export function mapGame(g: ApiBasketballGame): Match {
  const status = toStatus(g.status.short)
  const { home, away } = g.scores
  const periods: PeriodScore[] = [
    { label: '1Ç', home: home.quarter_1, away: away.quarter_1 },
    { label: '2Ç', home: home.quarter_2, away: away.quarter_2 },
    { label: '3Ç', home: home.quarter_3, away: away.quarter_3 },
    { label: '4Ç', home: home.quarter_4, away: away.quarter_4 },
  ]
  if (home.over_time !== null || away.over_time !== null) periods.push({ label: 'Uz', home: home.over_time, away: away.over_time })
  const season = String(g.league.season)

  return {
    // "bb-" öneki: futbol maçlarıyla id çakışmasın (favoriler ve maç sayfası için)
    id: `bb-${g.id}`,
    sport: 'basketball',
    leagueId: `bb-${g.league.id}`,
    leagueName: g.league.name,
    leagueLogo: g.league.logo || undefined,
    region: REGIONS[g.country.name] ?? g.country.name,
    featured: FEATURED.includes(String(g.league.id)),
    homeTeam: g.teams.home.name,
    awayTeam: g.teams.away.name,
    homeTeamId: `bb-${g.teams.home.id}`,
    awayTeamId: `bb-${g.teams.away.id}`,
    homeLogo: g.teams.home.logo || undefined,
    awayLogo: g.teams.away.logo || undefined,
    homeScore: status === 'upcoming' ? null : home.total,
    awayScore: status === 'upcoming' ? null : away.total,
    status,
    minute: null,
    statusLabel: statusLabel(g.status.short, g.status.timer),
    startTime: g.date,
    season: Number.parseInt(season, 10) || undefined,
    basketball: { periods, period: status === 'live' ? periodNumber(g.status.short) : null, clock: status === 'live' ? formatTimer(g.status.timer) : null, season },
  }
}

const GROUP_NAMES: Record<string, string> = { 'Eastern Conference': 'Doğu Konferansı', 'Western Conference': 'Batı Konferansı' }

export function mapStandings(groups: ApiBasketballStanding[][], leagueId: string, season: string): BasketballStandings | null {
  const filled = groups.filter((g) => g.length > 0)
  if (filled.length === 0) return null
  return {
    leagueId,
    season,
    groups: filled.map((rows) => ({
      name: GROUP_NAMES[rows[0].group.name] ?? rows[0].group.name,
      rows: rows.map((r) => ({
        rank: r.position,
        team: { id: `bb-${r.team.id}`, name: r.team.name, logo: r.team.logo || undefined },
        played: r.games.played,
        won: r.games.win.total,
        lost: r.games.lose.total,
        winPct: r.games.win.percentage !== null ? Number.parseFloat(r.games.win.percentage) : null,
        pointsFor: r.points.for,
        pointsAgainst: r.points.against,
        form: r.form,
        description: r.description,
      })),
    })),
  }
}

// ---------- Maç istatistikleri (/games/statistics/teams, /games/statistics/players) ----------
interface ApiShooting {
  total: number | null
  attempts: number | null
  percentage: number | null
}

export interface ApiTeamGameStats {
  team: { id: number }
  field_goals: ApiShooting
  threepoint_goals: ApiShooting
  freethrows_goals: ApiShooting
  rebounds: { total: number | null; offence: number | null; defense: number | null }
  assists: number | null
  steals: number | null
  blocks: number | null
  turnovers: number | null
  personal_fouls: number | null
}

export interface ApiPlayerGameStats {
  team: { id: number }
  player: { id: number; name: string }
  type: string // "starters" | "bench"
  minutes: string | null
  field_goals: ApiShooting
  threepoint_goals: ApiShooting
  freethrows_goals: ApiShooting
  rebounds: { total: number | null }
  assists: number | null
  points: number | null
}

// Takım istatistikleri -> futboldaki gibi iki taraflı çubuklar (StatItem). Değeri olmayan satır atlanır.
export function mapTeamStats(rows: ApiTeamGameStats[], match: Match): StatItem[] | null {
  const home = rows.find((r) => `bb-${r.team.id}` === match.homeTeamId)
  const away = rows.find((r) => `bb-${r.team.id}` === match.awayTeamId)
  if (!home || !away) return null
  const pct = (s: ApiShooting) => s.percentage ?? (s.total !== null && s.attempts ? Math.round((s.total / s.attempts) * 100) : null)
  const items: [string, string, number | null, number | null, '%'?][] = [
    ['fg', 'Saha içi isabet', pct(home.field_goals), pct(away.field_goals), '%'],
    ['tp', 'Üç sayı isabeti', pct(home.threepoint_goals), pct(away.threepoint_goals), '%'],
    ['ft', 'Serbest atış isabeti', pct(home.freethrows_goals), pct(away.freethrows_goals), '%'],
    ['reb', 'Ribaund', home.rebounds.total, away.rebounds.total],
    ['ast', 'Asist', home.assists, away.assists],
    ['stl', 'Top çalma', home.steals, away.steals],
    ['blk', 'Blok', home.blocks, away.blocks],
    ['tov', 'Top kaybı', home.turnovers, away.turnovers],
    ['pf', 'Faul', home.personal_fouls, away.personal_fouls],
  ]
  const result = items
    .filter(([, , h, a]) => h !== null && a !== null)
    .map(([key, label, h, a, unit]) => ({ key, label, home: h ?? 0, away: a ?? 0, unit }))
  return result.length > 0 ? result : null
}

// Oyuncu istatistikleri -> box score. Bu kaynak top çalma/blok/top kaybı/+-'yi vermez (null).
export function mapPlayerStats(rows: ApiPlayerGameStats[], match: Match, gameId: string): NbaBoxScore | null {
  const played = rows.filter((r) => r.minutes && r.minutes !== '0:00')
  if (played.length === 0) return null
  const line = (r: ApiPlayerGameStats): NbaPlayerLine => ({
    playerId: String(r.player.id),
    name: r.player.name,
    position: r.type === 'starters' ? 'İlk 5' : null,
    minutes: r.minutes,
    points: r.points ?? 0,
    rebounds: r.rebounds.total ?? 0,
    assists: r.assists ?? 0,
    steals: null,
    blocks: null,
    turnovers: null,
    fgm: r.field_goals.total ?? 0,
    fga: r.field_goals.attempts ?? 0,
    tpm: r.threepoint_goals.total ?? 0,
    tpa: r.threepoint_goals.attempts ?? 0,
    ftm: r.freethrows_goals.total ?? 0,
    fta: r.freethrows_goals.attempts ?? 0,
    plusMinus: null,
  })
  const team = (teamId: string | undefined, name: string, logo: string | undefined) => ({
    team: { id: teamId ?? name, name, logo },
    players: played
      .filter((r) => `bb-${r.team.id}` === teamId)
      .map(line)
      .sort((a, b) => b.points - a.points),
  })
  return {
    gameId,
    home: team(match.homeTeamId, match.homeTeam, match.homeLogo),
    away: team(match.awayTeamId, match.awayTeam, match.awayLogo),
    profiles: null,
  }
}

// ---------- İstekler ----------
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
const statsTtl = (match: Match) => (match.status === 'finished' ? config.ttl.gameStatsFinished : config.ttl.gameStatsLive)

// Takım istatistikleri (bütün ligler)
export function getTeamStats(match: Match): Promise<StatItem[] | null> {
  const gameId = rawId(match.id)
  return cached(`teamstats:${gameId}`, statsTtl(match), async () => {
    if (config.useMock) return mockDelay(null)
    const raw = await providerGet<ApiTeamGameStats[]>(config.label, config.baseUrl, `/games/statistics/teams?id=${gameId}`)
    return mapTeamStats(raw, match)
  })
}

// Oyuncu istatistikleri (NBA dışı liglerin box score'u)
export function getPlayerStats(match: Match): Promise<NbaBoxScore | null> {
  const gameId = rawId(match.id)
  return cached(`playerstats:${gameId}`, statsTtl(match), async () => {
    if (config.useMock) return mockDelay(null)
    const raw = await providerGet<ApiPlayerGameStats[]>(config.label, config.baseUrl, `/games/statistics/players?id=${gameId}`)
    return mapPlayerStats(raw, match, gameId)
  })
}
const rawId = (prefixed: string) => prefixed.replace(/^bb-/, '')

// Bir günün bütün basketbol maçları (tek istek). Bugün kısa, diğer günler uzun önbellek.
export function getGames(date: Date): Promise<Match[]> {
  const ttl = isSameDay(date, new Date()) ? config.ttl.gamesToday : config.ttl.gamesOtherDay
  return cached(`games:${ymd(date)}`, ttl, async () => {
    const raw = config.useMock
      ? await mockDelay(mockBasketballGames().filter((g) => isSameDay(new Date(g.date), date)))
      : await providerGet<ApiBasketballGame[]>(config.label, config.baseUrl, `/games?date=${ymd(date)}&timezone=${encodeURIComponent(timezone())}`)
    return raw.map(mapGame)
  })
}

// Lig puan durumu (leagueId: "bb-12", season: "2026-2027")
export function getStandings(leagueId: string, season: string): Promise<BasketballStandings | null> {
  return cached(`standings:${leagueId}:${season}`, config.ttl.standings, async () => {
    const raw = config.useMock
      ? await mockDelay(mockBasketballStandings(Number(rawId(leagueId)), season) ?? [])
      : await providerGet<ApiBasketballStanding[][]>(config.label, config.baseUrl, `/standings?league=${rawId(leagueId)}&season=${season}`)
    return mapStandings(raw, leagueId, season)
  })
}
