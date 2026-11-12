import { useState, type ReactNode } from 'react'
import type { BasketballTeamGame, BasketballTeamRef } from '../types/team'
import { findTeamInLeague, getDomesticGames, getFixtures, getLeagueTeams, getSquad, getTeamStats } from '../services/basketballTeamService'
import { useDetailData } from '../hooks/useDetailData'
import { sameTeamName } from '../lib/team'
import TeamLogo from '../components/TeamLogo'
import PlayerAvatar from '../components/common/PlayerAvatar'
import LeagueTabs from '../components/league/LeagueTabs'
import TeamStatsCard from '../components/team/TeamStatsCard'
import ResultBadge from '../components/team/ResultBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/match-detail/TabStates'
import { basketballPlayerHref } from '../lib/navigation'

type Tab = 'matches' | 'squad'

const TABS: { id: Tab; label: string }[] = [
  { id: 'matches', label: 'Maçlar' },
  { id: 'squad', label: 'Kadro' },
]

const LEAGUES: Record<string, { name: string; season: () => string }> = {
  'bb-12': { name: 'NBA', season: () => `${seasonYear()}-${seasonYear() + 1}` },
  'bb-120': { name: 'EuroLeague', season: () => String(seasonYear()) },
  'bb-194': { name: 'EuroCup', season: () => String(seasonYear()) },
}
function seasonYear() {
  const now = new Date()
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
}

interface Props {
  leagueId: string
  /** NBA: ESPN takım id'si, EuroLeague: kulüp kodu; yoksa (maçtan gelindiyse) takımın adı */
  teamId: string | null
  teamName: string | null
  onBack: () => void
}

// Basketbol takım sayfası (#/takim/bb/bb-12/id/2 ya da .../ad/Boston%20Celtics): Maçlar (sezon özeti + son / yaklaşan) ve Kadro
export default function BasketballTeamPage({ leagueId, teamId, teamName, onBack }: Props) {
  const team = useDetailData(`bb-team:${leagueId}:${teamId ?? teamName}`, async () =>
    teamId ? ((await getLeagueTeams(leagueId)).find((t) => t.id === teamId) ?? null) : teamName ? findTeamInLeague(leagueId, teamName) : null,
  )
  const [tab, setTab] = useState<Tab>('matches')
  const league = LEAGUES[leagueId]
  const t = team.data

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
        <p className="px-2 text-xs font-medium text-accent">Takım</p>
      </div>

      {team.loading ? (
        <LoadingState rows={6} />
      ) : !t || !league ? (
        <EmptyState message={team.error ?? 'Takım bulunamadı.'} />
      ) : (
        <>
          <div className="flex items-center gap-4 px-4 py-5 sm:px-6">
            <TeamLogo name={t.name} logo={t.logo ?? undefined} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold sm:text-2xl">{t.name}</h1>
              <a href={`#/lig/${leagueId}`} className="mt-0.5 inline-block text-sm text-white/55 hover:text-accent">
                {league.name}
              </a>
            </div>
          </div>
          <LeagueTabs tabs={TABS} active={tab} onChange={setTab} label="Takım sayfası" />
          <div role="tabpanel" className="flex-1">
            {tab === 'matches' && <TeamGames leagueId={leagueId} team={t} season={league.season()} competition={league.name} />}
            {tab === 'squad' && <TeamRoster leagueId={leagueId} team={t} />}
          </div>
        </>
      )}
    </div>
  )
}

const day = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' })
const time = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

const ROW_CLASS =
  'grid grid-cols-[5.5rem_minmax(0,1fr)_auto_minmax(0,1fr)_1.5rem] items-center gap-2 border-t border-white/5 px-3 py-2.5 first:border-t-0 sm:gap-3'

// Lig maçı (API-Basketball) maç sayfasına gider; EuroLeague / NBA maçlarının maç sayfası yok
function GameRowShell({ matchId, children }: { matchId?: string; children: ReactNode }) {
  return matchId ? (
    <li>
      <a href={`#/mac/${matchId}`} className={`${ROW_CLASS} hover:bg-white/[0.04]`}>
        {children}
      </a>
    </li>
  ) : (
    <li className={ROW_CLASS}>{children}</li>
  )
}

// Tek maç satırı (ana listedeki maç satırı gibi): tarih | ev sahibi | skor (ya da saat) | deplasman | sonuç rozeti.
// Sayfanın takımı kalın yazılır.
function GameRow({ game, team, competition }: { game: BasketballTeamGame; team: BasketballTeamRef; competition: string }) {
  const isOwn = (name: string) => sameTeamName(name, team.shortName ?? team.name) || sameTeamName(name, team.name)
  const ownIsHome = isOwn(game.home.name)
  const own = ownIsHome ? game.home.score : game.away.score
  const other = ownIsHome ? game.away.score : game.home.score
  const finished = game.status === 'finished' && own !== null && other !== null
  const side = (s: BasketballTeamGame['home'], align: 'right' | 'left') => (
    <span className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <TeamLogo name={s.name} logo={s.logo ?? undefined} size="row" />
      <span className={`truncate text-sm ${isOwn(s.name) ? 'font-bold text-white' : 'text-white/75'}`}>{s.name}</span>
    </span>
  )
  return (
    <GameRowShell matchId={game.matchId}>
      <span className="text-[11px] leading-tight text-white/50">
        <span className="block capitalize">{day(game.date)}</span>
        {/* Turnuva: EuroLeague maçları ile takımın kendi lig maçları aynı listede */}
        <span className={`block truncate ${game.competition ? 'text-accent/80' : 'text-white/35'}`}>{game.competition ?? competition}</span>
      </span>
      {side(game.home, 'right')}
      <span
        className={`min-w-[4.25rem] rounded-lg bg-black/30 px-2 py-1 text-center text-sm font-extrabold tabular-nums ${
          game.status === 'live' ? 'text-[#fca5a5]' : finished ? '' : 'font-semibold text-white/60'
        }`}
      >
        {finished || game.status === 'live' ? `${game.home.score ?? 0} - ${game.away.score ?? 0}` : time(game.date)}
      </span>
      {side(game.away, 'left')}
      <span className="flex justify-end">{finished ? <ResultBadge result={own > other ? 'W' : 'L'} /> : null}</span>
    </GameRowShell>
  )
}

function TeamGames({ leagueId, team, season, competition }: { leagueId: string; team: BasketballTeamRef; season: string; competition: string }) {
  // Turnuva maçları (EuroLeague / NBA) + takımın kendi lig maçları (dün / bugün / yarın) tek listede
  const fixtures = useDetailData(`bb-fixtures:${leagueId}:${team.id}`, async () => {
    const [main, domestic] = await Promise.all([getFixtures(leagueId, team.id), leagueId === 'bb-12' ? [] : getDomesticGames(leagueId, team).catch(() => [])])
    if (!main) return null
    const all = [...main.past, ...main.upcoming, ...domestic]
    return {
      past: all.filter((g) => g.status === 'finished').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
      upcoming: all.filter((g) => g.status !== 'finished').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10),
    }
  })
  const stats = useDetailData(`bb-team-stats:${leagueId}:${team.id}`, () => getTeamStats(leagueId, season, team))

  return (
    <div className="space-y-5 p-3 sm:p-5">
      {stats.data && <TeamStatsCard stats={stats.data} unit="sayı" />}
      {fixtures.loading ? (
        <LoadingState rows={8} />
      ) : fixtures.error ? (
        <ErrorState message={fixtures.error} />
      ) : !fixtures.data ? (
        <EmptyState message="Bu sezonun maçları bulunamadı." />
      ) : (
        <>
          <section>
            <h3 className="mb-2 px-1 text-sm font-semibold text-white/70">Son Maçlar</h3>
            {fixtures.data.past.length > 0 ? (
              <ul className="overflow-hidden rounded-xl bg-white/[0.03]">
                {fixtures.data.past.map((g) => (
                  <GameRow key={g.id} game={g} team={team} competition={competition} />
                ))}
              </ul>
            ) : (
              <EmptyState message="Bu sezon henüz maç oynamadı." />
            )}
          </section>
          <section>
            <h3 className="mb-2 px-1 text-sm font-semibold text-white/70">Yaklaşan Maçlar</h3>
            {fixtures.data.upcoming.length > 0 ? (
              <ul className="overflow-hidden rounded-xl bg-white/[0.03]">
                {fixtures.data.upcoming.map((g) => (
                  <GameRow key={g.id} game={g} team={team} competition={competition} />
                ))}
              </ul>
            ) : (
              <EmptyState message="Fikstürde yaklaşan maç yok." />
            )}
          </section>
        </>
      )}
    </div>
  )
}

const POSITIONS: { position: 'G' | 'F' | 'C'; label: string }[] = [
  { position: 'G', label: 'Guard' },
  { position: 'F', label: 'Forward' },
  { position: 'C', label: 'Center' },
]

const stat = 'px-1.5 py-2 text-center font-semibold'
const cell = 'px-1.5 py-2 text-center'

function TeamRoster({ leagueId, team }: { leagueId: string; team: BasketballTeamRef }) {
  const squad = useDetailData(`bb-squad:${leagueId}:${team.id}`, () => getSquad(leagueId, team.id))

  if (squad.loading) return <LoadingState rows={10} />
  if (squad.error) return <ErrorState message={squad.error} />
  if (!squad.data || squad.data.length === 0) return <EmptyState message="Bu takımın kadro bilgisi bulunmuyor." />
  const players = squad.data

  return (
    <div className="space-y-5 p-3 sm:p-5">
      <p className="px-1 text-xs text-white/50">{players.length} oyuncu · istatistikler bu sezonun maç başı ortalaması</p>
      {POSITIONS.map(({ position, label }) => {
        const group = players.filter((p) => p.position === position).sort((a, b) => Number(a.number ?? 99) - Number(b.number ?? 99))
        if (group.length === 0) return null
        return (
          <section key={position}>
            <h3 className="mb-2 px-1 text-sm font-semibold text-white/70">
              {label} <span className="font-normal text-white/40">({group.length})</span>
            </h3>
            <div className="overflow-hidden rounded-xl bg-white/[0.03]">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-[11px] text-white/45">
                  <tr>
                    <th className="py-2 pl-3 text-left font-semibold">Oyuncu</th>
                    <th className={stat} title="Oynadığı maç">M</th>
                    <th className={`${stat} hidden sm:table-cell`} title="Maç başı dakika">DK</th>
                    <th className={stat} title="Maç başı sayı">SAY</th>
                    <th className={stat} title="Maç başı ribaund">RİB</th>
                    <th className={`${stat} pr-3`} title="Maç başı asist">AST</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((p) => (
                    <tr key={p.id} className="border-t border-white/5">
                      <td className="max-w-0 py-2 pl-3">
                        <a href={basketballPlayerHref(leagueId, p.id)} className="flex items-center gap-3 hover:text-accent">
                          <span className="w-6 shrink-0 text-center text-sm font-bold text-white/55">{p.number ?? '–'}</span>
                          <PlayerAvatar photo={p.photo ?? undefined} name={p.name} size="base" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{p.name}</span>
                            {p.age !== null && <span className="block text-[11px] text-white/45">{p.age} yaş</span>}
                          </span>
                        </a>
                      </td>
                      {p.stats ? (
                        <>
                          <td className={`${cell} text-white/60`}>{p.stats.games}</td>
                          <td className={`${cell} hidden text-white/60 sm:table-cell`}>{p.stats.minutes}</td>
                          <td className={`${cell} font-bold`}>{p.stats.points}</td>
                          <td className={cell}>{p.stats.rebounds}</td>
                          <td className={`${cell} pr-3`}>{p.stats.assists}</td>
                        </>
                      ) : (
                        // Bu sezon oynamamış
                        <td colSpan={5} className="py-2 pr-3 text-right text-[11px] text-white/35">Bu sezon oynamadı</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
