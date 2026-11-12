import { useState } from 'react'
import type { Match } from '../types/match'
import { knownMatchesForDate } from '../services/matchService'
import { useFavorites } from '../hooks/useFavorites'
import { addDays } from '../lib/date'
import LeagueLogo from '../components/common/LeagueLogo'
import LeagueTabs from '../components/league/LeagueTabs'
import MatchRow from '../components/MatchRow'
import { BasketballStandingsTable } from '../components/basketball/BasketballStandingsTab'
import LeadersPanel from '../components/basketball/LeadersPanel'
import { EmptyState } from '../components/match-detail/TabStates'

type Tab = 'standings' | 'matches'

const TABS: { id: Tab; label: string }[] = [
  { id: 'standings', label: 'Puan Durumu' },
  { id: 'matches', label: 'Maçlar' },
]

// Listede bu ligin maçı yoksa (sayfa doğrudan açıldıysa) bilinen ligler için ad ve sezon
const SEASON_YEAR = (() => {
  const now = new Date()
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
})()
const KNOWN: Record<string, { name: string; region: string; season: string }> = {
  'bb-12': { name: 'NBA', region: 'ABD', season: `${SEASON_YEAR}-${SEASON_YEAR + 1}` },
  'bb-120': { name: 'EuroLeague', region: 'Avrupa', season: String(SEASON_YEAR) },
  'bb-194': { name: 'EuroCup', region: 'Avrupa', season: String(SEASON_YEAR) },
}

interface Props {
  leagueId: string
  onBack: () => void
  onSelectMatch: (id: string) => void
}

// Basketbol lig sayfası (#/lig/bb-12): puan durumu + dün / bugün / yarının maçları (ana listenin bildiği maçlar)
export default function BasketballLeaguePage({ leagueId, onBack, onSelectMatch }: Props) {
  const [tab, setTab] = useState<Tab>('standings')
  const { favorites, toggleFavorite } = useFavorites()
  // Sayfa açıldığı an (her çizimde yeniden okunmasın)
  const [today] = useState(() => new Date())

  const matches: Match[] = [-1, 0, 1]
    .flatMap((offset) => knownMatchesForDate(addDays(today, offset)))
    .filter((m) => m.leagueId === leagueId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const sample = matches[0]
  const known = KNOWN[leagueId]
  const name = sample?.leagueName ?? known?.name ?? 'Basketbol ligi'
  const region = sample?.region ?? known?.region ?? ''
  const season = sample?.basketball?.season ?? known?.season ?? null

  return (
    <div className="flex min-h-full flex-col">
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

      <div className="flex items-center gap-4 px-4 py-5 sm:px-6">
        {/* Logo listede yoksa API-Sports'un basketbol lig logosu */}
        <LeagueLogo name={name} logo={sample?.leagueLogo ?? `https://media.api-sports.io/basketball/leagues/${leagueId.replace(/^bb-/, '')}.png`} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold sm:text-2xl">{name}</h1>
          <p className="mt-0.5 text-sm text-white/55">{[region, season].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      <LeagueTabs tabs={TABS} active={tab} onChange={setTab} label="Lig sayfası" />
      <div role="tabpanel" className="flex-1">
        {/* Geniş ekranda tablo solda, istatistik liderleri sağda; telefonda liderler tablonun altında */}
        {tab === 'standings' && (
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-4 lg:pr-5">
            <div className="min-w-0">
              {season ? <BasketballStandingsTable leagueId={leagueId} season={season} /> : <EmptyState message="Bu lig için puan durumu bulunmuyor." />}
            </div>
            <div className="px-3 pb-5 sm:px-5 lg:px-0 lg:pt-5">
              <LeadersPanel leagueId={leagueId} />
            </div>
          </div>
        )}
        {tab === 'matches' &&
          (matches.length === 0 ? (
            <EmptyState message="Dün, bugün ve yarın bu ligde maç yok." />
          ) : (
            <div className="p-3 sm:p-5">
              <ul className="overflow-hidden rounded-xl bg-white/[0.03]">
                {matches.map((m) => (
                  <li key={m.id}>
                    <MatchRow match={m} isFavorite={favorites.has(m.id)} isSelected={false} onToggleFavorite={toggleFavorite} onSelect={onSelectMatch} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  )
}
