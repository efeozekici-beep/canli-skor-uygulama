import { useId } from 'react'
import type { MatchEventKind } from '../../types/matchDetail'

// Gol topu, kartlar ve değişiklik okları için küçük SVG ikonlar.

// Klasik futbol topu: beyaz top, ortada siyah beşgen, kenarlarda yarım yamalar.
// own: kendi kalesine gol (yamalar kırmızı)
const PATCH_ANGLES = [-90, -18, 54, 126, 198]

// Merkezi (cx, cy) olan çemberde verilen açıdaki nokta
const point = (angle: number, r: number, cx = 10, cy = 10): [number, number] => {
  const rad = (angle * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}
const pentagon = (r: number, cx = 10, cy = 10, rotate = 0) =>
  PATCH_ANGLES.map((a) => point(a + rotate, r, cx, cy).map((n) => n.toFixed(2)).join(',')).join(' ')

function Ball({ className, own = false }: { className: string; own?: boolean }) {
  const clipId = useId()
  const dark = own ? '#ef4444' : '#111814'
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <defs>
        <clipPath id={clipId}>
          <circle cx="10" cy="10" r="9" />
        </clipPath>
      </defs>
      <circle cx="10" cy="10" r="9" fill="#fff" />
      <g clipPath={`url(#${clipId})`} fill={dark} stroke={dark} strokeWidth="0.9" strokeLinejoin="round">
        <polygon points={pentagon(3.2)} />
        {PATCH_ANGLES.map((a) => {
          const [x1, y1] = point(a, 3.2)
          const [x2, y2] = point(a, 6.6)
          const [px, py] = point(a, 9.6)
          return (
            <g key={a}>
              {/* Ortadaki beşgenden kenardaki yarım yamaya dikiş çizgisi */}
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <polygon points={pentagon(2.9, px, py, 180)} />
            </g>
          )
        })}
      </g>
      <circle cx="10" cy="10" r="9" fill="none" stroke={dark} strokeWidth="1" />
    </svg>
  )
}

// Önden kale: beyaz direkler ve üst direk, arkada silik file çizgileri, altta zemin çizgisi
function Goal({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path d="M4.5 6.5v10M8 6.5v10M11.5 6.5v10M15 6.5v10M2.5 10h15M2.5 13.5h15" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.8" />
      <path d="M2.5 17V4.5h15V17" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M1 17h18" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function Card({ color }: { color: 'yellow' | 'red' }) {
  return <span aria-hidden="true" className={`inline-block h-3.5 w-2.5 rotate-6 rounded-[2px] ${color === 'yellow' ? 'bg-amber-400' : 'bg-red-500'}`} />
}

export function SubArrows({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path d="M6 15V4m0 0L3 7m3-3 3 3" fill="none" stroke="#34d058" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 5v11m0 0 3-3m-3 3-3-3" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function EventIcon({ kind }: { kind: MatchEventKind }) {
  switch (kind) {
    case 'goal':
    case 'penalty':
      return <Ball className="size-4" />
    case 'own-goal':
      return <Ball className="size-4" own />
    case 'missed-penalty':
      // Kale + sağ altta kırmızı çarpı rozeti
      return (
        <span className="relative inline-grid">
          <Goal className="size-4" />
          <svg viewBox="0 0 10 10" aria-hidden="true" className="absolute -right-1 -bottom-1 size-2.5">
            <circle cx="5" cy="5" r="4.5" fill="#ef4444" stroke="#131b16" strokeWidth="1" />
            <path d="M3.4 3.4l3.2 3.2M6.6 3.4L3.4 6.6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </span>
      )
    case 'yellow':
      return <Card color="yellow" />
    case 'red':
      return <Card color="red" />
    case 'second-yellow':
      return (
        <span className="relative inline-block w-4">
          <Card color="yellow" />
          <span className="absolute top-0.5 left-1.5">
            <Card color="red" />
          </span>
        </span>
      )
    case 'sub':
      return <SubArrows />
  }
}

export { Ball }
