import { ab, t } from '../../i18n'

// Son 5 maç: G (galibiyet) yeşil, B (beraberlik) gri, M (mağlubiyet) kırmızı.
// Daha az maç oynandıysa kalan kutular boş görünür.
const STYLE: Record<string, { label: string; className: string; title: string }> = {
  W: { label: 'G|W|S', className: 'bg-accent text-onaccent', title: 'Galibiyet' },
  D: { label: 'B|D|U', className: 'bg-white/30 text-white', title: 'Beraberlik' },
  L: { label: 'M|L|N', className: 'bg-red-500 text-onaccent', title: 'Mağlubiyet' },
}

// Harf üç dilde: 'G|W|S' -> Türkçe G, İngilizce W, Almanca S
const letter = (l: string) => { const [tr, en, de] = l.split('|'); return ab(tr, en, de) }

export default function FormBadges({ form }: { form: string | null }) {
  const results = (form ?? '').slice(-5).split('').filter((r) => r in STYLE)
  return (
    <span className="inline-flex gap-1" aria-label={`${t('Son maçlar')}: ${results.map((r) => t(STYLE[r].title)).join(', ') || t('yok')}`}>
      {Array.from({ length: 5 }, (_, i) => {
        const r = results[i]
        return r ? (
          <span key={i} title={t(STYLE[r].title)} className={`grid size-[18px] place-items-center rounded text-[10px] font-bold ${STYLE[r].className}`}>
            {letter(STYLE[r].label)}
          </span>
        ) : (
          <span key={i} className="size-[18px] rounded bg-white/[0.06]" />
        )
      })}
    </span>
  )
}
