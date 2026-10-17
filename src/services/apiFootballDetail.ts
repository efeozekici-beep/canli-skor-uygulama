import type { Match } from '../types/match'
import type { Lineups, LineupPlayer, MatchEvent, MatchEventKind, PastMatch, PlayerPosition, Side, StatItem, Standings, TeamLineup } from '../types/matchDetail'
import type { ApiFixturePlayersTeam, PlayerMatchStats } from '../types/playerStats'
import { apiGet, toMatch, userTimezone, type ApiFixture } from './apiFootball'
import { mapApiFixturePlayers } from './apiFootballPlayers'

// ---------- API-Football ham tipleri (sadece kullandığımız alanlar) ----------
interface ApiEvent {
  time: { elapsed: number; extra: number | null }
  team: { id: number; name: string }
  player: { id: number | null; name: string | null }
  assist: { id: number | null; name: string | null }
  type: string // "Goal" | "Card" | "subst" | "Var"
  detail: string // "Normal Goal" | "Own Goal" | "Penalty" | "Yellow Card" ...
}

interface ApiLineupPlayer {
  player: { id: number; name: string; number: number; pos: string | null; grid: string | null }
}

interface ApiLineup {
  team: { id: number; name: string; logo: string }
  coach: { id: number | null; name: string | null; photo: string | null }
  formation: string | null
  startXI: ApiLineupPlayer[]
  substitutes: ApiLineupPlayer[]
}

interface ApiTeamStatistics {
  team: { id: number }
  statistics: { type: string; value: number | string | null }[]
}

export interface ApiFixtureDetail extends ApiFixture {
  events: ApiEvent[]
  lineups: ApiLineup[]
  statistics: ApiTeamStatistics[]
  players: ApiFixturePlayersTeam[]
}

// Tek istekte gelen her şey, uygulamanın tiplerine çevrilmiş hali.
export interface FixtureBundle {
  match: Match
  round?: string
  venue?: string
  referee?: string
  events: MatchEvent[] | null
  lineups: Lineups | null
  statistics: StatItem[] | null
  players: PlayerMatchStats[] | null
}

// ---------- Olaylar ----------
function mapEvents(d: ApiFixtureDetail): MatchEvent[] {
  const homeId = d.teams.home.id
  const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')
  // Takımın kadrosundaki oyuncu id'leri (ilk 11 ve yedekler)
  const squad = (teamId: number, onlyStarters = false) => {
    const lineup = d.lineups.find((l) => l.team.id === teamId)
    const list = lineup ? (onlyStarters ? lineup.startXI : [...lineup.startXI, ...lineup.substitutes]) : []
    return new Set(list.map((p) => p.player.id))
  }

  const result: MatchEvent[] = []
  d.events.forEach((e, i) => {
    if (!e.player.name) return
    const teamSide: Side = e.team.id === homeId ? 'home' : 'away'
    let side = teamSide
    let kind: MatchEventKind
    let player = e.player.name
    let playerId = e.player.id
    let secondPlayer = e.assist.name ?? undefined
    let secondPlayerId = e.assist.id

    const type = e.type.toLowerCase()
    if (type === 'goal') {
      if (e.detail === 'Own Goal') {
        kind = 'own-goal'
        secondPlayer = undefined
        // API'de takım = golden faydalanan taraf. Oyuncu o takımın kadrosundaysa ters taraftır.
        if (squad(e.team.id).has(e.player.id ?? -1)) side = other(teamSide)
      } else if (e.detail === 'Penalty') {
        kind = 'penalty'
        secondPlayer = undefined
      } else if (e.detail === 'Missed Penalty') {
        kind = 'missed-penalty'
        secondPlayer = undefined
      } else {
        kind = 'goal'
      }
    } else if (type === 'card') {
      kind = /second/i.test(e.detail) ? 'second-yellow' : /red/i.test(e.detail) ? 'red' : 'yellow'
      secondPlayer = undefined
    } else if (type === 'subst') {
      kind = 'sub'
      // API'de genelde player = çıkan, assist = giren. Emin olmak için ilk 11'e bakıyoruz.
      const starters = squad(e.team.id, true)
      const playerIsOut = starters.has(e.player.id ?? -1) || !starters.has(e.assist.id ?? -1)
      if (playerIsOut) {
        player = e.assist.name ?? '?'
        playerId = e.assist.id
        secondPlayer = e.player.name
        secondPlayerId = e.player.id
      }
    } else {
      return // VAR vb. olayları göstermiyoruz
    }

    result.push({
      id: `${i}`,
      minute: e.time.elapsed,
      extra: e.time.extra,
      side,
      kind,
      player,
      playerId: playerId !== null ? String(playerId) : undefined,
      secondPlayer,
      secondPlayerId: secondPlayerId !== null && secondPlayerId !== undefined ? String(secondPlayerId) : undefined,
    })
  })
  return result
}

// ---------- Kadrolar ----------
// API-Football fotoğraf adresi oyuncu numarasından üretilebiliyor: kadroda fotoğraf alanı olmadığı için
// maça girmeyen yedeklerin fotoğrafı da böylece gelir (ek istek yok)
const playerPhoto = (id: number) => `https://media.api-sports.io/football/players/${id}.png`
// Teknik direktörde de aynısı: isim gelip fotoğraf boş gelirse numaradan üret
const coachPhoto = (id: number | null) => (id ? `https://media.api-sports.io/football/coachs/${id}.png` : undefined)

function mapLineups(d: ApiFixtureDetail, photos: Map<string, string>): Lineups | null {
  const toPlayer = ({ player }: ApiLineupPlayer): LineupPlayer => ({
    id: String(player.id),
    name: player.name,
    number: player.number,
    position: (['G', 'D', 'M', 'F'].includes(player.pos ?? '') ? player.pos : 'M') as PlayerPosition,
    grid: player.grid,
    photo: photos.get(String(player.id)) ?? playerPhoto(player.id),
  })
  const toTeam = (teamId: number): TeamLineup | null => {
    const l = d.lineups.find((x) => x.team.id === teamId)
    if (!l || l.startXI.length === 0) return null
    return {
      team: { id: String(l.team.id), name: l.team.name, logo: l.team.logo },
      formation: l.formation ?? '',
      coach: l.coach.name ?? '—',
      coachPhoto: l.coach.photo ?? coachPhoto(l.coach.id),
      startXI: l.startXI.map(toPlayer),
      substitutes: l.substitutes.map(toPlayer),
    }
  }
  const home = toTeam(d.teams.home.id)
  const away = toTeam(d.teams.away.id)
  return home && away ? { home, away } : null
}

// ---------- İstatistikler ----------
const STATS: [apiType: string, key: string, label: string, unit?: '%'][] = [
  ['Ball Possession', 'possession', 'Topla oynama', '%'],
  ['expected_goals', 'xg', 'Gol beklentisi (xG)'],
  ['Total Shots', 'shots', 'Toplam şut'],
  ['Shots on Goal', 'shotsOnTarget', 'İsabetli şut'],
  ['Corner Kicks', 'corners', 'Korner'],
  ['Fouls', 'fouls', 'Faul'],
  ['Offsides', 'offsides', 'Ofsayt'],
  ['Total passes', 'passes', 'Pas'],
  ['Yellow Cards', 'yellow', 'Sarı kart'],
  ['Red Cards', 'red', 'Kırmızı kart'],
]

// "52%" / 7 / null -> sayı (null = 0)
const statNumber = (v: number | string | null | undefined) => (v === null || v === undefined ? 0 : Number.parseFloat(String(v)) || 0)

function mapStatistics(d: ApiFixtureDetail): StatItem[] | null {
  const forTeam = (teamId: number) => d.statistics.find((s) => s.team.id === teamId)?.statistics ?? []
  const home = forTeam(d.teams.home.id)
  const away = forTeam(d.teams.away.id)
  if (home.length === 0 && away.length === 0) return null
  const value = (list: typeof home, type: string) => statNumber(list.find((s) => s.type === type)?.value)

  const items: StatItem[] = STATS.filter(([type]) => [...home, ...away].some((s) => s.type === type)).map(([type, key, label, unit]) => ({
    key,
    label,
    unit,
    home: value(home, type),
    away: value(away, type),
  }))

  // API yüzde vermiyor: isabetli pas sayısı / toplam pas
  const accuracy = (list: typeof home) => {
    const total = value(list, 'Total passes')
    return total ? Math.round((value(list, 'Passes accurate') / total) * 100) : 0
  }
  const passIndex = items.findIndex((i) => i.key === 'passes')
  if (passIndex !== -1) {
    items.splice(passIndex + 1, 0, { key: 'passAccuracy', label: 'İsabetli pas', unit: '%', home: accuracy(home), away: accuracy(away) })
  }
  return items
}

// ---------- Oyuncu istatistikleri ----------
function mapPlayers(d: ApiFixtureDetail, events: MatchEvent[]): PlayerMatchStats[] | null {
  if (d.players.length === 0) return null
  // Değişiklik dakikaları ve kendi kalesine goller /fixtures/players'ta yok; olaylardan tamamlıyoruz.
  return mapApiFixturePlayers(d.players, String(d.teams.home.id)).map((p) => ({
    ...p,
    subIn: events.find((e) => e.kind === 'sub' && e.playerId === p.playerId)?.minute ?? null,
    subOut: events.find((e) => e.kind === 'sub' && e.secondPlayerId === p.playerId)?.minute ?? null,
    ownGoals: events.filter((e) => e.kind === 'own-goal' && e.playerId === p.playerId).length,
  }))
}

// "League Stage - 2" -> "Lig Aşaması · 2. Hafta", "Regular Season - 9" -> "9. Hafta"
function translateRound(round?: string) {
  if (!round) return undefined
  const match = /^(.*?)\s*-\s*(\d+)$/.exec(round)
  if (!match) return round.replace('Round of 16', 'Son 16').replace('Quarter-finals', 'Çeyrek final').replace('Semi-finals', 'Yarı final')
  const [, stage, n] = match
  if (stage === 'Regular Season') return `${n}. Hafta`
  if (stage === 'League Stage') return `Lig Aşaması · ${n}. Hafta`
  if (stage.startsWith('Group')) return `${stage.replace('Group', 'Grup')} · ${n}. Hafta`
  return round
}

// ---------- Dışa açılan istekler ----------

// Ayrıntılar + Kadrolar + İstatistikler + reytingler: hepsi tek istekte (1 kota)
export async function fetchFixtureBundle(id: string): Promise<FixtureBundle | null> {
  const [d] = await apiGet<ApiFixtureDetail[]>(`/fixtures?id=${encodeURIComponent(id)}&timezone=${encodeURIComponent(userTimezone())}`)
  if (!d) return null
  const events = mapEvents(d)
  const photos = new Map(d.players.flatMap((t) => t.players.map((p) => [String(p.player.id), p.player.photo] as const)))
  return {
    match: toMatch(d),
    round: translateRound(d.league.round),
    venue: [d.fixture.venue?.name, d.fixture.venue?.city].filter(Boolean).join(', ') || undefined,
    referee: d.fixture.referee ?? undefined,
    events,
    lineups: mapLineups(d, photos),
    statistics: mapStatistics(d),
    players: mapPlayers(d, events),
  }
}

interface ApiStandingRow {
  rank: number
  team: { id: number; name: string; logo: string }
  points: number
  goalsDiff: number
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
}

// Puan durumu (ücretsiz planda bu sezon kapalı; ücretli planda çalışır)
// ---------- Teknik direktör ----------
interface ApiCoach {
  name: string
  photo: string | null
  career: { team: { id: number }; start: string | null; end: string | null }[]
}

// Kadroda teknik direktör boş gelirse (canlı maçlarda olabiliyor) takımın şu anki hocası.
// Görevi bitmemiş (end: null) olanlardan en son başlayanı seçer; eski geçici hocalar elenir.
export async function fetchCurrentCoach(teamId: string): Promise<{ name: string; photo?: string } | null> {
  const coaches = await apiGet<ApiCoach[]>(`/coachs?team=${encodeURIComponent(teamId)}`)
  const current = coaches
    .flatMap((c) => c.career.filter((j) => String(j.team.id) === teamId && j.end === null).map((j) => ({ c, start: j.start ?? '' })))
    .sort((a, b) => b.start.localeCompare(a.start))[0]
  return current ? { name: current.c.name, photo: current.c.photo ?? undefined } : null
}

export async function fetchStandings(leagueId: string, season: number, teamIds: string[]): Promise<Standings | null> {
  const [entry] = await apiGet<{ league: { id: number; name: string; standings: ApiStandingRow[][] } }[]>(
    `/standings?league=${leagueId}&season=${season}`,
  )
  if (!entry) return null
  // Gruplu liglerde maçtaki takımın grubunu seç
  const groups = entry.league.standings
  const group = groups.find((g) => g.some((r) => teamIds.includes(String(r.team.id)))) ?? groups[0]
  if (!group) return null
  return {
    leagueId,
    leagueName: entry.league.name,
    rows: group.map((r) => ({
      rank: r.rank,
      team: { id: String(r.team.id), name: r.team.name, logo: r.team.logo },
      played: r.all.played,
      win: r.all.win,
      draw: r.all.draw,
      lose: r.all.lose,
      goalsFor: r.all.goals.for,
      goalsAgainst: r.all.goals.against,
      goalsDiff: r.goalsDiff,
      points: r.points,
    })),
  }
}

// Aralarındaki bitmiş maçlar, yeniden eskiye (en fazla 10)
export async function fetchHeadToHead(homeId: string, awayId: string): Promise<PastMatch[]> {
  const fixtures = await apiGet<ApiFixture[]>(`/fixtures/headtohead?h2h=${homeId}-${awayId}&timezone=${encodeURIComponent(userTimezone())}`)
  return fixtures
    .filter((f) => f.goals.home !== null && f.goals.away !== null && ['FT', 'AET', 'PEN'].includes(f.fixture.status.short))
    .sort((a, b) => b.fixture.date.localeCompare(a.fixture.date))
    .slice(0, 10)
    .map((f) => ({
      id: String(f.fixture.id),
      date: f.fixture.date,
      leagueName: f.league.name,
      home: { id: String(f.teams.home.id), name: f.teams.home.name, logo: f.teams.home.logo },
      away: { id: String(f.teams.away.id), name: f.teams.away.name, logo: f.teams.away.logo },
      homeScore: f.goals.home ?? 0,
      awayScore: f.goals.away ?? 0,
    }))
}
