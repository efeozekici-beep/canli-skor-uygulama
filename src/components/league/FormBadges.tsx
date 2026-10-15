// Son 5 maç: G (galibiyet) yeşil, B (beraberlik) gri, M (mağlubiyet) kırmızı.
// Daha az maç oynandıysa kalan kutular boş görünür.
const STYLE: Record<string, { label: string; className: string; title: string }> = {
  W: { label: 'G', className: 'bg-accent text-pitch-950', title: 'Galibiyet' },
  D: { label: 'B', className: 'bg-white/30 text-white', title: 'Beraberlik' },
  L: { label: 'M', className: 'bg-red-500 text-white', title: 'Mağlubiyet' },
}

export default function FormBadges({ form }: { form: string | null }) {
  const results = (form ?? '').slice(-5).split('').filter((r) => r in STYLE)
  return (
    <span className="inline-flex gap-1" aria-label={`Son maçlar: ${results.map((r) => STYLE[r].title).join(', ') || 'yok'}`}>
      {Array.from({ length: 5 }, (_, i) => {
        const r = results[i]
        return r ? (
          <span key={i} title={STYLE[r].title} className={`grid size-[18px] place-items-center rounded text-[10px] font-bold ${STYLE[r].className}`}>
            {STYLE[r].label}
          </span>
        ) : (
          <span key={i} className="size-[18px] rounded bg-white/[0.06]" />
        )
      })}
    </span>
  )
}
