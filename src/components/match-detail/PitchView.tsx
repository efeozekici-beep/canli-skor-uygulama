import { useEffect, useRef } from 'react'
import type { LineupPlayer, TeamLineup } from '../../types/matchDetail'
import type { PlayerMatchStats } from '../../types/playerStats'
import { shortName, teamColor } from '../../lib/team'
import RatingBadge from './RatingBadge'
import PlayerIcons from './PlayerIcons'
import PlayerAvatar from '../common/PlayerAvatar'

interface Props {
  lineup: TeamLineup
  statsById: Map<string, PlayerMatchStats>
  showRatings: boolean
  highlightedId: string | null
  onPlayerClick: (player: LineupPlayer) => void
}

// Her oyuncunun sahadaki yerini (yüzde olarak) hesaplar.
// grid "satır:sütun" ise onu kullanır, yoksa dizilişe göre sırayla dağıtır.
function placePlayers(lineup: TeamLineup) {
  // grid yoksa kullanılacak yerler: 4-3-3 -> [1:1] [2:1..2:4] [3:1..3:3] [4:1..4:3]
  const fallback: { row: number; col: number }[] = []
  ;[1, ...lineup.formation.split('-').map(Number)].forEach((count, r) => {
    for (let c = 1; c <= count; c++) fallback.push({ row: r + 1, col: c })
  })

  const cells = lineup.startXI.map((player, i) => {
    if (player.grid) {
      const [row, col] = player.grid.split(':').map(Number)
      return { player, row, col }
    }
    return { player, ...(fallback[i] ?? { row: 1, col: 1 }) }
  })

  const rowCount = Math.max(...cells.map((c) => c.row))
  const perRow = new Map<number, number>()
  cells.forEach((c) => perRow.set(c.row, Math.max(perRow.get(c.row) ?? 0, c.col)))

  return cells.map((c) => ({
    player: c.player,
    x: (c.col / ((perRow.get(c.row) ?? 1) + 1)) * 100,
    // Kaleci altta (%7), forvetler üstte (%87)
    y: rowCount > 1 ? 7 + ((c.row - 1) * 80) / (rowCount - 1) : 50,
  }))
}

export default function PitchView({ lineup, statsById, showRatings, highlightedId, onPlayerClick }: Props) {
  const highlightedRef = useRef<HTMLButtonElement>(null)

  // Vurgulanan oyuncuyu ortaya getir. scrollIntoView tüm sayfayı da kaydırdığı için
  // sadece en yakın kaydırılabilir kutuyu (masaüstünde panel) kaydırıyoruz.
  // Aynı oyuncu için sadece bir kez kaydır (geliştirme modunda effect'ler iki kez çalışır,
  // iki yumuşak kaydırma üst üste binip paneli ileri geri oynatıyordu).
  const scrolledFor = useRef<string | null>(null)
  useEffect(() => {
    const el = highlightedRef.current
    if (!el || scrolledFor.current === highlightedId) return
    scrolledFor.current = highlightedId
    let container = el.parentElement
    while (container && !(container.scrollHeight > container.clientHeight && /auto|scroll/.test(getComputedStyle(container).overflowY))) {
      container = container.parentElement
    }
    const box = container?.getBoundingClientRect() ?? { top: 0, height: window.innerHeight }
    const target = el.getBoundingClientRect()
    const offset = target.top - box.top - box.height / 2 + target.height / 2
    ;(container ?? window).scrollBy({ top: offset, behavior: 'smooth' })
  }, [highlightedId])

  const line = 'absolute border-2 border-white/35'

  return (
    <div className="relative mx-auto aspect-[68/96] w-full max-w-md overflow-hidden rounded-xl bg-[#1b6334] bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.05)_0_10%,transparent_10%_20%)]">
      {/* Saha çizgileri */}
      <div className={`${line} inset-[3%] rounded-sm`} />
      <div className="absolute inset-x-[3%] top-1/2 border-t-2 border-white/35" />
      <div className={`${line} top-1/2 left-1/2 aspect-square w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full`} />
      <div className={`${line} top-[3%] left-1/2 h-[15%] w-[58%] -translate-x-1/2 border-t-0`} />
      <div className={`${line} top-[3%] left-1/2 h-[6%] w-[26%] -translate-x-1/2 border-t-0`} />
      <div className={`${line} bottom-[3%] left-1/2 h-[15%] w-[58%] -translate-x-1/2 border-b-0`} />
      <div className={`${line} bottom-[3%] left-1/2 h-[6%] w-[26%] -translate-x-1/2 border-b-0`} />

      {/* Oyuncular */}
      {placePlayers(lineup).map(({ player, x, y }) => {
        const stats = statsById.get(player.id)
        const isHighlighted = player.id === highlightedId
        return (
          <button
            key={player.id}
            ref={isHighlighted ? highlightedRef : undefined}
            type="button"
            onClick={() => onPlayerClick(player)}
            aria-label={`${player.number} ${player.name}`}
            style={{ left: `${x}%`, bottom: `${y}%` }}
            className="absolute flex w-[4.75rem] -translate-x-1/2 translate-y-1/2 flex-col items-center"
          >
            <span className="relative">
              {/* Fotoğraf yoksa ya da yüklenmezse: takım renginde forma numarası (kaleci turuncu) */}
              <PlayerAvatar
                photo={player.photo}
                name={player.name}
                size="base"
                fallbackText={String(player.number)}
                fallbackColor={player.position === 'G' ? '#d97706' : teamColor(lineup.team.name)}
                className={`shadow-lg transition-transform duration-200 ease-out ${isHighlighted ? 'scale-110 ring-[3px] ring-amber-400' : 'ring-2 ring-white/80'}`}
              />
              {/* Reyting rozeti sağ üst köşede (veri yoksa hiç çizilmez) */}
              {showRatings && stats?.rating != null && (
                <span className="absolute -top-2 -right-4">
                  <RatingBadge rating={stats.rating} />
                </span>
              )}
            </span>
            <span
              className={`mt-1 max-w-full truncate text-[11px] leading-4 font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,0.8)] ${
                isHighlighted ? 'text-amber-300' : 'text-white'
              }`}
            >
              {shortName(player.name)}
            </span>
            <PlayerIcons stats={stats} />
          </button>
        )
      })}
    </div>
  )
}
