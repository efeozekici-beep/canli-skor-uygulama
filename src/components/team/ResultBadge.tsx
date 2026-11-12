// Maç sonucu rozeti: G (yeşil), B (gri), M (kırmızı). Renk tek başına bilgi taşımasın diye harf de yazılı.
const STYLE = {
  W: { letter: 'G', title: 'Galibiyet', className: 'bg-accent/20 text-accent' },
  D: { letter: 'B', title: 'Beraberlik', className: 'bg-white/10 text-white/75' },
  L: { letter: 'M', title: 'Mağlubiyet', className: 'bg-red-500/20 text-red-300' },
}

export default function ResultBadge({ result }: { result: 'W' | 'D' | 'L' }) {
  const s = STYLE[result]
  return (
    <span title={s.title} className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold ${s.className}`}>
      {s.letter}
    </span>
  )
}
