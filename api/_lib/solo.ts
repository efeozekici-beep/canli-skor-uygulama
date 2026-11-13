// Bireysel sporlar (MMA, tenis, Formula 1) için günlük liste; api/sports.ts kullanır.
//  - Tenis: ESPN ATP + WTA (anahtarsız, her gün). Sadece tekler; skor = kazanılan set, set skorları "sets" alanında.
//  - Formula 1: ESPN (her gün). Her seans (antrenman, sıralama, sprint, yarış) bir satır; sıralama "event.results".
//  - MMA: dün / bugün / yarın API-Sports (bütün organizasyonlar), diğer günler ESPN UFC. Skor yok, kazanan "winner".

import { getJson } from './http.js'

type Status = 'live' | 'finished' | 'upcoming'

export interface SoloMatch {
  id: string
  sport: 'mma' | 'tennis' | 'f1'
  leagueId: string
  leagueName: string
  leagueLogo?: string
  region: string
  featured?: boolean
  homeTeam: string
  awayTeam: string
  homeLogo?: string
  awayLogo?: string
  homeScore: number | null
  awayScore: number | null
  status: Status
  minute: number | null
  statusLabel?: string
  startTime: string
  /** Kazanan taraf (MMA, tenis): skor yokken kaybeden soluk gösterilir */
  winner?: 'home' | 'away'
  /** Tenis: set set oyun skorları */
  sets?: { home: number | null; away: number | null }[]
  /** Formula 1: iki takım yerine seans adı ve sıralama */
  event?: { title: string; results: string[] }
}

const DAY_MS = 24 * 60 * 60 * 1000
const istanbulDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(iso))

// ESPN günleri ABD saatine göre böler: Türkiye günü için o gün + önceki gün çekilir, sonra Türkiye tarihine göre süzülür
const espnDates = (date: string) =>
  [new Date(Date.parse(`${date}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10), date].map((d) => d.replace(/-/g, ''))

async function espnScoreboards<T>(path: string, date: string): Promise<T[]> {
  const lists = await Promise.all(
    espnDates(date).map((d) =>
      getJson<{ events?: T[] }>(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${d}`).catch(() => ({ events: [] as T[] })),
    ),
  )
  return lists.flatMap((l) => l.events ?? [])
}

interface EspnStatus {
  period?: number
  type: { name: string; state: 'pre' | 'in' | 'post'; completed: boolean }
}

function espnState(s: EspnStatus, liveLabel: string): Pick<SoloMatch, 'status' | 'minute' | 'statusLabel'> {
  const { state, completed, name } = s.type
  if (name === 'STATUS_POSTPONED') return { status: 'upcoming', minute: null, statusLabel: 'Ert.' }
  if (name === 'STATUS_CANCELED') return { status: 'upcoming', minute: null, statusLabel: 'İptal' }
  if (state === 'post') return { status: 'finished', minute: null, statusLabel: completed ? undefined : 'Bitti' }
  if (state === 'in') return { status: 'live', minute: null, statusLabel: liveLabel }
  return { status: 'upcoming', minute: null }
}

// ---------- Tenis ----------
interface TnCompetitor {
  homeAway?: 'home' | 'away'
  order?: number
  winner?: boolean
  athlete?: { displayName: string; flag?: { href?: string } }
  linescores?: { value?: number; winner?: boolean }[]
}
interface TnCompetition {
  id: string
  date: string
  status: EspnStatus
  competitors: TnCompetitor[]
}
interface TnEvent {
  id: string
  name: string
  groupings?: { grouping: { displayName: string }; competitions: TnCompetition[] }[]
}

export async function tennisDay(date: string): Promise<SoloMatch[]> {
  const out = new Map<string, SoloMatch>()
  for (const tour of ['atp', 'wta'] as const) {
    for (const e of await espnScoreboards<TnEvent>(`tennis/${tour}`, date)) {
      for (const g of e.groupings ?? []) {
        if (!/singles/i.test(g.grouping.displayName)) continue
        for (const c of g.competitions) {
          if (istanbulDay(c.date) !== date || out.has(c.id)) continue
          const home = c.competitors.find((x) => x.homeAway === 'home') ?? c.competitors[0]
          const away = c.competitors.find((x) => x.homeAway === 'away') ?? c.competitors[1]
          if (!home?.athlete || !away?.athlete) continue
          const st = espnState(c.status, `${c.status.period ?? 1}. Set`)
          const n = Math.max(home.linescores?.length ?? 0, away.linescores?.length ?? 0)
          const sets = Array.from({ length: n }, (_, i) => ({ home: home.linescores?.[i]?.value ?? null, away: away.linescores?.[i]?.value ?? null }))
          const won = (x: TnCompetitor) => (x.linescores ?? []).filter((s) => s.winner).length
          const started = st.status !== 'upcoming'
          out.set(c.id, {
            id: `espn-tn-${c.id}`,
            sport: 'tennis',
            leagueId: `espn-tn-${tour}-${e.id}`,
            leagueName: e.name,
            region: tour.toUpperCase(),
            featured: true,
            homeTeam: home.athlete.displayName,
            awayTeam: away.athlete.displayName,
            homeLogo: home.athlete.flag?.href,
            awayLogo: away.athlete.flag?.href,
            homeScore: started ? won(home) : null,
            awayScore: started ? won(away) : null,
            startTime: c.date,
            winner: home.winner ? 'home' : away.winner ? 'away' : undefined,
            sets: sets.length > 0 ? sets : undefined,
            ...st,
          })
        }
      }
    }
  }
  return [...out.values()]
}

// ---------- Formula 1 ----------
interface F1Competition {
  id: string
  date: string
  type?: { abbreviation?: string }
  status: EspnStatus
  competitors?: { order?: number; athlete?: { displayName: string } }[]
}
interface F1Event {
  id: string
  name: string
  competitions?: F1Competition[]
}

const SESSIONS: Record<string, string> = {
  FP1: '1. Antrenman',
  FP2: '2. Antrenman',
  FP3: '3. Antrenman',
  Qual: 'Sıralama',
  Race: 'Yarış',
  Sprint: 'Sprint',
  SS: 'Sprint Sıralama',
  SQ: 'Sprint Sıralama',
}

export async function f1Day(date: string): Promise<SoloMatch[]> {
  const out = new Map<string, SoloMatch>()
  for (const e of await espnScoreboards<F1Event>('racing/f1', date)) {
    for (const c of e.competitions ?? []) {
      if (istanbulDay(c.date) !== date || out.has(c.id)) continue
      const title = SESSIONS[c.type?.abbreviation ?? ''] ?? c.type?.abbreviation ?? 'Seans'
      const st = espnState(c.status, 'Canlı')
      const results =
        st.status === 'upcoming'
          ? []
          : [...(c.competitors ?? [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).flatMap((x) => (x.athlete ? [x.athlete.displayName] : []))
      out.set(c.id, {
        id: `espn-f1-${c.id}`,
        sport: 'f1',
        leagueId: `espn-f1-${e.id}`,
        leagueName: e.name,
        region: 'Formula 1',
        featured: true,
        homeTeam: title,
        awayTeam: results[0] ?? '',
        homeScore: null,
        awayScore: null,
        startTime: c.date,
        event: { title, results },
        ...st,
      })
    }
  }
  return [...out.values()]
}

// ---------- MMA ----------
interface UfcEvent {
  id: string
  name: string
  competitions?: {
    id: string
    date: string
    status: EspnStatus
    competitors: { order?: number; winner?: boolean; athlete?: { displayName: string; flag?: { href?: string } } }[]
  }[]
}

// API'nin vermediği günler: ESPN UFC
export async function ufcDay(date: string): Promise<SoloMatch[]> {
  const out = new Map<string, SoloMatch>()
  for (const e of await espnScoreboards<UfcEvent>('mma/ufc', date)) {
    for (const c of e.competitions ?? []) {
      if (istanbulDay(c.date) !== date || out.has(c.id)) continue
      const [first, second] = [...c.competitors].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      if (!first?.athlete || !second?.athlete) continue
      out.set(c.id, {
        id: `espn-mma-${c.id}`,
        sport: 'mma',
        leagueId: `espn-mma-${e.id}`,
        leagueName: e.name,
        region: 'UFC',
        featured: true,
        homeTeam: first.athlete.displayName,
        awayTeam: second.athlete.displayName,
        homeLogo: first.athlete.flag?.href,
        awayLogo: second.athlete.flag?.href,
        homeScore: null,
        awayScore: null,
        startTime: c.date,
        winner: first.winner ? 'home' : second.winner ? 'away' : undefined,
        ...espnState(c.status, 'Canlı'),
      })
    }
  }
  return [...out.values()]
}

interface ApiFight {
  id: number
  date: string
  slug: string
  status: { short: string }
  fighters: { first: ApiFighter; second: ApiFighter }
}
interface ApiFighter {
  name: string
  logo?: string
  winner?: boolean
}

// API bazı adları iki kez UTF-8 kodlanmış veriyor ("YaÃ±ez" -> "Yañez")
function fixText(s: string) {
  if (!/[ÃÂ]/.test(s) || [...s].some((ch) => ch.charCodeAt(0) > 255)) return s
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(s, (ch) => ch.charCodeAt(0)))
  } catch {
    return s
  }
}

const slugId = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// Dün / bugün / yarın: API-Sports MMA (bütün organizasyonlar)
export async function mmaApiDay(key: string, date: string): Promise<SoloMatch[]> {
  const res = await fetch(`https://v1.mma.api-sports.io/fights?date=${date}&timezone=Europe/Istanbul`, {
    headers: { 'x-apisports-key': key, accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`mma HTTP ${res.status}`)
  const body = (await res.json()) as { errors?: unknown; response?: ApiFight[] }
  const errors = body.errors && (Array.isArray(body.errors) ? body.errors.length > 0 : Object.keys(body.errors).length > 0)
  if (errors) throw new Error(`mma API hatası: ${JSON.stringify(body.errors)}`)

  return (body.response ?? []).map((f) => {
    const code = f.status.short
    const shown: Pick<SoloMatch, 'status' | 'minute' | 'statusLabel'> =
      code === 'NS'
        ? { status: 'upcoming', minute: null }
        : code === 'FT'
          ? { status: 'finished', minute: null }
          : code === 'CANC'
            ? { status: 'upcoming', minute: null, statusLabel: 'İptal' }
            : code === 'PST'
              ? { status: 'upcoming', minute: null, statusLabel: 'Ert.' }
              : { status: 'live', minute: null, statusLabel: 'Canlı' }
    const eventName = fixText(f.slug)
    return {
      id: `mma-${f.id}`,
      sport: 'mma',
      leagueId: `mma-${slugId(eventName)}`,
      leagueName: eventName,
      region: /^\S+/.exec(eventName)?.[0].replace(/:$/, '') ?? 'MMA',
      featured: true,
      homeTeam: fixText(f.fighters.first.name),
      awayTeam: fixText(f.fighters.second.name),
      homeLogo: f.fighters.first.logo || undefined,
      awayLogo: f.fighters.second.logo || undefined,
      homeScore: null,
      awayScore: null,
      startTime: f.date,
      winner: f.fighters.first.winner ? 'home' : f.fighters.second.winner ? 'away' : undefined,
      ...shown,
    } satisfies SoloMatch
  })
}
