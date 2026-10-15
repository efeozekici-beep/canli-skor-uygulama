import { useState } from 'react'
import { getLeague } from '../services/leagueService'
import { useDetailData } from '../hooks/useDetailData'
import LeagueHeader from '../components/league/LeagueHeader'
import LeagueTabs from '../components/league/LeagueTabs'
import StandingsTable from '../components/league/StandingsTable'
import StatsTab from '../components/league/StatsTab'
import LeagueFixtures from '../components/league/LeagueFixtures'
import { EmptyState, LoadingState } from '../components/match-detail/TabStates'

type Tab = 'standings' | 'stats' | 'matches'

const TABS: { id: Tab; label: string }[] = [
  { id: 'standings', label: 'Puan Durumu' },
  { id: 'stats', label: 'İstatistikler' },
  { id: 'matches', label: 'Maçlar' },
]

interface Props {
  leagueId: string
  onBack: () => void
  onSelectMatch: (id: string) => void
}

// Lig sayfası (#/lig/:leagueId): başlık + Puan Durumu / İstatistikler / Maçlar
export default function LeaguePage({ leagueId, onBack, onSelectMatch }: Props) {
  const league = useDetailData(`league:${leagueId}`, () => getLeague(leagueId))
  const [tab, setTab] = useState<Tab>('standings')
  // Kullanıcı sezon seçmediyse ligin güncel sezonu
  const [chosenSeason, setChosenSeason] = useState<number | null>(null)

  return (
    <div className="flex min-h-full flex-col">
      {/* Üst çubuk: geri butonu */}
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-white/10 bg-pitch-950/95 px-2 py-1.5 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          aria-label="Geri"
          className="grid size-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="px-2 text-xs font-medium text-accent">Lig</p>
      </div>

      {league.loading ? (
        <LoadingState rows={6} />
      ) : !league.data ? (
        <EmptyState message="Bu lig için veri yok." />
      ) : (
        <>
          <LeagueHeader league={league.data} season={chosenSeason ?? league.data.currentSeason} onSeasonChange={setChosenSeason} />
          <LeagueTabs tabs={TABS} active={tab} onChange={setTab} label="Lig sayfası" />
          {/* Sadece aktif sekme ekranda; verisi de ilk açıldığında yüklenir */}
          <div role="tabpanel" className="flex-1">
            {tab === 'standings' && <StandingsTable leagueId={leagueId} season={chosenSeason ?? league.data.currentSeason} />}
            {tab === 'stats' && <StatsTab leagueId={leagueId} season={chosenSeason ?? league.data.currentSeason} />}
            {tab === 'matches' && (
              <LeagueFixtures leagueId={leagueId} season={chosenSeason ?? league.data.currentSeason} onSelectMatch={onSelectMatch} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
