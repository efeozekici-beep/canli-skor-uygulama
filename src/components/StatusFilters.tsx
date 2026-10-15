import type { MatchStatus } from '../types/match'

interface Props {
  active: MatchStatus | null
  liveCount: number
  onChange: (status: MatchStatus | null) => void
}

const base =
  'min-h-10 rounded-full px-4 text-sm font-semibold whitespace-nowrap ring-1 ring-inset transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]'

export default function StatusFilters({ active, liveCount, onChange }: Props) {
  // Clicking the selected filter again clears it.
  const toggle = (status: MatchStatus) => onChange(active === status ? null : status)

  const neutral = (status: MatchStatus) =>
    active === status
      ? 'bg-white text-pitch-950 ring-white'
      : 'bg-white/5 text-white ring-white/10 hover:bg-white/10'

  return (
    <div role="group" aria-label="Maç durumu filtresi" className="flex gap-2">
      <button
        type="button"
        aria-pressed={active === 'live'}
        onClick={() => toggle('live')}
        className={`${base} ${
          active === 'live'
            ? 'bg-red-500 text-white ring-red-500'
            : 'bg-red-500/15 text-red-300 ring-red-500/30 hover:bg-red-500/25'
        }`}
      >
        Canlı <span className="tabular-nums">({liveCount})</span>
      </button>
      <button type="button" aria-pressed={active === 'finished'} onClick={() => toggle('finished')} className={`${base} ${neutral('finished')}`}>
        Bitti
      </button>
      <button type="button" aria-pressed={active === 'upcoming'} onClick={() => toggle('upcoming')} className={`${base} ${neutral('upcoming')}`}>
        Yaklaşan
      </button>
    </div>
  )
}
