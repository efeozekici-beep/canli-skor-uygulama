import type { PlayerSearchResult, SearchResults, TeamSearchResult } from '../types/search'
import { MOCK_PLAYERS } from '../data/mockPlayers'
import { knownMatchesForDate } from './matchService'
import { getPlayerPhotos } from './photoService'
import { turkishTeamName } from './providers/espnSoccer'
import { LEAGUE_SOURCES } from '../config/leagueSources'
import { readStore, writeStore } from '../lib/storageCache'
import { basketballPlayerHref, basketballTeamHref, playerHref, teamHref } from '../lib/navigation'
import { getLeaguePeople, getLeagueTeams } from './basketballTeamService'
import { sameTeamName, teamIdOf } from '../lib/team'

// Aramanın tek veri kapısı.
//  - Takımlar ve oyuncular: ESPN araması (kota yok, backend 7 gün saklar) + bugün maçı olan takımlar
//  - Ligler: lig sayfası olan 29 lig (src/config/leagueSources.ts) + bugünün maçlarındaki ligler
//  - Basketbol: NBA oyuncu ve takımları ESPN aramasından; EuroLeague / EuroCup oyuncu ve takımları resmi API'nin
//    listelerinden (aranan metin bu listelerde süzülür)
//  - Örnek oyuncular (Yamal, Kane, Güler) de çıkmaya devam eder
// Takıma tıklayınca takım sayfası, oyuncuya tıklayınca oyuncu sayfası açılır.

const DAY = 24 * 60 * 60_000
const MAX_PER_GROUP = 5

const norm = (s: string) => s.toLocaleLowerCase('tr').trim()
// Aksan/Türkçe harf farkı arama sonucunu etkilemesin ("besiktas" = "Beşiktaş")
const plain = (s: string) => teamIdOf(s).replace(/-/g, ' ')
const cacheKey = (query: string) => `canliskor:search:v3:${norm(query)}`

// Hafıza önbelleği (aynı oturumda tekrar yazılan arama anında gelir)
const memory = new Map<string, SearchResults>()

interface EspnSearch {
  results?: { type: string; contents?: { uid: string; displayName: string; subtitle?: string; image?: { default?: string }; defaultLeagueSlug?: string }[] }[]
}

// ESPN lig kodu -> bizim lig id'miz (takım sayfasının puan durumu ve maçları o ligden gelsin)
const leagueIdBySlug = new Map(Object.entries(LEAGUE_SOURCES).map(([id, src]) => [src.espn, id]))

async function espnSearch(query: string, signal?: AbortSignal) {
  const res = await fetch(`/api/espn/apis/search/v2?query=${encodeURIComponent(query)}&limit=20`, { signal })
  if (!res.ok) throw new Error(`Arama başarısız (HTTP ${res.status}).`)
  const body = (await res.json()) as EspnSearch
  const byType = (type: string) => (body.results ?? []).find((r) => r.type === type)?.contents ?? []
  // s:600 = futbol, s:40~l:46 = NBA (ESPN aynı aramada başka sporları da döndürüyor)
  const soccer = <T extends { uid: string }>(list: T[]) => list.filter((c) => c.uid.startsWith('s:600~'))
  const nba = <T extends { uid: string }>(list: T[]) => list.filter((c) => c.uid.startsWith('s:40~l:46~'))
  // Oyuncular futbol + NBA birlikte, ESPN'in ilgi sırasıyla (ör. "jokic" -> önce Nikola Jokić)
  const players = byType('player').filter((c) => c.uid.startsWith('s:600~') || c.uid.startsWith('s:40~l:46~'))
  return { teams: soccer(byType('team')), players, nbaTeams: nba(byType('team')) }
}

async function realSearch(query: string, signal?: AbortSignal): Promise<SearchResults> {
  const q = plain(query)
  const known = knownMatchesForDate(new Date())
  const espn = await espnSearch(query, signal).catch((err: unknown) => {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return { teams: [], players: [], nbaTeams: [] } // ESPN çalışmazsa yerel sonuçlarla devam
  })

  // Takımlar: bugünün maçlarındaki takımlar (API-Football id'si var) + ESPN
  const teams = new Map<string, TeamSearchResult>()
  for (const m of known) {
    if (m.sport !== 'football') continue
    for (const [name, id, logo] of [[m.homeTeam, m.homeTeamId, m.homeLogo], [m.awayTeam, m.awayTeamId, m.awayLogo]] as const) {
      if (plain(name).includes(q) && !teams.has(plain(name))) {
        teams.set(plain(name), { id: id ?? teamIdOf(name), name, logo, country: m.region, href: teamHref({ id, name }, m.leagueId) })
      }
    }
  }
  for (const t of espn.teams) {
    const name = turkishTeamName(t.displayName)
    const key = plain(name)
    // ESPN adı tutmayan takımları da getirebiliyor ("premier" -> Arsenal) ve kadın kupası kayıtlarında
    // yazım hataları var: sadece adı aranan metni içeren, kadın ligi olmayan takımlar
    if (!key.includes(q) || /women/i.test(t.subtitle ?? '')) continue
    if (teams.has(key) || [...teams.keys()].some((k) => sameTeamName(k, name))) continue
    const leagueId = t.defaultLeagueSlug ? (leagueIdBySlug.get(t.defaultLeagueSlug) ?? null) : null
    const region = leagueId ? LEAGUE_SOURCES[leagueId].region : null
    teams.set(key, { id: t.uid, name, logo: t.image?.default, country: region ?? t.subtitle ?? null, href: teamHref({ name }, leagueId, region) })
  }

  // Basketbol takımları: NBA (ESPN aramasından) + EuroLeague / EuroCup (lig takım listelerinden)
  for (const t of espn.nbaTeams) {
    const id = t.uid.match(/t:(\d+)/)?.[1]
    if (id) teams.set(`nba-${id}`, { id: t.uid, name: t.displayName, logo: t.image?.default, country: 'NBA', href: basketballTeamHref('bb-12', { id, name: t.displayName }) })
  }
  const [elTeams, ecTeams, elPeople, ecPeople] = await Promise.all([
    getLeagueTeams('bb-120').catch(() => []),
    getLeagueTeams('bb-194').catch(() => []),
    getLeaguePeople('bb-120').catch(() => []),
    getLeaguePeople('bb-194').catch(() => []),
  ])
  for (const [leagueId, label, list] of [['bb-120', 'EuroLeague', elTeams], ['bb-194', 'EuroCup', ecTeams]] as const) {
    for (const t of list) {
      if (!plain(t.name).includes(q) && !plain(t.shortName ?? '').includes(q)) continue
      teams.set(`${leagueId}-${t.id}`, { id: `${leagueId}-${t.id}`, name: t.name, logo: t.logo ?? undefined, country: label, href: basketballTeamHref(leagueId, { id: t.id, name: t.name }) })
    }
  }

  // Ligler: lig sayfası olan ligler + bugünün maçlarındaki ligler
  const leagues = new Map<string, SearchResults['leagues'][number]>()
  for (const [id, src] of Object.entries(LEAGUE_SOURCES)) {
    if (plain(src.name).includes(q) || plain(src.region).includes(q)) {
      leagues.set(id, { id, name: src.name, logo: `https://media.api-sports.io/football/leagues/${id}.png`, region: src.region })
    }
  }
  for (const [id, name] of [['bb-12', 'NBA'], ['bb-120', 'EuroLeague'], ['bb-194', 'EuroCup']] as const) {
    if (plain(name).includes(q)) leagues.set(id, { id, name, logo: `https://media.api-sports.io/basketball/leagues/${id.slice(3)}.png`, region: 'Basketbol' })
  }
  for (const m of known) {
    if (m.sport === 'football' && plain(m.leagueName).includes(q) && !leagues.has(m.leagueId)) {
      leagues.set(m.leagueId, { id: m.leagueId, name: m.leagueName, logo: m.leagueLogo, region: m.region })
    }
  }

  // Oyuncular: ESPN (futbol + NBA, ilgi sırasıyla) + EuroLeague / EuroCup + örnek oyuncular
  const players: PlayerSearchResult[] = espn.players.map((p) => {
    const espnId = p.uid.match(/a:(\d+)/)?.[1] ?? ''
    if (p.uid.startsWith('s:40~')) {
      return { id: `nba-${espnId}`, name: p.displayName, photo: p.image?.default, teamName: p.subtitle ? `${p.subtitle} · NBA` : 'NBA', href: basketballPlayerHref('bb-12', espnId) }
    }
    const teamName = p.subtitle ? turkishTeamName(p.subtitle) : null
    return { id: `espn-${espnId}`, name: p.displayName, teamName, href: playerHref(`espn-${espnId}`, teamName) }
  })
  for (const [leagueId, label, list] of [['bb-120', 'EuroLeague', elPeople], ['bb-194', 'EuroCup', ecPeople]] as const) {
    for (const p of list) {
      if (!plain(p.name).includes(q)) continue
      players.push({ id: `${leagueId}-${p.id}`, name: p.name, photo: p.photo ?? undefined, teamName: p.team ? `${p.team} · ${label}` : label, href: basketballPlayerHref(leagueId, p.id) })
    }
  }
  for (const { profile } of MOCK_PLAYERS) {
    // Örnek oyuncu, aynı adlı gerçek oyuncu bulunduysa gösterilmez
    if (plain(profile.name).includes(q) && !players.some((p) => plain(p.name) === plain(profile.name))) {
      players.push({
        id: profile.id,
        name: profile.name,
        photo: profile.photo,
        teamName: profile.team?.name ?? null,
        teamLogo: profile.team?.logo,
        href: playerHref(profile.id),
      })
    }
  }

  // En iyi eşleşenler önce: adı aranan metinle başlayan, sonra bir kelimesi onunla başlayan, sonra diğerleri
  // (sıralama kararlı: aynı derecede ESPN'in sırası korunur)
  const rank = (name: string) => (plain(name).startsWith(q) ? 0 : plain(name).split(' ').some((w) => w.startsWith(q)) ? 1 : 2)
  players.sort((a, b) => rank(a.name) - rank(b.name))
  const sortedTeams = [...teams.values()].sort((a, b) => rank(a.name) - rank(b.name))

  // Oyuncu fotoğrafları (ESPN futbolcu fotoğrafı vermiyor): ilk 5 oyuncu için Wikipedia, tek istekte
  const shown = players.slice(0, MAX_PER_GROUP)
  const missing = shown.filter((p) => !p.photo).map((p) => p.name)
  const photos = missing.length ? await getPlayerPhotos('football', missing).catch(() => ({}) as Record<string, string | null>) : {}

  return {
    teams: sortedTeams.slice(0, MAX_PER_GROUP),
    leagues: [...leagues.values()].slice(0, MAX_PER_GROUP),
    players: shown.map((p) => ({ ...p, photo: p.photo ?? photos[p.name] ?? undefined })),
  }
}

// Önbellekte varsa hemen döndür (bekleme yok); yoksa null
export function peekSearch(query: string): SearchResults | null {
  const key = cacheKey(query)
  return memory.get(key) ?? readStore<SearchResults>(key, DAY, 'local')
}

export async function searchAll(query: string, signal?: AbortSignal): Promise<SearchResults> {
  const cached = peekSearch(query)
  if (cached) return cached
  const results = await realSearch(query, signal)
  const key = cacheKey(query)
  memory.set(key, results)
  writeStore(key, results, 'local')
  return results
}
