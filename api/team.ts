// Basketbol takım sayfası verisi (Vercel fonksiyonu):
//   GET /api/team?league=nba|E|U&part=teams                 -> ligdeki takımlar (adından takımı bulmak için)
//   GET /api/team?league=nba|E|U&team=<id>&part=squad       -> kadro + oyuncuların sezon ortalamaları (10 dk saklanır)
//   GET /api/team?league=nba|E|U&team=<id>&part=fixtures    -> son 10 maç + yaklaşan 10 maç (15 dk saklanır)
//   GET /api/team?league=nba|E|U&player=<id>&part=player    -> oyuncu profili + sezon sezon kariyer (1 gün saklanır)
//   GET /api/team?league=E|U&part=people                     -> aramada kullanılan oyuncu listesi (ad, takım, fotoğraf; 1 gün)
// team: NBA'de ESPN takım id'si ("2"), EuroLeague / EuroCup'ta kulüp kodu ("PAN").
// Kaynaklar (ESPN, EuroLeague resmi API) anahtar / kota istemiyor ama cevapları büyük (NBA takvimi ~900 KB):
// burada sadeleştirilip Redis'te saklanır, tarayıcıya birkaç KB gider.
// Not: API-Basketball'un /players ve /games?team uç noktaları ücretsiz planda bu sezon için kapalı.

import { cacheGet, cacheSet, type Env } from './_lib/cache.js'
import { getJson } from './_lib/http.js'

type League = 'nba' | 'E' | 'U'
type Part = 'teams' | 'squad' | 'fixtures' | 'player' | 'people'

const TTL: Record<Part, number> = { teams: 24 * 60 * 60, squad: 10 * 60, fixtures: 15 * 60, player: 24 * 60 * 60, people: 24 * 60 * 60 }

// ---------- Oyuncu kariyeri ----------
export interface PlayerProfile {
  name: string
  photo: string | null
  position: string | null
  number: string | null
  age: number | null
  height: string | null
  weight: string | null
  nationality: string | null
  team: string | null
  teamLogo: string | null
}

// Bir sezon + bir takım + bir turnuva; hepsi maç başı ortalama (yüzdeler 0-100)
export interface CareerSeason {
  season: string
  competition: string
  team: string | null
  teamLogo: string | null
  games: number
  starts: number | null
  minutes: number
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  fgPct: number | null
  threePct: number | null
  ftPct: number | null
  /** EuroLeague verimlilik puanı (NBA'de yok) */
  pir: number | null
}

const POSITION_TR: Record<string, string> = { Guard: 'Guard', Forward: 'Forward', Center: 'Pivot', 'Point Guard': 'Oyun kurucu', 'Shooting Guard': 'Şutör guard', 'Small Forward': 'Kısa forvet', 'Power Forward': 'Uzun forvet' }

export interface PlayerSeasonAverages {
  games: number
  minutes: number
  points: number
  rebounds: number
  assists: number
}

export interface SquadPlayer {
  id: string
  name: string
  number: string | null
  /** G (guard), F (forward), C (center) */
  position: 'G' | 'F' | 'C'
  age: number | null
  photo: string | null
  /** Bu sezon maç başı ortalamalar; hiç oynamadıysa null */
  stats: PlayerSeasonAverages | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

// Ligin bütün oyuncularının sezon ortalamaları (tek istek, büyük): oyuncu id'si -> ortalamalar. 1 saat saklanır.
async function statsMap(env: Env, key: string, load: () => Promise<Record<string, PlayerSeasonAverages>>) {
  const cacheKey = `canliskor:team:v1:statsmap:${key}`
  const hit = await cacheGet(env, cacheKey)
  if (hit) return JSON.parse(hit.body) as Record<string, PlayerSeasonAverages>
  const map = await load().catch((err: unknown): Record<string, PlayerSeasonAverages> => {
    console.error('Oyuncu istatistikleri alınamadı:', err)
    return {} // kadro istatistiksiz de gösterilir
  })
  if (Object.keys(map).length > 0) await cacheSet(env, cacheKey, JSON.stringify(map), 60 * 60)
  return map
}

export interface TeamGame {
  id: string
  date: string
  status: 'finished' | 'live' | 'upcoming'
  home: { name: string; logo: string | null; score: number | null }
  away: { name: string; logo: string | null; score: number | null }
}

// Pozisyon: ESPN "G", "PG", "SG", "G-F" -> G; "C" -> C; "F", "SF", "PF", "F-C" -> F. EuroLeague "Guard" / "Forward" / "Center".
const position = (raw?: string | null): 'G' | 'F' | 'C' => {
  const p = (raw ?? '').toUpperCase()
  if (p.startsWith('C')) return 'C'
  if (p.startsWith('G') || p === 'PG' || p === 'SG') return 'G'
  return 'F'
}

// Son 10 bitmiş maç (yeniden eskiye) + yaklaşan 10 maç (yakından uzağa); canlı maç yaklaşanların başında
function split(games: TeamGame[]) {
  const past = games.filter((g) => g.status === 'finished').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
  const upcoming = games.filter((g) => g.status !== 'finished').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10)
  return { past, upcoming }
}

// ---------- NBA (ESPN) ----------
const NBA = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'

interface EspnTeam {
  id: string
  displayName: string
  logo?: string
  logos?: { href: string }[]
}

// NBA: ESPN'in bütün oyuncu istatistikleri (~4 MB, tek sayfa)
interface EspnByAthlete {
  categories?: { name: string; names: string[] }[]
  athletes?: { athlete: { id: string }; categories: { name: string; values: number[] }[] }[]
}

async function nbaStats(): Promise<Record<string, PlayerSeasonAverages>> {
  const raw = await getJson<EspnByAthlete>('https://site.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?limit=500')
  const names = new Map((raw.categories ?? []).map((c) => [c.name, c.names]))
  const value = (a: NonNullable<EspnByAthlete['athletes']>[number], category: string, stat: string) => {
    const i = names.get(category)?.indexOf(stat) ?? -1
    return i === -1 ? 0 : (a.categories.find((c) => c.name === category)?.values[i] ?? 0)
  }
  return Object.fromEntries(
    (raw.athletes ?? []).map((a) => [
      a.athlete.id,
      {
        games: value(a, 'general', 'gamesPlayed'),
        minutes: round1(value(a, 'general', 'avgMinutes')),
        points: round1(value(a, 'offensive', 'avgPoints')),
        rebounds: round1(value(a, 'general', 'avgRebounds')),
        assists: round1(value(a, 'offensive', 'avgAssists')),
      },
    ]),
  )
}

// ESPN'in toplu listesi sadece "düzenli" oynayanları içeriyor (~320 oyuncu): az süre alanlar yok.
// Onların bu sezonki ortalaması oyuncunun kendi istatistik sayfasından alınır (takım başına birkaç istek).
async function nbaPlayerSeason(athleteId: string): Promise<PlayerSeasonAverages | null> {
  const raw = await getJson<{ categories?: { name: string; labels: string[]; statistics: { season: { displayName: string }; stats: string[] }[] }[] }>(
    `https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${athleteId}/stats`,
  ).catch(() => null)
  const averages = raw?.categories?.find((c) => c.name === 'averages')
  // Bu sezon: "2026-27"
  const now = new Date()
  const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const label = `${year}-${String(year + 1).slice(2)}`
  const row = averages?.statistics.find((r) => r.season.displayName.startsWith(label))
  if (!averages || !row) return null
  const at = (name: string) => Number(row.stats[averages.labels.indexOf(name)]) || 0
  return { games: at('GP'), minutes: round1(at('MIN')), points: round1(at('PTS')), rebounds: round1(at('REB')), assists: round1(at('AST')) }
}

// NBA oyuncusu: profil (ESPN athlete) + normal sezon ortalamaları (ESPN stats)
async function nbaPlayer(id: string): Promise<{ profile: PlayerProfile; seasons: CareerSeason[] }> {
  const [athlete, stats] = await Promise.all([
    getJson<{
      athlete: {
        displayName: string
        age?: number
        displayHeight?: string
        displayWeight?: string
        citizenship?: string
        jersey?: string
        position?: { displayName?: string }
        headshot?: { href: string }
        team?: { displayName: string; logos?: { href: string }[] }
      }
    }>(`https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}`),
    getJson<{
      teams?: Record<string, { displayName: string; abbreviation?: string }>
      categories?: { name: string; labels: string[]; statistics: { season: { displayName: string }; teamSlug?: string; stats: string[] }[] }[]
    }>(`https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/stats`),
  ])
  const a = athlete.athlete
  const ft = a.displayHeight?.match(/(\d+)'\s*(\d+)/)
  const lbs = a.displayWeight?.match(/(\d+)/)
  const profile: PlayerProfile = {
    name: a.displayName,
    photo: a.headshot?.href ?? null,
    position: a.position?.displayName ? (POSITION_TR[a.position.displayName] ?? a.position.displayName) : null,
    number: a.jersey ?? null,
    age: a.age ?? null,
    height: ft ? `${Math.round((Number(ft[1]) * 12 + Number(ft[2])) * 2.54)} cm` : null,
    weight: lbs ? `${Math.round(Number(lbs[1]) * 0.4536)} kg` : null,
    nationality: a.citizenship ?? null,
    team: a.team?.displayName ?? null,
    teamLogo: a.team?.logos?.[0]?.href ?? null,
  }
  const averages = stats.categories?.find((c) => c.name === 'averages')
  const seasons = (averages?.statistics ?? [])
    .map((row): CareerSeason => {
      const at = (label: string) => Number(row.stats[averages!.labels.indexOf(label)]) || 0
      const team = row.teamSlug ? stats.teams?.[row.teamSlug] : undefined
      return {
        season: row.season.displayName.replace(/^(\d{4})-(\d{2}).*$/, '$1-$2'),
        competition: 'NBA',
        team: team?.displayName ?? null,
        teamLogo: team?.abbreviation ? `https://a.espncdn.com/i/teamlogos/nba/500/${team.abbreviation.toLowerCase()}.png` : null,
        games: at('GP'),
        starts: at('GS'),
        minutes: round1(at('MIN')),
        points: round1(at('PTS')),
        rebounds: round1(at('REB')),
        assists: round1(at('AST')),
        steals: round1(at('STL')),
        blocks: round1(at('BLK')),
        turnovers: round1(at('TO')),
        fgPct: round1(at('FG%')),
        threePct: round1(at('3P%')),
        ftPct: round1(at('FT%')),
        pir: null,
      }
    })
    .reverse()
  return { profile, seasons }
}

async function nba(part: Part, team: string, env: Env) {
  if (part === 'teams') {
    const raw = await getJson<{ sports: { leagues: { teams: { team: EspnTeam }[] }[] }[] }>(`${NBA}/teams`)
    return (raw.sports[0]?.leagues[0]?.teams ?? []).map(({ team: t }) => ({ id: t.id, name: t.displayName, logo: t.logos?.[0]?.href ?? null }))
  }
  if (part === 'squad') {
    const [raw, stats] = await Promise.all([
      getJson<{
        athletes?: { id: string; displayName: string; jersey?: string; age?: number; position?: { abbreviation?: string }; headshot?: { href: string } }[]
      }>(`${NBA}/teams/${team}/roster`),
      statsMap(env, 'nba', nbaStats),
    ])
    const athletes = raw.athletes ?? []
    // Toplu listede olmayanlar (az oynayanlar) tek tek
    const missing = athletes.filter((a) => !stats[a.id])
    const extra = Object.fromEntries(await Promise.all(missing.map(async (a) => [a.id, await nbaPlayerSeason(a.id)] as const)))
    return athletes.map(
      (a): SquadPlayer => ({
        id: a.id,
        name: a.displayName,
        number: a.jersey ?? null,
        position: position(a.position?.abbreviation),
        age: a.age ?? null,
        photo: a.headshot?.href ?? null,
        stats: stats[a.id] ?? extra[a.id] ?? null,
      }),
    )
  }
  const raw = await getJson<{
    events?: {
      id: string
      date: string
      competitions: {
        status?: { type: { state: string; completed: boolean } }
        competitors: { homeAway: 'home' | 'away'; score?: { value?: number }; team: EspnTeam }[]
      }[]
    }[]
  }>(`${NBA}/teams/${team}/schedule`)
  const games = (raw.events ?? []).flatMap((e): TeamGame[] => {
    const c = e.competitions[0]
    const home = c?.competitors.find((x) => x.homeAway === 'home')
    const away = c?.competitors.find((x) => x.homeAway === 'away')
    if (!home || !away) return []
    const state = c.status?.type
    const status = state?.completed ? 'finished' : state?.state === 'in' ? 'live' : 'upcoming'
    const side = (x: typeof home) => ({
      name: x.team.displayName,
      logo: x.team.logo ?? x.team.logos?.[0]?.href ?? null,
      score: status === 'upcoming' ? null : (x.score?.value ?? null),
    })
    return [{ id: e.id, date: e.date, status, home: side(home), away: side(away) }]
  })
  return split(games)
}

// ---------- EuroLeague / EuroCup (resmi API) ----------
const EL = 'https://api-live.euroleague.net/v2/competitions'

const elSeason = () => {
  const now = new Date()
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

// "HIFI, NADIR" -> "Nadir Hifi" ("BALDWIN IV, WADE" -> "Wade Baldwin IV")
const elName = (raw: string) => {
  const [last, first] = raw.split(',').map((s) => s.trim().toLowerCase().replace(/(^|[\s-])\S/g, (ch) => ch.toUpperCase()).replace(/\b(Ii|Iii|Iv)\b/g, (r) => r.toUpperCase()))
  return first ? `${first} ${last}` : last
}

const ageFrom = (birth?: string | null) => {
  if (!birth) return null
  const b = new Date(birth)
  const now = new Date()
  let age = now.getUTCFullYear() - b.getUTCFullYear()
  if (now < new Date(Date.UTC(now.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()))) age--
  return age
}

interface ElClub {
  code: string
  name: string
  abbreviatedName?: string
  images?: { crest?: string }
}

// EuroLeague / EuroCup: bütün oyuncuların bu sezonki maç başı istatistikleri (~200 KB)
async function euroleagueStats(competition: 'E' | 'U'): Promise<Record<string, PlayerSeasonAverages>> {
  const q = new URLSearchParams({ seasonMode: 'Single', seasonCode: `${competition}${elSeason()}`, statisticMode: 'PerGame', limit: '1000' })
  const raw = await getJson<{
    players?: { player: { code: string }; gamesPlayed: number; minutesPlayed: number; pointsScored: number; totalRebounds: number; assists: number }[]
  }>(`https://api-live.euroleague.net/v3/competitions/${competition}/statistics/players/traditional?${q}`)
  return Object.fromEntries(
    (raw.players ?? []).map((p) => [
      p.player.code,
      {
        games: p.gamesPlayed,
        minutes: round1(p.minutesPlayed),
        points: round1(p.pointsScored),
        rebounds: round1(p.totalRebounds),
        assists: round1(p.assists),
      },
    ]),
  )
}

// EuroLeague / EuroCup oyuncusu: profil bu sezonun oyuncu listesinden, kariyer son 10 sezonun
// EuroLeague ve EuroCup istatistiklerinden (sezon başına iki istek, 1 gün saklanır)
async function euroleaguePlayer(competition: 'E' | 'U', code: string): Promise<{ profile: PlayerProfile; seasons: CareerSeason[] }> {
  const year = elSeason()
  const people = await getJson<{
    data: {
      person: { code: string; name: string; birthDate?: string; height?: number; weight?: number; country?: { name: string } }
      dorsal?: string
      positionName?: string
      images?: { headshot?: string }
      club?: { name: string; abbreviatedName?: string; images?: { crest?: string } }
    }[]
  }>(`${EL}/${competition}/seasons/${competition}${year}/people?personType=J`)
  const p = people.data.find((x) => x.person.code === code)
  const profile: PlayerProfile = {
    name: p ? elName(p.person.name) : code,
    photo: p?.images?.headshot ?? null,
    position: p?.positionName ? (POSITION_TR[p.positionName] ?? p.positionName) : null,
    number: p?.dorsal ?? null,
    age: ageFrom(p?.person.birthDate),
    height: p?.person.height ? `${p.person.height} cm` : null,
    weight: p?.person.weight ? `${p.person.weight} kg` : null,
    nationality: p?.person.country?.name ?? null,
    team: p?.club ? (p.club.abbreviatedName ?? p.club.name) : null,
    teamLogo: p?.club?.images?.crest ?? null,
  }

  const pct = (v: unknown) => {
    const n = Number.parseFloat(String(v ?? ''))
    return Number.isFinite(n) ? round1(n) : null
  }
  const jobs = (['E', 'U'] as const).flatMap((comp) =>
    Array.from({ length: 10 }, (_, i) => year - i).map(async (y): Promise<CareerSeason | null> => {
      const s = await getJson<{
        games: { playerClubCode: string; game: { local: { club: ElClub }; road: { club: ElClub } } }[]
        accumulated?: { gamesStarted?: number; fieldGoalsMadeTotal?: number; fieldGoalsAttemptedTotal?: number }
        averagePerGame?: {
          timePlayed: number
          points: number
          totalRebounds: number
          assistances: number
          steals: number
          blocksFavour: number
          turnovers: number
          threePointShootingPercentage?: string
          freeThrowShootingPercentage?: string
          valuation: number
        }
      }>(`${EL}/${comp}/seasons/${comp}${y}/people/${code}/stats`).catch(() => null)
      const avg = s?.averagePerGame
      if (!s || !avg || s.games.length === 0) return null
      const g = s.games[s.games.length - 1]
      const club = g.game.local.club.code === g.playerClubCode ? g.game.local.club : g.game.road.club
      const acc = s.accumulated
      return {
        season: `${y}-${String(y + 1).slice(2)}`,
        competition: comp === 'E' ? 'EuroLeague' : 'EuroCup',
        team: club.abbreviatedName ?? club.name,
        teamLogo: club.images?.crest ?? null,
        games: s.games.length,
        starts: acc?.gamesStarted ?? null,
        minutes: round1(avg.timePlayed / 60),
        points: round1(avg.points),
        rebounds: round1(avg.totalRebounds),
        assists: round1(avg.assistances),
        steals: round1(avg.steals),
        blocks: round1(avg.blocksFavour),
        turnovers: round1(avg.turnovers),
        fgPct: acc?.fieldGoalsAttemptedTotal ? round1(((acc.fieldGoalsMadeTotal ?? 0) / acc.fieldGoalsAttemptedTotal) * 100) : null,
        threePct: pct(avg.threePointShootingPercentage),
        ftPct: pct(avg.freeThrowShootingPercentage),
        pir: round1(avg.valuation),
      }
    }),
  )
  const seasons = (await Promise.all(jobs)).filter((x): x is CareerSeason => x !== null)
  seasons.sort((a, b) => b.season.localeCompare(a.season) || a.competition.localeCompare(b.competition))
  return { profile, seasons }
}

async function euroleague(competition: 'E' | 'U', part: Part, team: string, env: Env) {
  const base = `${EL}/${competition}/seasons/${competition}${elSeason()}`
  if (part === 'people') {
    // Arama için sade liste (~440 KB -> ~20 KB)
    const raw = await getJson<{
      data: { person: { code: string; name: string }; images?: { headshot?: string }; club?: { abbreviatedName?: string; name: string }; active?: boolean }[]
    }>(`${base}/people?personType=J`)
    return raw.data
      .filter((p) => p.active !== false)
      .map((p) => ({ id: p.person.code, name: elName(p.person.name), team: p.club ? (p.club.abbreviatedName ?? p.club.name) : null, photo: p.images?.headshot ?? null }))
  }
  if (part === 'teams') {
    const raw = await getJson<{ data: ElClub[] }>(`${base}/clubs`)
    return raw.data.map((c) => ({ id: c.code, name: c.name, shortName: c.abbreviatedName ?? null, logo: c.images?.crest ?? null }))
  }
  if (part === 'squad') {
    const [raw, stats] = await Promise.all([
      getJson<{
        data: { person: { code: string; name: string; birthDate?: string }; dorsal?: string; positionName?: string; images?: { headshot?: string }; club?: { code: string }; active?: boolean }[]
      }>(`${base}/people?personType=J`),
      statsMap(env, competition, () => euroleagueStats(competition)),
    ])
    return raw.data
      .filter((p) => p.club?.code === team && p.active !== false)
      .map(
        (p): SquadPlayer => ({
          id: p.person.code,
          name: elName(p.person.name),
          number: p.dorsal ?? null,
          position: position(p.positionName),
          age: ageFrom(p.person.birthDate),
          photo: p.images?.headshot ?? null,
          stats: stats[p.person.code] ?? null,
        }),
      )
  }
  const raw = await getJson<{
    data: { identifier: string; utcDate: string; played: boolean; gameStatus?: string; local: { club: ElClub; score?: number }; road: { club: ElClub; score?: number } }[]
  }>(`${base}/games?teamCode=${encodeURIComponent(team)}`)
  const games = raw.data.map((g): TeamGame => {
    const status = g.played ? 'finished' : /live|progress/i.test(g.gameStatus ?? '') ? 'live' : 'upcoming'
    const side = (s: typeof g.local) => ({
      name: s.club.abbreviatedName ?? s.club.name,
      logo: s.club.images?.crest ?? null,
      score: status === 'upcoming' ? null : (s.score ?? null),
    })
    return { id: g.identifier, date: g.utcDate.endsWith('Z') ? g.utcDate : `${g.utcDate}Z`, status, home: side(g.local), away: side(g.road) }
  })
  return split(games)
}

// ---------- İstek ----------
const json = (status: number, body: string, ttl = 0) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': ttl > 0 ? `public, max-age=0, s-maxage=${ttl}` : 'no-store' },
  })

export async function handleTeamRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json(405, JSON.stringify({ message: 'Sadece GET desteklenir.' }))
  const q = new URL(request.url).searchParams
  const league = q.get('league') as League | null
  const part = q.get('part') as Part | null
  const team = q.get('team') ?? ''
  const player = q.get('player') ?? ''
  if (!league || !['nba', 'E', 'U'].includes(league) || !part || !['teams', 'squad', 'fixtures', 'player', 'people'].includes(part)) {
    return json(400, JSON.stringify({ message: 'league: nba|E|U, part: teams|squad|fixtures|player|people olmalı.' }))
  }
  if (part === 'people' && league === 'nba') return json(400, JSON.stringify({ message: 'NBA oyuncuları ESPN aramasından gelir.' }))
  if (part === 'player' ? !/^[A-Za-z0-9]{1,12}$/.test(player) : part !== 'teams' && part !== 'people' && !/^[A-Za-z0-9]{1,8}$/.test(team)) {
    return json(400, JSON.stringify({ message: 'team / player geçersiz.' }))
  }

  const key = `canliskor:team:v3:${league}:${part}:${part === 'player' ? player : team}`
  const hit = await cacheGet(env, key)
  if (hit) return json(200, hit.body, Math.max(1, Math.ceil((hit.expiresAt - Date.now()) / 1000)))
  try {
    const data =
      part === 'player'
        ? league === 'nba'
          ? await nbaPlayer(player)
          : await euroleaguePlayer(league, player)
        : league === 'nba'
          ? await nba(part, team, env)
          : await euroleague(league, part, team, env)
    const body = JSON.stringify(data)
    await cacheSet(env, key, body, TTL[part])
    return json(200, body, TTL[part])
  } catch (err) {
    console.error('Takım verisi alınamadı:', err)
    return json(502, JSON.stringify({ message: 'Takım verisi şu an alınamıyor.' }))
  }
}

export function GET(request: Request) {
  return handleTeamRequest(request, process.env)
}
