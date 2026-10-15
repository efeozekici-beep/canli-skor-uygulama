import type { NbaBoxScore, NbaPlayerLine, NbaPlayerProfile } from '../../types/basketball'
import { PROVIDERS } from '../../config/providers'
import { mockNbaGames, mockNbaPlayer, mockNbaPlayerStats } from '../../data/mockBasketball'
import { createCache, mockDelay, providerGet } from './common'

// API-NBA adaptörü: SADECE NBA maç detayı (box score, oyuncu istatistikleri, oyuncu profili).
// Maç listesi buradan gelmez (liste tek kaynaktan, API-Basketball'dan gelir; maçlar çift görünmez).

const config = PROVIDERS.apiNba
// Mock ve gerçek veri ayrı önbellekte: mock'tan gerçeğe geçince eski örnek veri görünmesin
const cached = createCache(config.useMock ? 'apiNba:mock' : 'apiNba')

// ---------- Ham API tipleri ----------
interface ApiNbaTeam {
  id: number
  name: string
  nickname: string
  code: string
  logo: string
}

export interface ApiNbaGame {
  id: number
  date: { start: string }
  status: { clock: string | null; halftime: boolean; short: number; long: string } // short: 1 başlamadı, 2 oynanıyor, 3 bitti
  periods: { current: number; total: number }
  teams: { visitors: ApiNbaTeam; home: ApiNbaTeam }
  scores: { visitors: { linescore: string[]; points: number | null }; home: { linescore: string[]; points: number | null } }
}

export interface ApiNbaPlayerStat {
  player: { id: number; firstname: string; lastname: string }
  team: ApiNbaTeam
  game: { id: number }
  points: number | null
  pos: string | null
  min: string | null
  fgm: number | null
  fga: number | null
  ftm: number | null
  fta: number | null
  tpm: number | null
  tpa: number | null
  totReb: number | null
  assists: number | null
  steals: number | null
  turnovers: number | null
  blocks: number | null
  plusMinus: string | null
}

export interface ApiNbaPlayer {
  id: number
  firstname: string
  lastname: string
  birth: { date: string | null; country: string | null }
  nba: { start: number | null }
  height: { meters: string | null }
  weight: { kilograms: string | null }
  college: string | null
  leagues: { standard?: { jersey: number | null; pos: string | null } }
}

// Eşleştirme için sadeleştirilmiş NBA maçı
export interface NbaGameRef {
  id: string
  start: string
  homeName: string
  homeNickname: string
  awayName: string
  awayNickname: string
  finished: boolean
}

// ---------- Dönüştürücüler (mapper) ----------
export const mapGameRef = (g: ApiNbaGame): NbaGameRef => ({
  id: String(g.id),
  start: g.date.start,
  homeName: g.teams.home.name,
  homeNickname: g.teams.home.nickname,
  awayName: g.teams.visitors.name,
  awayNickname: g.teams.visitors.nickname,
  finished: g.status.short === 3,
})

const n = (v: number | null) => v ?? 0

const toLine = (s: ApiNbaPlayerStat): NbaPlayerLine => ({
  playerId: String(s.player.id),
  name: `${s.player.firstname} ${s.player.lastname}`.trim(),
  position: s.pos,
  minutes: s.min,
  points: n(s.points),
  rebounds: n(s.totReb),
  assists: n(s.assists),
  steals: n(s.steals),
  blocks: n(s.blocks),
  turnovers: n(s.turnovers),
  fgm: n(s.fgm),
  fga: n(s.fga),
  tpm: n(s.tpm),
  tpa: n(s.tpa),
  ftm: n(s.ftm),
  fta: n(s.fta),
  plusMinus: s.plusMinus !== null ? Number.parseInt(s.plusMinus, 10) : null,
})

// Oyuncu satırlarını takıma göre ayırır. Hiç satır yoksa null (istatistik yok).
export function mapBoxScore(rows: ApiNbaPlayerStat[], game: NbaGameRef): NbaBoxScore | null {
  if (rows.length === 0) return null
  const forTeam = (nickname: string) => rows.filter((r) => r.team.nickname === nickname)
  const teamRef = (rowsForTeam: ApiNbaPlayerStat[], name: string) => ({
    id: rowsForTeam[0] ? `nba-${rowsForTeam[0].team.id}` : name,
    name,
    logo: rowsForTeam[0]?.team.logo || undefined,
  })
  const homeRows = forTeam(game.homeNickname)
  const awayRows = forTeam(game.awayNickname)
  // Sayıya göre sırala: en skorer üstte
  const sorted = (r: ApiNbaPlayerStat[]) => r.map(toLine).sort((a, b) => b.points - a.points)
  return {
    gameId: game.id,
    home: { team: teamRef(homeRows, game.homeName), players: sorted(homeRows) },
    away: { team: teamRef(awayRows, game.awayName), players: sorted(awayRows) },
    profiles: 'nba',
  }
}

const POSITIONS: Record<string, string> = { G: 'Guard', F: 'Forvet', C: 'Pivot', 'F-C': 'Forvet-Pivot', 'G-F': 'Guard-Forvet' }

export function mapPlayer(items: ApiNbaPlayer[]): NbaPlayerProfile | null {
  const p = items[0]
  if (!p) return null
  const pos = p.leagues.standard?.pos ?? null
  return {
    id: String(p.id),
    name: `${p.firstname} ${p.lastname}`.trim(),
    position: pos ? (POSITIONS[pos] ?? pos) : null,
    jersey: p.leagues.standard?.jersey ?? null,
    height: p.height.meters ? `${p.height.meters} m` : null,
    weight: p.weight.kilograms ? `${Math.round(Number(p.weight.kilograms))} kg` : null,
    birthDate: p.birth.date,
    country: p.birth.country,
    college: p.college,
    nbaStart: p.nba.start,
  }
}

// ---------- İstekler ----------

// Bir günün (UTC tarih: "2026-10-15") NBA maçları — sadece eşleştirme için
export function getGamesByDate(utcDate: string): Promise<NbaGameRef[]> {
  return cached(`games:${utcDate}`, config.ttl.games, async () => {
    const raw = config.useMock
      ? await mockDelay(mockNbaGames().filter((g) => g.date.start.slice(0, 10) === utcDate))
      : await providerGet<ApiNbaGame[]>(config.label, config.baseUrl, `/games?date=${utcDate}`)
    return raw.map(mapGameRef)
  })
}

// Box score: biten maç 7 gün, canlı maç 1 dakika saklanır
export function getBoxScore(game: NbaGameRef): Promise<NbaBoxScore | null> {
  const ttl = game.finished ? config.ttl.boxScoreFinished : config.ttl.boxScoreLive
  return cached(`box:${game.id}`, ttl, async () => {
    const raw = config.useMock
      ? await mockDelay(mockNbaPlayerStats(Number(game.id)))
      : await providerGet<ApiNbaPlayerStat[]>(config.label, config.baseUrl, `/players/statistics?game=${game.id}`)
    return mapBoxScore(raw, game)
  })
}

// Oyuncu profili: 7 gün
export function getPlayer(id: string): Promise<NbaPlayerProfile | null> {
  return cached(`player:${id}`, config.ttl.player, async () => {
    const raw = config.useMock
      ? await mockDelay(mockNbaPlayer(Number(id)))
      : await providerGet<ApiNbaPlayer[]>(config.label, config.baseUrl, `/players?id=${id}`)
    return mapPlayer(raw)
  })
}
