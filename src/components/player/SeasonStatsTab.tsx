import { useState } from 'react'
import type { PlayerLeagueStats } from '../../types/player'
import { getPlayerSeasonStats, getPlayerSeasons } from '../../services/playerService'
import { useDetailData } from '../../hooks/useDetailData'
import { seasonLabel } from '../../lib/league'
import TeamLogo from '../TeamLogo'
import RatingBadge from '../match-detail/RatingBadge'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'

const NO_DATA = 'Bu oyuncu için veri bulunmuyor.'

// Bir ligdeki istatistik kartı: sadece değeri olan alanlar gösterilir
function LeagueStatsCard({ stats }: { stats: PlayerLeagueStats }) {
  const duels = stats.duelsTotal ? `${stats.duelsWon ?? 0}/${stats.duelsTotal}` : null
  const tiles: [string, string | number | null][] = [
    ['Maç', stats.appearances],
    ['İlk 11', stats.lineups],
    ['Dakika', stats.minutes],
    ['Gol', stats.goals],
    ['Asist', stats.assists],
    ['Sarı kart', stats.yellow],
    ['Kırmızı kart', stats.red],
    ['Pas', stats.passes],
    ['Şut', stats.shots],
    ['İsabetli şut', stats.shotsOnTarget],
    ['İkili mücadele', duels],
  ]
  const shown = tiles.filter((t): t is [string, string | number] => t[1] !== null)

  return (
    <section className="rounded-xl bg-white/[0.03] p-4">
      <header className="mb-3 flex items-center gap-3">
        <TeamLogo name={stats.league.name} logo={stats.league.logo} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{stats.league.name}</h3>
          <p className="flex items-center gap-1.5 truncate text-xs text-white/55">
            <TeamLogo name={stats.team.name} logo={stats.team.logo} />
            {stats.team.name}
          </p>
        </div>
        {stats.rating !== null && (
          <span className="flex items-center gap-2 text-xs text-white/55">
            Ort. reyting
            <RatingBadge rating={stats.rating} size="md" />
          </span>
        )}
      </header>
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {shown.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white/5 px-3 py-2">
            <dt className="text-xs text-white/50">{label}</dt>
            <dd className="text-lg font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// Genel sekmesi: sezon seçici + o sezonun lig bazında istatistikleri
export default function SeasonStatsTab({ playerId }: { playerId: string }) {
  const seasons = useDetailData(`seasons:${playerId}`, () => getPlayerSeasons(playerId))
  const [chosen, setChosen] = useState<number | null>(null)
  // Varsayılan: oynadığı en yeni (güncel) sezon
  const season = chosen ?? seasons.data?.[0] ?? null
  const stats = useDetailData(season !== null ? `stats:${playerId}:${season}` : null, () => getPlayerSeasonStats(playerId, season ?? 0))

  if (seasons.loading) return <LoadingState rows={6} />
  if (seasons.error) return <ErrorState message={seasons.error} />
  if (!seasons.data || seasons.data.length === 0 || season === null) return <EmptyState message={NO_DATA} />

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <label className="flex items-center justify-end gap-2 text-sm text-white/60">
        Sezon
        <select
          value={season}
          onChange={(e) => setChosen(Number(e.target.value))}
          className="min-h-10 rounded-full border border-white/15 bg-black/30 px-3 font-semibold text-white"
        >
          {seasons.data.map((s) => (
            <option key={s} value={s} className="bg-pitch-950">
              {seasonLabel(s)}
            </option>
          ))}
        </select>
      </label>

      {stats.loading ? (
        <LoadingState rows={6} />
      ) : stats.error ? (
        <ErrorState message={stats.error} />
      ) : !stats.data || stats.data.leagues.length === 0 ? (
        <EmptyState message={NO_DATA} />
      ) : (
        stats.data.leagues.map((l) => <LeagueStatsCard key={`${l.league.id}-${l.team.id}`} stats={l} />)
      )}
    </div>
  )
}
