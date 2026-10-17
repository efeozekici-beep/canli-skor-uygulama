import { useState } from 'react'
import type { Match } from '../../types/match'
import type { LineupPlayer, Side } from '../../types/matchDetail'
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

export default function LineupsTab({ match, highlightedPlayerId }: Props) {
  const lineups = useDetailData(`lineups:${match.id}`, () => getLineups(match.id))
  const players = useDetailData(match.status === 'upcoming' ? null : `players:${match.id}`, () => getPlayerStats(match.id))
  const [chosenSide, setChosenSide] = useState<Side | null>(null)
  const [popover, setPopover] = useState<{ player: LineupPlayer; side: Side } | null>(null)

  if (lineups.loading) return <LoadingState rows={6} />
  if (lineups.error) return <ErrorState message={lineups.error} />
  if (!lineups.data) return <EmptyState message="Bu maç için kadro verisi yok." />
  const data = lineups.data

  // Vurgulanan oyuncu hangi takımdaysa o takımla aç
  const highlightSide: Side | null = highlightedPlayerId
    ? (['home', 'away'] as const).find((s) => [...data[s].startXI, ...data[s].substitutes].some((p) => p.id === highlightedPlayerId)) ?? null
    : null
  const side = chosenSide ?? highlightSide ?? 'home'
  const lineup = data[side]

  // Oyuncu istatistiklerini id ile hızlı bulmak için
  const statsById = new Map((players.data ?? []).map((p) => [p.playerId, p]))
  const showRatings = (players.data ?? []).some((p) => p.rating !== null)
  const average = (s: Side) => teamAverageRating((players.data ?? []).filter((p) => p.side === s))

  return (
    <div className="space-y-4 p-4">
      {/* Takım seçici: adın yanında takım ortalama reytingi */}
      <div role="tablist" aria-label="Takım" className="grid grid-cols-2 gap-1 rounded-full bg-black/30 p-1">
        {(['home', 'away'] as const).map((s) => {
          const avg = showRatings ? average(s) : null
          const active = s === side
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setChosenSide(s)}
              className={`flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors duration-150 ${
                active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <TeamLogo name={data[s].team.name} logo={s === 'home' ? match.homeLogo : match.awayLogo} />
              <span className="truncate">{data[s].team.name}</span>
              {avg !== null && <span className={`rounded px-1 text-xs font-bold tabular-nums ${ratingTone(avg)}`}>{avg.toFixed(2)}</span>}
            </button>
          )
        })}
      </div>

      <p className="text-center text-sm text-white/60">
        Diziliş <span className="font-semibold text-white">{lineup.formation}</span>
      </p>

      <PitchView
        lineup={lineup}
        statsById={statsById}
        showRatings={showRatings}
        highlightedId={highlightedPlayerId}
        onPlayerClick={(player) => setPopover({ player, side })}
      />

      {/* Yedekler: oynayanların reytingi görünür, oynamayanlarda boş */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-white/70">Yedekler</h3>
        <ul className="divide-y divide-white/5 rounded-xl bg-white/[0.03]">
          {lineup.substitutes.map((p) => {
            const stats = statsById.get(p.id)
            const isHighlighted = p.id === highlightedPlayerId
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPopover({ player: p, side })}
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
      </section>

      <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
        <PlayerAvatar photo={lineup.coachPhoto} name={lineup.coach} size="base" />
        <p className="min-w-0 text-sm">
          <span className="block text-xs text-white/50">Teknik direktör</span>
          <span className="block truncate font-semibold">{lineup.coach}</span>
        </p>
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
