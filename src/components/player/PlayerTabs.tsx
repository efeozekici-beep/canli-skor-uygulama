import LeagueTabs from '../league/LeagueTabs'

export type PlayerTab = 'overview' | 'career' | 'transfers' | 'trophies'

const TABS: { id: PlayerTab; label: string }[] = [
  { id: 'overview', label: 'Genel' },
  { id: 'career', label: 'Kariyer' },
  { id: 'transfers', label: 'Transferler' },
  { id: 'trophies', label: 'Kupalar' },
]

// Oyuncu sayfası sekmeleri (lig sayfasındaki sekme bileşenini kullanır)
export default function PlayerTabs({ active, onChange }: { active: PlayerTab; onChange: (tab: PlayerTab) => void }) {
  return <LeagueTabs tabs={TABS} active={active} onChange={onChange} label="Oyuncu sayfası" />
}
