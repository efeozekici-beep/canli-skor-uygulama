import type { LineupPlayer, Lineups, MatchEvent, MatchEventKind, PlayerPosition, Side, StatItem, TeamLineup } from '../types/matchDetail'
import type { PlayerMatchStats } from '../types/playerStats'
import { teamIdOf } from '../lib/team'

// ---------- Yardımcılar: kısa tanımlardan tam veri üretir ----------

type XI = [number, string][] // İlk 11: kaleci, defans, orta saha, forvet sırasıyla
type Bench = [number, string, PlayerPosition][]

// Dizilişe göre (4-3-3) her oyuncuya "satır:sütun" grid değeri verir, API-Football ile aynı biçim.
function team(name: string, formation: string, coach: string, xi: XI, bench: Bench): TeamLineup {
  const teamId = teamIdOf(name)
  const rows = [1, ...formation.split('-').map(Number)]
  const startXI: LineupPlayer[] = []
  let i = 0
  rows.forEach((count, r) => {
    for (let c = 1; c <= count; c++) {
      const [number, playerName] = xi[i++]
      const position: PlayerPosition = r === 0 ? 'G' : r === 1 ? 'D' : r === rows.length - 1 ? 'F' : 'M'
      startXI.push({ id: `${teamId}-${number}`, name: playerName, number, position, grid: `${r + 1}:${c}` })
    }
  })
  const substitutes = bench.map(([number, playerName, position]) => ({
    id: `${teamId}-${number}`,
    name: playerName,
    number,
    position,
    grid: null,
  }))
  return { team: { id: teamId, name }, formation, coach, startXI, substitutes }
}

// Kısa olay tanımı: [dakika, taraf, tür, oyuncu, ikinci oyuncu?, uzatma?]
type E = [number, Side, MatchEventKind, string, string?, number?]
const events = (list: E[]): MatchEvent[] =>
  list.map(([minute, side, kind, player, secondPlayer, extra], i) => ({
    id: `e${i}`,
    minute,
    extra: extra ?? null,
    side,
    kind,
    player,
    secondPlayer,
  }))

// İsimden sabit sayı: her yenilemede aynı "rastgele" istatistikler çıksın diye.
function seed(text: string) {
  let h = 7
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

// Oyuncu istatistiklerini olaylardan türetir (gol, asist, kart, değişiklik dakikaları tutarlı olsun).
function playerStats(lineups: Lineups, list: MatchEvent[], elapsed: number): PlayerMatchStats[] {
  const result: PlayerMatchStats[] = []
  for (const side of ['home', 'away'] as const) {
    const { startXI, substitutes } = lineups[side]
    for (const p of [...startXI, ...substitutes]) {
      const isStarter = startXI.includes(p)
      const subIn = list.find((e) => e.kind === 'sub' && e.player === p.name)?.minute ?? null
      const subOut = list.find((e) => e.kind === 'sub' && e.secondPlayer === p.name)?.minute ?? null
      const redAt = list.find((e) => (e.kind === 'red' || e.kind === 'second-yellow') && e.player === p.name)?.minute ?? null
      const played = isStarter || subIn !== null
      const count = (kinds: MatchEventKind[], field: 'player' | 'secondPlayer' = 'player') =>
        list.filter((e) => kinds.includes(e.kind) && e[field] === p.name).length

      const goals = count(['goal', 'penalty'])
      const assists = count(['goal'], 'secondPlayer')
      const ownGoals = count(['own-goal'])
      const yellow = count(['yellow', 'second-yellow'])
      const red = redAt !== null ? 1 : 0

      if (!played) {
        result.push({
          playerId: p.id, name: p.name, side, rating: null, minutes: null, goals: 0, assists: 0, ownGoals: 0,
          shots: null, shotsOnTarget: null, passes: null, passAccuracy: null, duelsWon: null, duelsTotal: null,
          yellow: 0, red: 0, subIn: null, subOut: null,
        })
        continue
      }

      const minutes = Math.max(1, (subOut ?? redAt ?? elapsed) - (subIn ?? 0))
      const share = minutes / 90
      const h = seed(p.name)
      const shotsBase = { G: 0, D: h % 2, M: h % 3, F: 1 + (h % 4) }[p.position]
      const shots = shotsBase + goals
      const passesBase = { G: 22 + (h % 12), D: 45 + (h % 30), M: 40 + (h % 35), F: 16 + (h % 14) }[p.position]
      const duelsTotal = Math.round((4 + (h % 9)) * share) || 1

      let rating = 6.3 + (h % 13) / 10 + goals * 0.9 + assists * 0.6 - yellow * 0.2 - red * 1.5 - ownGoals * 1
      if (minutes < 20) rating = Math.min(rating, 6.8)
      rating = Math.round(Math.min(9.9, Math.max(4.5, rating)) * 10) / 10

      result.push({
        playerId: p.id,
        name: p.name,
        side,
        rating,
        minutes,
        goals,
        assists,
        ownGoals,
        shots,
        shotsOnTarget: Math.min(shots, goals + (h % 2)),
        passes: Math.round(passesBase * share),
        passAccuracy: 68 + (h % 26),
        duelsWon: Math.round(duelsTotal * (0.35 + (h % 5) / 10)),
        duelsTotal,
        yellow,
        red,
        subIn,
        subOut,
      })
    }
  }
  return result
}

// İstatistik listesi: [topla oynama, şut, isabetli şut, korner, faul, ofsayt, pas] + kartlar olaylardan
function stats(values: [number, number][], list: MatchEvent[]): StatItem[] {
  const cards = (side: Side, kinds: MatchEventKind[]) => list.filter((e) => e.side === side && kinds.includes(e.kind)).length
  const labels: [string, string, '%'?][] = [
    ['possession', 'Topla oynama', '%'],
    ['shots', 'Toplam şut'],
    ['shotsOnTarget', 'İsabetli şut'],
    ['corners', 'Korner'],
    ['fouls', 'Faul'],
    ['offsides', 'Ofsayt'],
    ['passes', 'Pas'],
  ]
  const items: StatItem[] = labels.map(([key, label, unit], i) => ({ key, label, unit, home: values[i][0], away: values[i][1] }))
  items.push(
    { key: 'yellow', label: 'Sarı kart', home: cards('home', ['yellow', 'second-yellow']), away: cards('away', ['yellow', 'second-yellow']) },
    { key: 'red', label: 'Kırmızı kart', home: cards('home', ['red', 'second-yellow']), away: cards('away', ['red', 'second-yellow']) },
  )
  return items
}

// ---------- Maç 1: Feyenoord 2-1 Como (canlı 61') ----------
const feyenoordComoLineups: Lineups = {
  home: team('Feyenoord', '4-3-3', 'Brian Priske',
    [[1, 'Justin Bijlow'], [2, 'Bart Nieuwkoop'], [18, 'Gernot Trauner'], [33, 'David Hancko'], [5, 'Quilindschy Hartman'],
     [8, 'Quinten Timber'], [6, 'Hwang In-beom'], [10, 'Calvin Stengs'], [14, 'Igor Paixão'], [9, 'Santiago Giménez'], [11, 'Anis Hadj Moussa']],
    [[22, 'Timon Wellenreuther', 'G'], [4, 'Thomas Beelen', 'D'], [23, 'Ramiz Zerrouki', 'M'], [17, 'Luka Ivanušec', 'M'], [19, 'Julián Carranza', 'F'], [7, 'Ayase Ueda', 'F']]),
  away: team('Como', '4-2-3-1', 'Cesc Fàbregas',
    [[1, 'Jean Butez'], [28, 'Ignace Van der Brempt'], [34, 'Marc-Oliver Kempf'], [5, 'Edoardo Goldaniga'], [18, 'Alberto Moreno'],
     [23, 'Maximo Perrone'], [33, 'Lucas Da Cunha'], [7, 'Gabriel Strefezza'], [10, 'Nico Paz'], [11, 'Assane Diao'], [9, 'Patrick Cutrone']],
    [[22, 'Pepe Reina', 'G'], [3, 'Alessio Iovine', 'D'], [8, 'Sergi Roberto', 'M'], [14, 'Yannik Engelhardt', 'M'], [17, 'Alieu Fadera', 'F'], [19, 'Andrea Belotti', 'F']]),
}
const feyenoordComoEvents = events([
  [18, 'away', 'goal', 'Assane Diao', 'Nico Paz'],
  [23, 'home', 'goal', 'Santiago Giménez', 'Igor Paixão'],
  [38, 'away', 'yellow', 'Maximo Perrone'],
  [52, 'home', 'goal', 'Anis Hadj Moussa', 'Quinten Timber'],
  [58, 'away', 'sub', 'Andrea Belotti', 'Patrick Cutrone'],
  [60, 'home', 'yellow', 'Gernot Trauner'],
])

// ---------- Maç 2: LASK 1-4 Liverpool (canlı 66') ----------
const laskLiverpoolLineups: Lineups = {
  home: team('LASK', '3-4-3', 'Thomas Darazs',
    [[1, 'Tobias Lawal'], [4, 'Philipp Ziereis'], [6, 'Andrés Andrade'], [2, 'Maksym Talovierov'],
     [22, 'George Bello'], [8, 'Sascha Horvath'], [18, 'Branko Jovičić'], [24, 'Florian Flecker'],
     [7, 'Marin Ljubičić'], [9, 'Moses Usor'], [11, 'Elias Havel']],
    [[31, 'Lukas Jungwirth', 'G'], [15, 'Felix Luckeneder', 'D'], [10, 'Robert Žulj', 'M'], [19, 'Valon Berisha', 'M'], [30, 'Moussa Koné', 'F']]),
  away: team('Liverpool', '4-3-3', 'Arne Slot',
    [[1, 'Alisson'], [66, 'Trent Alexander-Arnold'], [5, 'Ibrahima Konaté'], [4, 'Virgil van Dijk'], [26, 'Andrew Robertson'],
     [8, 'Dominik Szoboszlai'], [38, 'Ryan Gravenberch'], [10, 'Alexis Mac Allister'], [11, 'Mohamed Salah'], [20, 'Diogo Jota'], [18, 'Cody Gakpo']],
    [[62, 'Caoimhín Kelleher', 'G'], [78, 'Jarell Quansah', 'D'], [17, 'Curtis Jones', 'M'], [7, 'Luis Díaz', 'F'], [9, 'Darwin Núñez', 'F']]),
}
const laskLiverpoolEvents = events([
  [9, 'away', 'goal', 'Mohamed Salah', 'Trent Alexander-Arnold'],
  [27, 'home', 'goal', 'Marin Ljubičić', 'Sascha Horvath'],
  [34, 'away', 'goal', 'Cody Gakpo', 'Dominik Szoboszlai'],
  [45, 'away', 'penalty', 'Mohamed Salah', undefined, 2],
  [51, 'home', 'yellow', 'Andrés Andrade'],
  [56, 'away', 'goal', 'Dominik Szoboszlai', 'Alexis Mac Allister'],
  [60, 'away', 'sub', 'Luis Díaz', 'Diogo Jota'],
  [63, 'home', 'sub', 'Valon Berisha', 'Branko Jovičić'],
])

// ---------- Maç 3: Samsunspor 3-1 Kasımpaşa (bitti) ----------
const samsunKasimpasaLineups: Lineups = {
  home: team('Samsunspor', '4-2-3-1', 'Thomas Reis',
    [[1, 'Okan Kocuk'], [2, 'Zeki Yavru'], [4, 'Rick van Drongelen'], [3, 'Lubomír Šatka'], [18, 'Soner Gönül'],
     [6, 'Olivier Ntcham'], [8, 'Celil Yüksel'], [7, 'Carlo Holse'], [10, 'Emre Kılınç'], [11, 'Anthony Musaba'], [9, 'Marius Mouandilmadji']],
    [[25, 'Albert Posiadała', 'G'], [5, 'Joe Mendes', 'D'], [14, 'Yunus Emre Çift', 'M'], [17, 'Polat Yaldır', 'F'], [19, 'Tanguy Coulibaly', 'F']]),
  away: team('Kasımpaşa', '4-4-2', 'Şenol Can',
    [[1, 'Andreas Gianniotis'], [77, 'Cláudio Winck'], [4, 'Attila Szalai'], [25, 'Kenneth Omeruo'], [3, 'Godfried Frimpong'],
     [7, 'Mortadha Ben Ouanes'], [8, 'Cafú'], [6, 'Andri Baldursson'], [11, 'Yusuf Barası'], [9, 'Mamadou Fall'], [10, 'Haris Hajradinović']],
    [[99, 'Erdem Canpolat', 'G'], [5, 'Nicholas Opoku', 'D'], [14, 'Fousseni Diabaté', 'M'], [19, 'Emre Taşdemir', 'D'], [17, 'Florent Hadergjonaj', 'D']]),
}
const samsunKasimpasaEvents = events([
  [12, 'home', 'goal', 'Anthony Musaba', 'Carlo Holse'],
  [31, 'away', 'yellow', 'Cafú'],
  [40, 'away', 'goal', 'Mamadou Fall', 'Mortadha Ben Ouanes'],
  [55, 'home', 'penalty', 'Marius Mouandilmadji'],
  [63, 'home', 'sub', 'Polat Yaldır', 'Emre Kılınç'],
  [70, 'away', 'sub', 'Fousseni Diabaté', 'Andri Baldursson'],
  [78, 'home', 'own-goal', 'Kenneth Omeruo'],
  [84, 'away', 'red', 'Attila Szalai'],
  [88, 'home', 'sub', 'Tanguy Coulibaly', 'Anthony Musaba'],
])

// ---------- Maç 4: Roma - Real Madrid (başlamadı; sadece muhtemel kadro, reyting yok) ----------
const romaRealLineups: Lineups = {
  home: team('Roma', '3-5-2', 'Ivan Jurić',
    [[99, 'Mile Svilar'], [23, 'Gianluca Mancini'], [5, 'Evan Ndicka'], [3, 'Mario Hermoso'],
     [2, 'Zeki Çelik'], [16, 'Leandro Paredes'], [17, 'Manu Koné'], [7, 'Lorenzo Pellegrini'], [12, 'Angeliño'],
     [21, 'Paulo Dybala'], [11, 'Artem Dovbyk']],
    [[98, 'Mathew Ryan', 'G'], [87, 'Daniele Ghilardi', 'D'], [4, 'Bryan Cristante', 'M'], [61, 'Niccolò Pisilli', 'M'], [14, 'Eldor Shomurodov', 'F']]),
  away: team('Real Madrid', '4-3-3', 'Carlo Ancelotti',
    [[1, 'Thibaut Courtois'], [2, 'Dani Carvajal'], [3, 'Éder Militão'], [22, 'Antonio Rüdiger'], [23, 'Ferland Mendy'],
     [8, 'Federico Valverde'], [14, 'Aurélien Tchouaméni'], [5, 'Jude Bellingham'], [11, 'Rodrygo'], [9, 'Kylian Mbappé'], [7, 'Vinícius Júnior']],
    [[13, 'Andriy Lunin', 'G'], [4, 'David Alaba', 'D'], [10, 'Luka Modrić', 'M'], [15, 'Arda Güler', 'M'], [16, 'Endrick', 'F']]),
}

// ---------- Dışa aktarılan mock kayıtlar (anahtar: maç id) ----------
export interface MockDetail {
  round?: string
  venue?: string
  referee?: string
  events?: MatchEvent[]
  lineups?: Lineups
  statistics?: StatItem[]
  players?: PlayerMatchStats[]
}

export const MOCK_DETAILS: Record<string, MockDetail> = {
  'ucl-1': {
    round: 'Lig Aşaması · 2. Hafta',
    venue: 'De Kuip, Rotterdam',
    referee: 'Szymon Marciniak',
    events: feyenoordComoEvents,
    lineups: feyenoordComoLineups,
    statistics: stats([[52, 48], [9, 7], [4, 3], [5, 2], [8, 11], [1, 3], [298, 276]], feyenoordComoEvents),
    players: playerStats(feyenoordComoLineups, feyenoordComoEvents, 61),
  },
  'ucl-2': {
    round: 'Lig Aşaması · 2. Hafta',
    venue: 'Raiffeisen Arena, Linz',
    referee: 'Daniele Orsato',
    events: laskLiverpoolEvents,
    lineups: laskLiverpoolLineups,
    statistics: stats([[34, 66], [6, 17], [2, 9], [2, 7], [12, 6], [2, 1], [212, 431]], laskLiverpoolEvents),
    players: playerStats(laskLiverpoolLineups, laskLiverpoolEvents, 66),
  },
  'tsl-2': {
    round: '9. Hafta',
    venue: 'Samsun 19 Mayıs Stadyumu',
    referee: 'Arda Kardeşler',
    events: samsunKasimpasaEvents,
    lineups: samsunKasimpasaLineups,
    statistics: stats([[57, 43], [16, 8], [7, 3], [6, 3], [10, 14], [2, 2], [468, 352]], samsunKasimpasaEvents),
    players: playerStats(samsunKasimpasaLineups, samsunKasimpasaEvents, 90),
  },
  'ucl-3': {
    round: 'Lig Aşaması · 2. Hafta',
    venue: 'Stadio Olimpico, Roma',
    events: [],
    lineups: romaRealLineups,
  },
}
