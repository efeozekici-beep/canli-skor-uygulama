import type { PlayerMatchStats } from '../../types/playerStats'
import RatingBadge from './RatingBadge'
import PlayerIcons from './PlayerIcons'
import PlayerAvatar from '../common/PlayerAvatar'

interface Props {
  player: PlayerMatchStats
  teamName: string
  /** Canlı maçta "Şu anki en iyi oyuncu" yazar. */
  live: boolean
  onClick: () => void
}

// Maçın adamı kartı; tıklayınca Kadrolar sekmesinde oyuncuyu gösterir.
export default function ManOfTheMatchCard({ player, teamName, live, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-amber-400/25 bg-gradient-to-r from-amber-400/15 to-transparent p-3 text-left transition-[background-color,transform] duration-150 ease-out hover:from-amber-400/20 active:scale-[0.99]"
    >
      <PlayerAvatar photo={player.photo} name={player.name} size="lg" className="ring-2 ring-amber-400" />
      <span className="min-w-0 flex-1">
        <span className="inline-block rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-pitch-950 uppercase">
          {live ? 'Şu anki en iyi oyuncu' : 'Maçın Adamı'}
        </span>
        <span className="mt-1 block truncate font-semibold">{player.name}</span>
        <span className="flex items-center gap-2 text-xs text-white/60">
          {teamName}
          <PlayerIcons stats={player} />
        </span>
      </span>
      {player.rating !== null && <RatingBadge rating={player.rating} size="md" />}
    </button>
  )
}
