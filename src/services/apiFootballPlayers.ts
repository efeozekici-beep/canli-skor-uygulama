import type { ApiFixturePlayersTeam } from '../types/playerStats'
import type { PlayerMatchStats } from '../types/playerStats'
import { normalizeRating } from '../lib/ratings'

// API-Football /fixtures/players yanıtını uygulamanın PlayerMatchStats tipine çevirir.
// Henüz kullanılmıyor; getPlayerStats API'ye bağlanınca buradan çağrılacak.

// "41" / 41 / null -> sayı ya da null
function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

// passes.accuracy bazı sürümlerde "%68", bazılarında isabetli pas SAYISI ("41") olarak gelir.
function passAccuracyPercent(accuracy: string | number | null, total: number | null): number | null {
  if (typeof accuracy === 'string' && accuracy.includes('%')) return toNumber(accuracy.replace('%', ''))
  const accurate = toNumber(accuracy)
  if (accurate === null || !total) return null
  return Math.round((accurate / total) * 100)
}

export function mapApiFixturePlayers(response: ApiFixturePlayersTeam[], homeTeamId: string): PlayerMatchStats[] {
  return response.flatMap(({ team, players }) =>
    players.map(({ player, statistics }) => {
      const s = statistics[0]
      const passes = toNumber(s?.passes.total)
      return {
        playerId: String(player.id),
        name: player.name,
        side: String(team.id) === homeTeamId ? 'home' : 'away',
        photo: player.photo,
        rating: normalizeRating(s?.games.rating),
        minutes: toNumber(s?.games.minutes),
        goals: s?.goals.total ?? 0,
        assists: s?.goals.assists ?? 0,
        ownGoals: 0, // Bu uç noktada yok; /fixtures/events'ten hesaplanır.
        shots: toNumber(s?.shots.total),
        shotsOnTarget: toNumber(s?.shots.on),
        passes,
        passAccuracy: passAccuracyPercent(s?.passes.accuracy ?? null, passes),
        duelsWon: toNumber(s?.duels.won),
        duelsTotal: toNumber(s?.duels.total),
        keyPasses: toNumber(s?.passes.key),
        tackles: toNumber(s?.tackles?.total),
        interceptions: toNumber(s?.tackles?.interceptions),
        dribbles: toNumber(s?.dribbles?.success),
        yellow: s?.cards.yellow ?? 0,
        red: s?.cards.red ?? 0,
        subIn: null, // Değişiklik dakikaları da olaylardan gelir.
        subOut: null,
      } satisfies PlayerMatchStats
    }),
  )
}
