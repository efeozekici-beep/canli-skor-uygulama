import { useId, useState } from 'react'
import type { PlayerMatchStats } from '../../types/playerStats'
import { CHART_SURFACE, TEAM_COLORS } from '../../lib/chartColors'
import PlayerAvatar from '../common/PlayerAvatar'

// Oyuncu karşılaştırma radarı: iki oyuncunun bu maçtaki istatistikleri örümcek ağı grafiğinde.
// Her eksen 0 = hiç, dış çember = bu maçta o istatistikte en iyi oyuncu (reyting 5-10, pas isabeti %0-100).
// Rakamlar alttaki tabloda ve üzerine gelince yazılı; renk sadece oyuncuyu gösterir (A yeşil, B mavi).

interface Axis {
  key: string
  label: string
  value: (p: PlayerMatchStats) => number | null | undefined
  scale: 'max' | 'percent' | 'rating'
  format?: (v: number) => string
}

const AXES: Axis[] = [
  { key: 'rating', label: 'Reyting', value: (p) => p.rating, scale: 'rating', format: (v) => v.toFixed(1) },
  { key: 'shots', label: 'Şut', value: (p) => p.shots, scale: 'max' },
  { key: 'keyPasses', label: 'Kilit pas', value: (p) => p.keyPasses, scale: 'max' },
  { key: 'passAccuracy', label: 'Pas isabeti', value: (p) => p.passAccuracy, scale: 'percent', format: (v) => `%${v}` },
  { key: 'duelsWon', label: 'Kazanılan ikili', value: (p) => p.duelsWon, scale: 'max' },
  { key: 'tackles', label: 'Top kapma', value: (p) => p.tackles, scale: 'max' },
  { key: 'dribbles', label: 'Başarılı çalım', value: (p) => p.dribbles, scale: 'max' },
]

const SIZE = 320
const CENTER = SIZE / 2
const RADIUS = 108
const point = (i: number, count: number, r: number) => {
  const angle = (Math.PI * 2 * i) / count - Math.PI / 2
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) }
}

// İlk açılışta: tarafın en yüksek reytingli oyuncusu
const best = (players: PlayerMatchStats[], side: 'home' | 'away') =>
  players.filter((p) => p.side === side).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]?.playerId ?? null

export default function PlayerRadar({ players, homeTeam, awayTeam }: { players: PlayerMatchStats[]; homeTeam: string; awayTeam: string }) {
  // Sadece sahaya çıkanlar
  const played = players.filter((p) => (p.minutes ?? 0) > 0)
  const [chosen, setChosen] = useState<{ a: string | null; b: string | null }>({ a: null, b: null })
  const [hovered, setHovered] = useState<number | null>(null)
  const selectA = useId()
  const selectB = useId()

  // Bu maçta hiç verisi olmayan eksenler çizilmez (ör. örnek veride kilit pas yok)
  const axes = AXES.filter((axis) => played.some((p) => axis.value(p) != null))
  if (played.length < 2 || axes.length < 3) return null

  const aId = chosen.a ?? best(played, 'home')
  const bId = chosen.b ?? best(played, 'away')
  const a = played.find((p) => p.playerId === aId) ?? played[0]
  const b = played.find((p) => p.playerId === bId) ?? played[1]

  const maxOf = (axis: Axis) => Math.max(1, ...played.map((p) => axis.value(p) ?? 0))
  const ratio = (axis: Axis, p: PlayerMatchStats) => {
    const v = axis.value(p) ?? 0
    if (axis.scale === 'rating') return Math.min(1, Math.max(0, (v - 5) / 5))
    if (axis.scale === 'percent') return Math.min(1, v / 100)
    return v / maxOf(axis)
  }
  const shown = (axis: Axis, p: PlayerMatchStats) => {
    const v = axis.value(p)
    return v == null ? '–' : (axis.format?.(v) ?? String(v))
  }
  const polygon = (p: PlayerMatchStats) =>
    axes
      .map((axis, i) => point(i, axes.length, Math.max(0.03, ratio(axis, p)) * RADIUS))
      .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ')

  const series = [
    { player: a, color: TEAM_COLORS.home, key: 'a' as const, selectId: selectA },
    { player: b, color: TEAM_COLORS.away, key: 'b' as const, selectId: selectB },
  ]
  const groups = [
    { label: homeTeam, list: played.filter((p) => p.side === 'home') },
    { label: awayTeam, list: played.filter((p) => p.side === 'away') },
  ]

  return (
    <section className="space-y-4 border-t border-white/10 p-4">
      <h3 className="text-sm font-semibold text-white/80">Oyuncu karşılaştırma</h3>

      {/* Oyuncu seçiciler: renkli çizgi grafikteki rengi tanıtır (lejant) */}
      <div className="grid grid-cols-2 gap-2">
        {series.map((s) => (
          <label key={s.key} htmlFor={s.selectId} className="min-w-0 space-y-1.5">
            <span className="flex min-w-0 items-center gap-2">
              <PlayerAvatar photo={s.player.photo} name={s.player.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{s.player.name}</span>
                <span aria-hidden="true" className="mt-1 block h-1 w-8 rounded-full" style={{ backgroundColor: s.color }} />
              </span>
            </span>
            <select
              id={s.selectId}
              value={s.player.playerId}
              onChange={(e) => setChosen((c) => ({ ...c, [s.key]: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            >
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.list.map((p) => (
                    <option key={p.playerId} value={p.playerId}>
                      {p.name}
                      {p.rating != null ? ` (${p.rating.toFixed(1)})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-sm">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${a.name} ile ${b.name} karşılaştırması`} className="w-full overflow-visible">
          {/* Arka plan ağı: silik halkalar ve eksen çizgileri */}
          {[0.25, 0.5, 0.75, 1].map((r) => (
            <polygon
              key={r}
              points={axes.map((_, i) => point(i, axes.length, r * RADIUS)).map(({ x, y }) => `${x},${y}`).join(' ')}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          ))}
          {axes.map((axis, i) => {
            const end = point(i, axes.length, RADIUS)
            const label = point(i, axes.length, RADIUS + 22)
            const anchor = Math.abs(label.x - CENTER) < 8 ? 'middle' : label.x > CENTER ? 'start' : 'end'
            return (
              <g key={axis.key}>
                <line x1={CENTER} y1={CENTER} x2={end.x} y2={end.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className={`text-[11px] ${hovered === i ? 'fill-white font-semibold' : 'fill-white/60'}`}
                >
                  {axis.label}
                </text>
              </g>
            )
          })}

          {/* İki oyuncu: ince çizgi, hafif dolgu */}
          {series.map((s) => (
            <polygon key={s.key} points={polygon(s.player)} fill={s.color} fillOpacity="0.16" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
          ))}
          {/* Köşe noktaları: yüzey renginde halka, üst üste binince ayrışsın */}
          {series.map((s) =>
            axes.map((axis, i) => {
              const { x, y } = point(i, axes.length, Math.max(0.03, ratio(axis, s.player)) * RADIUS)
              return <circle key={`${s.key}-${axis.key}`} cx={x} cy={y} r={hovered === i ? 5 : 4} fill={s.color} stroke={CHART_SURFACE} strokeWidth="2" />
            }),
          )}

          {/* Üzerine gelme alanları: noktadan büyük, eksen boyunca */}
          {axes.map((axis, i) => {
            const end = point(i, axes.length, RADIUS + 14)
            return (
              <line
                key={`hit-${axis.key}`}
                x1={CENTER}
                y1={CENTER}
                x2={end.x}
                y2={end.y}
                stroke="transparent"
                strokeWidth="26"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setHovered(i)}
              />
            )
          })}
        </svg>

        {/* İpucu: eksenin adı ve iki oyuncunun gerçek değeri */}
        {hovered !== null && axes[hovered] && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-lg border border-white/10 bg-pitch-950/95 px-3 py-2 text-xs shadow-xl">
            <p className="mb-1 font-semibold">{axes[hovered].label}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-2 tabular-nums">
                <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="max-w-32 truncate text-white/70">{s.player.name}</span>
                <span className="ml-auto font-semibold">{shown(axes[hovered], s.player)}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Tablo görünümü: bütün rakamlar (renge bakmadan okunabilsin) */}
      <table className="w-full text-sm tabular-nums">
        <tbody>
          {axes.map((axis, i) => {
            const va = axis.value(a) ?? 0
            const vb = axis.value(b) ?? 0
            return (
              <tr key={axis.key} className={`border-t border-white/5 ${hovered === i ? 'bg-white/[0.04]' : ''}`}>
                <td className={`py-1.5 pl-1 text-left ${va > vb ? 'font-bold text-white' : 'text-white/70'}`}>{shown(axis, a)}</td>
                <td className="py-1.5 text-center text-xs text-white/55">{axis.label}</td>
                <td className={`py-1.5 pr-1 text-right ${vb > va ? 'font-bold text-white' : 'text-white/70'}`}>{shown(axis, b)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-[11px] text-white/40">Dış çember: bu maçta o istatistikte en iyi oyuncu.</p>
    </section>
  )
}
