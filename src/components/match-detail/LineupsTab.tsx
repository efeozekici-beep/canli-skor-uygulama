import { useState } from 'react'
import type { Match } from '../../types/match'
import type { LineupPlayer, Side, TeamLineup } from '../../types/matchDetail'
import type { PlayerMatchStats } from '../../types/playerStats'
import { getLineups, getPlayerStats } from '../../services/matchDetailService'
import { useDetailData } from '../../hooks/useDetailData'
import { ratingTone, teamAverageRating } from '../../lib/ratings'
import TeamLogo from '../TeamLogo'
import PlayerAvatar from '../common/PlayerAvatar'
import PitchView from './PitchView'
import PlayerPopover from './PlayerPopover'
import RatingBadge from './RatingBadge'
import PlayerIcons from './PlayerIcons'
import { EmptyState, ErrorState, LoadingState } from './TabStates'

interface Props {
  match: Match
  /** "Maçın Adamı" kartından gelindiyse vurgulanacak oyuncu */
  highlightedPlayerId: string | null
}

const POSITION_SHORT = { G: 'K', D: 'D', M: 'OS', F: 'F' }

// Bir takımın yedekleri (oynayanların reytingi görünür) ve teknik direktörü
function BenchList({ lineup, side, statsById, showRatings, highlightedId, showTeamName, onPlayerClick }: {
  lineup: TeamLineup
  side: Side
  statsById: Map<string, PlayerMatchStats>
  showRatings: boolean
  highlightedId: string | null
  showTeamName: boolean
  onPlayerClick: (player: LineupPlayer, side: Side) => void
}) {
  return (
    <section className="min-w-0 space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white/70">
        {showTeamName && <TeamLogo name={lineup.team.name} logo={lineup.team.logo} />}
        <span className="truncate">{showTeamName ? `${lineup.team.name} yedekleri` : 'Yedekler'}</span>
      </h3>
      <ul className="divide-y divide-white/5 rounded-xl bg-white/[0.03]">
        {lineup.substitutes.map((p) => {
          const stats = statsById.get(p.id)
          const isHighlighted = p.id === highlightedId
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPlayerClick(p, side)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.04] ${isHighlighted ? 'bg-amber-400/10' : ''}`}
              >
                <span className="w-6 text-center text-sm font-bold text-white/60 tabular-nums">{p.number}</span>
                <PlayerAvatar photo={p.photo} name={p.name} size="base" />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${isHighlighted ? 'text-amber-300' : ''}`}>{p.name}</span>
                  <span className="flex items-center gap-2 text-xs text-white/45">
                    {POSITION_SHORT[p.position]}
                    <PlayerIcons stats={stats} />
                  </span>
                </span>
                <span className="w-8 text-right">{showRatings && stats?.rating != null && <RatingBadge rating={stats.rating} />}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
        <PlayerAvatar photo={lineup.coachPhoto} name={lineup.coach} size="base" />
        <p className="min-w-0 text-sm">
          <span className="block text-xs text-white/50">Teknik direktör</span>
          <span className="block truncate font-semibold">{lineup.coach}</span>
        </p>
      </div>
    </section>
  )
}

type View = 'both' | Side

export default function LineupsTab({ match, highlightedPlayerId }: Props) {
  const lineups = useDetailData(`lineups:${match.id}`, () => getLineups(match.id))
  const players = useDetailData(match.status === 'upcoming' ? null : `players:${match.id}`, () => getPlayerStats(match.id))
  // İlk açılışta iki takım birlikte; kullanıcı üstten tek takım seçebilir
  const [view, setView] = useState<View>('both')
  const [popover, setPopover] = useState<{ player: LineupPlayer; side: Side } | null>(null)

  if (lineups.loading) return <LoadingState rows={6} />
  if (lineups.error) return <ErrorState message={lineups.error} />
  if (!lineups.data) return <EmptyState message="Bu maç için kadro verisi yok." />
  const data = lineups.data
  const sides: Side[] = view === 'both' ? ['home', 'away'] : [view]

  // Oyuncu istatistiklerini id ile hızlı bulmak için
  const statsById = new Map((players.data ?? []).map((p) => [p.playerId, p]))
  const showRatings = (players.data ?? []).some((p) => p.rating !== null)
  const average = (s: Side) => teamAverageRating((players.data ?? []).filter((p) => p.side === s))
  const openPlayer = (player: LineupPlayer, side: Side) => setPopover({ player, side })
  const tabClass = (active: boolean) =>
    `flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors duration-150 ${
      active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
    }`

  return (
    <div className="space-y-4 p-4">
      {/* Görünüm seçici: iki takım ya da tek takım (adın yanında takım ortalama reytingi) */}
      <div role="tablist" aria-label="Kadro görünümü" className="grid grid-cols-[auto_1fr_1fr] gap-1 rounded-full bg-black/30 p-1">
        <button type="button" role="tab" aria-selected={view === 'both'} onClick={() => setView('both')} className={tabClass(view === 'both')}>
          İki takım
        </button>
        {(['home', 'away'] as const).map((s) => {
          const avg = showRatings ? average(s) : null
          return (
            <button key={s} type="button" role="tab" aria-selected={view === s} onClick={() => setView(s)} className={tabClass(view === s)}>
              <TeamLogo name={data[s].team.name} logo={s === 'home' ? match.homeLogo : match.awayLogo} />
              <span className="hidden truncate sm:inline">{data[s].team.name}</span>
              {avg !== null && <span className={`rounded px-1 text-xs font-bold tabular-nums ${ratingTone(avg)}`}>{avg.toFixed(2)}</span>}
            </button>
          )
        })}
      </div>

      {view !== 'both' && (
        <p className="text-center text-sm text-white/60">
          Diziliş <span className="font-semibold text-white">{data[view].formation}</span>
        </p>
      )}

      <PitchView
        teams={sides.map((side) => ({ lineup: data[side], side }))}
        statsById={statsById}
        showRatings={showRatings}
        highlightedId={highlightedPlayerId}
        onPlayerClick={openPlayer}
      />

      {/* Yedekler ve teknik direktör: iki takımda geniş ekranda yan yana */}
      <div className={view === 'both' ? 'grid gap-4 sm:grid-cols-2' : ''}>
        {sides.map((side) => (
          <BenchList
            key={side}
            lineup={data[side]}
            side={side}
            statsById={statsById}
            showRatings={showRatings}
            highlightedId={highlightedPlayerId}
            showTeamName={view === 'both'}
            onPlayerClick={openPlayer}
          />
        ))}
      </div>

      {popover && (
        <PlayerPopover
          player={popover.player}
          stats={statsById.get(popover.player.id)}
          teamName={data[popover.side].team.name}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  )
}
