import type { Match } from '../types/match'
import type { SquadPlayer, SquadPosition, TeamInfo, TeamStatsSummary } from '../types/team'
import { apiGet } from './apiFootball'
import { getLeague, getStandings } from './leagueService'
import { registerMatches } from './matchService'
import * as espn from './providers/espnSoccer'
import { LEAGUE_SOURCES, leagueSourceFor } from '../config/leagueSources'
import { currentSeasonFor } from '../lib/league'
import { COUNTRY_TR } from '../lib/leagueOrder'
import { sameTeamName } from '../lib/team'
import { readStore, writeStore } from '../lib/storageCache'

// Takım sayfasının tek veri kapısı.
//  - Takım bilgisi, kadro: API-Football (/teams, /players/squads) — tarayıcıda 7 gün / 1 gün saklanır
//  - Bu sezonun maçları: ESPN takım takvimi (kota yok); takım ESPN'de adından bulunur
//  - Puan durumu: lig sayfasıyla aynı kaynak (leagueService)

const DAY = 24 * 60 * 60_000
const memory = new Map<string, Promise<unknown>>()

// Hafıza + localStorage önbelleği; hata saklanmaz
function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = memory.get(key)
  if (hit) return hit as Promise<T>
  const storageKey = `canliskor:team:${key}`
  const promise = (async () => {
    const stored = readStore<T>(storageKey, ttl, 'local')
    if (stored !== null) return stored
    const value = await load()
    if (value !== null) writeStore(storageKey, value, 'local')
    return value
  })()
  memory.set(key, promise)
  promise.catch(() => memory.delete(key))
  return promise
}

// ---------- Ham API tipleri ----------
interface ApiTeamItem {
  team: { id: number; name: string; country: string | null; founded: number | null; national: boolean; logo: string }
  venue: { name: string | null; city: string | null; capacity: number | null; image: string | null } | null
}

interface ApiSquad {
  players: { id: number; name: string; age: number | null; number: number | null; position: string; photo: string }[]
}

const mapTeam = ({ team, venue }: ApiTeamItem): TeamInfo => ({
  id: String(team.id),
  name: team.name,
  logo: team.logo,
  country: team.country ? (COUNTRY_TR[team.country] ?? team.country) : '',
  founded: team.founded,
  venue: venue?.name ? { name: venue.name, city: venue.city, capacity: venue.capacity, image: venue.image ?? undefined } : null,
})

const POSITIONS: Record<string, SquadPosition> = { Goalkeeper: 'G', Defender: 'D', Midfielder: 'M', Attacker: 'F' }

// ---------- Takım ----------
export function getTeam(id: string): Promise<TeamInfo | null> {
  return cached(`info:${id}`, 7 * DAY, async () => {
    const [item] = await apiGet<ApiTeamItem[]>(`/teams?id=${encodeURIComponent(id)}`)
    return item ? mapTeam(item) : null
  })
}

// Puan tablosu gibi başka kaynaktan gelen takım (sadece adı biliniyor): API-Football'da adından bul.
// regionTr verilirse aynı ülkedeki takım tercih edilir. Sonuç 30 gün saklanır.
export function findTeamByName(name: string, regionTr?: string): Promise<TeamInfo | null> {
  return cached(`byname:${name}:${regionTr ?? ''}`, 30 * DAY, async () => {
    // Arama sadece harf/rakam/boşluk kabul ediyor
    const term = name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ı/g, 'i')
      .replace(/[^a-zA-Z0-9 ]+/g, ' ')
      .trim()
    if (term.length < 3) return null
    const items = (await apiGet<ApiTeamItem[]>(`/teams?search=${encodeURIComponent(term)}`)).filter((i) => !i.team.national)
    // Arama kadın / alt yaş / yedek takımlarını da getiriyor ("Fenerbahce W", "Fenerbahce U19"): A takımı önce
    const isSenior = (t: TeamInfo) => !/\b(W|Women|U\d{2}|II|B)\b/i.test(t.name)
    const teams = items
      .map(mapTeam)
      .filter((t) => sameTeamName(t.name, name))
      .sort((a, b) => Number(isSenior(b)) - Number(isSenior(a)))
    return teams.find((t) => regionTr && t.country === regionTr) ?? teams[0] ?? null
  })
}

export function getSquad(teamId: string): Promise<SquadPlayer[] | null> {
  return cached(`squad:${teamId}`, DAY, async () => {
    const [squad] = await apiGet<ApiSquad[]>(`/players/squads?team=${encodeURIComponent(teamId)}`)
    if (!squad) return null
    return squad.players.map((p) => ({
      id: String(p.id),
      name: p.name,
      age: p.age,
      number: p.number,
      position: POSITIONS[p.position] ?? 'M',
      photo: p.photo,
    }))
  })
}

// ---------- Lig ve maçlar ----------

// Takımın ligi: adresle gelen lig (maçtan / tablodan açıldıysa), yoksa ülkesinin birinci ligi
export function teamLeagueId(team: TeamInfo, hint: string | null): string | null {
  if (hint && leagueSourceFor(hint)) return hint
  // LEAGUE_SOURCES anahtarları sayı: küçük id önce gelir; her ülkede birinci lig daha küçük id'li (39 < 40...)
  return Object.keys(LEAGUE_SOURCES).find((id) => LEAGUE_SOURCES[id].region === team.country) ?? null
}

// Bu sezonun lig maçları (ESPN). Takım ESPN'in o ligdeki takımları arasında adından bulunur.
export async function getTeamMatches(team: TeamInfo, leagueId: string): Promise<Match[] | null> {
  const source = leagueSourceFor(leagueId)
  const league = await getLeague(leagueId)
  if (!source || !league) return null
  const espnTeam = (await espn.getTeams(source.espn)).find((t) => sameTeamName(t.name, team.name))
  if (!espnTeam) return null
  const matches = await espn.getTeamSchedule(source.espn, espnTeam.id, league, league.currentSeason)
  // Maç sayfası bu maçları açabilsin diye
  registerMatches(matches)
  return matches
}

// Kadrodaki oyuncuların bu sezonki lig istatistikleri (ESPN). Oyuncular forma numarası + soyadıyla,
// numara tutmazsa yalnız soyadıyla (tek aday varsa) eşleştirilir; emin olunamayan oyuncuda istatistik gösterilmez.
export type SquadStats = espn.EspnRosterStats

const plainName = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s-]/g, ' ')
    .trim()
const surname = (s: string) => plainName(s).split(/\s+/).pop() ?? ''

export async function getSquadStats(team: TeamInfo, leagueId: string): Promise<SquadStats[] | null> {
  const source = leagueSourceFor(leagueId)
  if (!source) return null
  const espnTeam = (await espn.getTeams(source.espn)).find((t) => sameTeamName(t.name, team.name))
  if (!espnTeam) return null
  return espn.getRosterStats(source.espn, espnTeam.id)
}

export function findSquadStats(player: SquadPlayer, stats: SquadStats[]): SquadStats | null {
  const last = surname(player.name)
  const sameSurname = (s: SquadStats) => {
    const other = plainName(s.name)
    return surname(s.name) === last || other.split(/\s+/).includes(last)
  }
  const byNumber = player.number !== null ? stats.find((s) => s.jersey === player.number && sameSurname(s)) : undefined
  if (byNumber) return byNumber
  const bySurname = stats.filter(sameSurname)
  return bySurname.length === 1 ? bySurname[0] : null
}

// Sezon özeti: lig tablosundaki satırı (O / G / B / M, atılan / yenen gol)
export async function getTeamStats(team: TeamInfo, leagueId: string): Promise<TeamStatsSummary | null> {
  const standings = await getStandings(leagueId, currentSeasonFor())
  const row = standings?.groups.flatMap((g) => g.rows).find((r) => sameTeamName(r.team.name, team.name))
  if (!row) return null
  return { played: row.all.played, won: row.all.win, draw: row.all.draw, lost: row.all.lose, scored: row.all.goalsFor, conceded: row.all.goalsAgainst }
}
