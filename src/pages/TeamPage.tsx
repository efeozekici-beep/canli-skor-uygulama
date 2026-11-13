import { useState } from 'react'
import { findTeamByName, getTeam, teamLeagueId } from '../services/teamService'
import { useDetailData } from '../hooks/useDetailData'
import { currentSeasonFor } from '../lib/league'
import TeamLogo from '../components/TeamLogo'
import LeagueTabs from '../components/league/LeagueTabs'
import StandingsTable from '../components/league/StandingsTable'
import TeamMatches from '../components/team/TeamMatches'
import TeamSquad from '../components/team/TeamSquad'
import { EmptyState, LoadingState } from '../components/match-detail/TabStates'
import { locale, t } from '../i18n'

type Tab = 'matches' | 'squad' | 'standings'

interface Props {
  /** API-Football takım id'si; yoksa (puan tablosundan gelindiyse) takımın adı */
  teamId: string | null
  teamName: string | null
  /** Hangi ligden gelindi (puan durumu ve maçlar bu ligden) */
  leagueHint: string | null
  regionHint: string | null
  onBack: () => void
  onSelectMatch: (id: string) => void
}

// Takım sayfası (#/takim/611 ya da #/takim/ad/Fenerbahce?lig=203): bilgiler + Maçlar / Kadro / Puan durumu
export default function TeamPage({ teamId, teamName, leagueHint, regionHint, onBack, onSelectMatch }: Props) {
  const team = useDetailData(`team:${teamId ?? teamName}`, () =>
    teamId ? getTeam(teamId) : teamName ? findTeamByName(teamName, regionHint ?? undefined) : Promise.resolve(null),
  )
  const [tab, setTab] = useState<Tab>('matches')
  const info = team.data
  const leagueId = info ? teamLeagueId(info, leagueHint) : null
  const tabs: { id: Tab; label: string }[] = [
    ...(leagueId ? [{ id: 'matches' as const, label: 'Maçlar' }] : []),
    { id: 'squad', label: 'Kadro' },
    ...(leagueId ? [{ id: 'standings' as const, label: 'Puan durumu' }] : []),
  ]
  // Ligi bilinmeyen takımda (kaynak listesinde olmayan lig) sadece kadro var
  const activeTab = tabs.some((x) => x.id === tab) ? tab : 'squad'

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-white/10 bg-pitch-950/95 px-2 py-1.5 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('Geri')}
          className="grid size-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="px-2 text-xs font-medium text-accent">{t('Takım')}</p>
      </div>

      {team.loading ? (
        <LoadingState rows={6} />
      ) : !info ? (
        <EmptyState message={team.error ?? 'Takım bulunamadı.'} />
      ) : (
        <>
          <div className="flex items-center gap-4 px-4 py-5 sm:px-6">
            <TeamLogo name={info.name} logo={info.logo} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold sm:text-2xl">{info.name}</h1>
              <p className="mt-0.5 text-sm text-white/55">
                {[info.country ? t(info.country) : null, info.founded ? t('Kuruluş {year}', { year: info.founded }) : null].filter(Boolean).join(' · ')}
              </p>
              {info.venue && (
                <p className="mt-0.5 truncate text-xs text-white/45">
                  {info.venue.name}
                  {info.venue.city ? `, ${info.venue.city}` : ''}
                  {info.venue.capacity ? ` · ${t('{n} kişilik', { n: info.venue.capacity.toLocaleString(locale()) })}` : ''}
                </p>
              )}
            </div>
          </div>
          <LeagueTabs tabs={tabs} active={activeTab} onChange={setTab} label={t('Takım sayfası')} />
          <div role="tabpanel" className="flex-1">
            {activeTab === 'matches' && leagueId && <TeamMatches team={info} leagueId={leagueId} onSelectMatch={onSelectMatch} />}
            {activeTab === 'squad' && <TeamSquad team={info} leagueId={leagueId} />}
            {activeTab === 'standings' && leagueId && <StandingsTable leagueId={leagueId} season={currentSeasonFor()} highlightTeams={[info.name]} />}
          </div>
        </>
      )}
    </div>
  )
}
