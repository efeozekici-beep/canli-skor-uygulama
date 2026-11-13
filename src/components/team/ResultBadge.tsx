import { ab, t } from '../../i18n'

// Maç sonucu rozeti: G (yeşil), B (gri), M (kırmızı). Renk tek başına bilgi taşımasın diye harf de yazılı.
const STYLE = {
  W: { letter: 'G|W|S', title: 'Galibiyet', className: 'bg-accent/20 text-accent' },
  D: { letter: 'B|D|U', title: 'Beraberlik', className: 'bg-white/10 text-white/75' },
  L: { letter: 'M|L|N', title: 'Mağlubiyet', className: 'bg-red-500/20 text-red-300' },
}

export default function ResultBadge({ result }: { result: 'W' | 'D' | 'L' }) {
  const s = STYLE[result]
  return (
    <span title={t(s.title)} className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold ${s.className}`}>
      {ab(...(s.letter.split('|') as [string, string, string]))}
    </span>
  )
}
