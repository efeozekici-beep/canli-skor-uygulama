import type { MatchEventKind } from '../../types/matchDetail'

// Gol topu, kartlar ve değişiklik okları için küçük SVG ikonlar.

function Ball({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10 6 3 2.2-1.1 3.6H8.1L7 8.2 10 6Z" fill="currentColor" />
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
      return <Ball className="size-4 text-white" />
    case 'own-goal':
      return <Ball className="size-4 text-red-400" />
    case 'missed-penalty':
      return (
        <span className="relative inline-grid">
          <Ball className="size-4 text-white/50" />
          <span aria-hidden="true" className="absolute inset-0 m-auto h-0.5 w-5 -rotate-45 bg-red-400" />
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
