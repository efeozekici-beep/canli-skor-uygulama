import { t } from '../../i18n'

export type DetailTab = 'details' | 'chat' | 'lineups' | 'stats' | 'standings' | 'matches' | 'media'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'details', label: 'Ayrıntılar' },
  { id: 'lineups', label: 'Kadrolar' },
  { id: 'stats', label: 'İstatistikler' },
  { id: 'standings', label: 'Puan durumu' },
  { id: 'matches', label: 'Maçlar' },
  { id: 'media', label: 'Medya' },
  { id: 'chat', label: 'Sohbet' },
]

interface Props {
  active: DetailTab
  onChange: (tab: DetailTab) => void
}

// Yatay kaydırılabilir sekme çubuğu; aktif sekmenin altında yeşil çizgi.
export default function DetailTabs({ active, onChange }: Props) {
  return (
    <div role="tablist" aria-label={t('Maç detayı')} className="no-scrollbar flex overflow-x-auto border-y border-white/10 px-2">
      {TABS.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative min-h-12 shrink-0 px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
              isActive ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t(tab.label)}
            {isActive && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        )
      })}
    </div>
  )
}
