import type { PlayerMatchStats } from '../../types/playerStats'
import { Ball, Card } from './EventIcon'

// Oyuncunun maçtaki gol, asist, kart ve değişiklik ikonları. Veri yoksa hiçbir şey çizmez.
export default function PlayerIcons({ stats }: { stats?: PlayerMatchStats }) {
  if (!stats) return null
  const { goals, assists, ownGoals, yellow, red, subIn, subOut } = stats
  if (!goals && !assists && !ownGoals && !yellow && !red && subIn === null && subOut === null) return null

  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: goals }, (_, i) => (
        <Ball key={`g${i}`} className="size-3 text-white" />
      ))}
      {Array.from({ length: ownGoals }, (_, i) => (
        <Ball key={`og${i}`} className="size-3 text-red-400" />
      ))}
      {assists > 0 && (
        <span title="Asist" className="rounded-sm bg-white/90 px-0.5 text-[8px] leading-3 font-black text-pitch-950">
          A{assists > 1 ? assists : ''}
        </span>
      )}
      {yellow > 0 && red === 0 && <Card color="yellow" />}
      {red > 0 && <Card color="red" />}
      {subIn !== null && (
        <span title={`${subIn}' oyuna girdi`} className="text-[9px] leading-3 font-bold text-accent">
          ▲{subIn}'
        </span>
      )}
      {subOut !== null && (
        <span title={`${subOut}' oyundan çıktı`} className="text-[9px] leading-3 font-bold text-red-400">
          ▼{subOut}'
        </span>
      )}
    </span>
  )
}
