import { useEffect, useRef, useState } from 'react'
import type { LineupPlayer, Side, TeamLineup } from '../../types/matchDetail'
import type { PlayerMatchStats } from '../../types/playerStats'
import { shortName, teamColor } from '../../lib/team'
import RatingBadge from './RatingBadge'
import PlayerIcons from './PlayerIcons'
import PlayerAvatar from '../common/PlayerAvatar'

interface Props {
  /** Tek takım: bütün saha. İki takım: ev sahibi alt yarı, deplasman üst yarı. */
  teams: { lineup: TeamLineup; side: Side }[]
  statsById: Map<string, PlayerMatchStats>
  showRatings: boolean
  highlightedId: string | null
  onPlayerClick: (player: LineupPlayer, side: Side) => void
}

// Takımın sahada kapladığı alan
type Area = 'full' | 'bottom' | 'top'

// Her oyuncunun sahadaki yerini (yüzde olarak) hesaplar.
// grid "satır:sütun" ise onu kullanır, yoksa dizilişe göre sırayla dağıtır.
function placePlayers(lineup: TeamLineup, area: Area) {
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

  return cells.map((c) => {
    const x = (c.col / ((perRow.get(c.row) ?? 1) + 1)) * 100
    // 0: kaleci, 1: en öndeki sıra
    const frac = rowCount > 1 ? (c.row - 1) / (rowCount - 1) : 0.5
    // Tek takım: kaleci altta (%7), forvetler üstte (%87). İki takımda her takım kendi yarısında;
    // üstteki takım ayna gibi çevrilir (kalecisi en üstte, sol kanadı izleyicinin sağında)
    if (area === 'full') return { player: c.player, x, y: 7 + frac * 80 }
    if (area === 'bottom') return { player: c.player, x, y: 5 + frac * 38 }
    return { player: c.player, x: 100 - x, y: 95 - frac * 38 }
  })
}

export default function PitchView({ teams, statsById, showRatings, highlightedId, onPlayerClick }: Props) {
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

  const line = 'absolute border-2 border-onaccent/35'
  const both = teams.length > 1
  const placed = teams.flatMap(({ lineup, side }) =>
    placePlayers(lineup, !both ? 'full' : side === 'home' ? 'bottom' : 'top').map((p) => ({ ...p, side, lineup })),
  )

  // Geniş alanda (masaüstünde maç sayfası) saha yatay: ev sahibi solda, deplasman sağda, kartın tamamını
  // doldurur. Dar alanda (telefon, yan panel) dikey. Karar ekranın değil sahanın sığdığı kutunun genişliğine göre.
  const boxRef = useRef<HTMLDivElement>(null)
  const [horizontal, setHorizontal] = useState(false)
  useEffect(() => {
    const el = boxRef.current?.parentElement
    if (!el) return
    const check = () => setHorizontal(el.clientWidth >= 640)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  // Dikey konum (x: soldan, y: alttan) -> yatayda 90° döndürülür: alt kale sola, oyuncunun solu yukarı
  const pos = (x: number, y: number) => (horizontal ? { left: `${y}%`, top: `${x}%` } : { left: `${x}%`, bottom: `${y}%` })

  const verticalLines = (
    <>
      <div className="absolute inset-x-[3%] top-1/2 border-t-2 border-onaccent/35" />
      <div className={`${line} top-[3%] left-1/2 h-[15%] w-[58%] -translate-x-1/2 border-t-0`} />
      <div className={`${line} top-[3%] left-1/2 h-[6%] w-[26%] -translate-x-1/2 border-t-0`} />
      <div className={`${line} bottom-[3%] left-1/2 h-[15%] w-[58%] -translate-x-1/2 border-b-0`} />
      <div className={`${line} bottom-[3%] left-1/2 h-[6%] w-[26%] -translate-x-1/2 border-b-0`} />
    </>
  )
  const horizontalLines = (
    <>
      <div className="absolute inset-y-[3%] left-1/2 border-l-2 border-onaccent/35" />
      <div className={`${line} top-1/2 left-[3%] h-[58%] w-[15%] -translate-y-1/2 border-l-0`} />
      <div className={`${line} top-1/2 left-[3%] h-[26%] w-[6%] -translate-y-1/2 border-l-0`} />
      <div className={`${line} top-1/2 right-[3%] h-[58%] w-[15%] -translate-y-1/2 border-r-0`} />
      <div className={`${line} top-1/2 right-[3%] h-[26%] w-[6%] -translate-y-1/2 border-r-0`} />
    </>
  )

  return (
    // İki takımda saha daha uzun: her yarıda bir takımın bütün sıraları sığsın
    <div
      ref={boxRef}
      className={`relative mx-auto w-full overflow-hidden rounded-xl bg-[#1b6334] ${
        horizontal
          ? `bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.05)_0_10%,transparent_10%_20%)] ${both ? 'aspect-[132/68]' : 'aspect-[96/68]'}`
          : `max-w-md bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.05)_0_10%,transparent_10%_20%)] ${both ? 'aspect-[68/132]' : 'aspect-[68/96]'}`
      }`}
    >
      {/* Saha çizgileri */}
      <div className={`${line} inset-[3%] rounded-sm`} />
      {horizontal ? horizontalLines : verticalLines}
      <div
        className={`${line} top-1/2 left-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full ${horizontal ? 'h-[26%]' : 'w-[26%]'}`}
      />

      {/* İki takımda her yarının köşesinde takım adı ve diziliş */}
      {both &&
        teams.map(({ lineup, side }) => (
          <span
            key={side}
            className={`absolute max-w-[36%] truncate rounded bg-black/35 px-1.5 py-0.5 text-[10px] font-semibold text-onaccent/85 ${
              horizontal ? `bottom-[3.5%] ${side === 'home' ? 'left-[4%]' : 'right-[4%]'}` : `left-[4%] ${side === 'home' ? 'bottom-[3.5%]' : 'top-[3.5%]'}`
            }`}
          >
            {lineup.team.name} · {lineup.formation}
          </span>
        ))}

      {/* Oyuncular */}
      {placed.map(({ player, x, y, side, lineup }) => {
        const stats = statsById.get(player.id)
        const isHighlighted = player.id === highlightedId
        return (
          <button
            key={`${side}-${player.id}`}
            ref={isHighlighted ? highlightedRef : undefined}
            type="button"
            onClick={() => onPlayerClick(player, side)}
            aria-label={`${player.number} ${player.name}`}
            style={pos(x, y)}
            className={`absolute flex w-[4.75rem] -translate-x-1/2 flex-col items-center ${horizontal ? '-translate-y-1/2' : 'translate-y-1/2'}`}
          >
            <span className="relative">
              {/* Fotoğraf yoksa ya da yüklenmezse: takım renginde forma numarası (kaleci turuncu) */}
              <PlayerAvatar
                photo={player.photo}
                name={player.name}
                size="base"
                fallbackText={String(player.number)}
                fallbackColor={player.position === 'G' ? '#d97706' : teamColor(lineup.team.name)}
                className={`shadow-lg transition-transform duration-200 ease-out ${isHighlighted ? 'scale-110 ring-[3px] ring-amber-400' : 'ring-2 ring-onaccent/80'}`}
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
                isHighlighted ? 'text-[#fcd34d]' : 'text-onaccent'
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
