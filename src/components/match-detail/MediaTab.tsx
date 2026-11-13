import { t } from '../../i18n'

// Medya sekmesi: şimdilik boş durum.
export default function MediaTab() {
  return (
    <div className="px-6 py-14 text-center">
      <span className="inline-block rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">{t('Yakında')}</span>
      <p className="mt-3 text-sm text-white/60">{t('Maç özetleri ve görüntüler burada olacak.')}</p>
    </div>
  )
}
