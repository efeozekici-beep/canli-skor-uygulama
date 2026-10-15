import { useState } from 'react'
import type { PlayerStatEntry } from '../../types/league'
import { denseRanks } from '../../lib/league'
import TeamLogo from '../TeamLogo'
import PlayerAvatar from '../common/PlayerAvatar'

interface Props {
  players: PlayerStatEntry[]
  /** Sağdaki sayının başlığı: Gol, Asist, Sarı kart... */
  valueLabel: string
}

// Sıralı oyuncu listesi: ilk 10, "Daha fazla göster" ile 20. Eşit sayılar aynı sırayı alır.
export default function PlayerStatList({ players, valueLabel }: Props) {
  const [expanded, setExpanded] = useState(false)
  const list = players.slice(0, 20)
  const ranks = denseRanks(list.map((p) => p.value))
  const visible = expanded ? list : list.slice(0, 10)

  return (
    <div>
      <div className="flex items-center justify-between px-3 pb-2 text-xs text-white/45">
        <span>Oyuncu</span>
        <span>{valueLabel}</span>
      </div>
      <ol className="divide-y divide-white/5 rounded-xl bg-white/[0.03]">
        {visible.map((player, i) => (
          <li key={player.playerId} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-6 text-center font-semibold text-white/70 tabular-nums">{ranks[i]}</span>
            <PlayerAvatar name={player.name} photo={player.photo} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{player.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-white/55">
                <TeamLogo name={player.team.name} logo={player.team.logo} />
                <span className="truncate">{player.team.name}</span>
              </span>
            </span>
            <span className="text-lg font-bold tabular-nums">{player.value}</span>
          </li>
        ))}
      </ol>
      {!expanded && list.length > 10 && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full bg-white/5 px-5 py-2 text-sm font-semibold ring-1 ring-white/10 ring-inset transition-colors duration-150 hover:bg-white/10"
          >
            Daha fazla göster
          </button>
        </div>
      )}
    </div>
  )
}
