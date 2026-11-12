import { Fragment, useState } from 'react'
import type { LeagueStandingRow, StandingsView } from '../../types/league'
import { getStandings, teamsPlayingToday } from '../../services/leagueService'
import { useDetailData } from '../../hooks/useDetailData'
import { rowsForView, translateZone, zoneColor } from '../../lib/league'
import { sameTeamName, teamIdOf } from '../../lib/team'
import TeamLogo from '../TeamLogo'
import LeagueTabs from './LeagueTabs'
import FormBadges from './FormBadges'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'
import { teamHref } from '../../lib/navigation'
import { leagueSourceFor } from '../../config/leagueSources'

interface Props {
  leagueId: string
  season: number
  /** Maç sayfasından açıldıysa o maçın iki takımı (adla eşleştirilir, satırları vurgulanır) */
  highlightTeams?: string[]
}

const VIEWS: { id: StandingsView; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'home', label: 'Ev sahibi' },
  { id: 'away', label: 'Deplasman' },
]

// Tablo tek bir grup içindir; Dünya Kupası gibi turnuvalarda her grup için ayrı çizilir.
function GroupTable({ rows, view, zones, playingToday, highlightTeams, teamLink }: {
  teamLink: (team: { id: string; name: string }) => string
  rows: LeagueStandingRow[]
  view: StandingsView
  zones: Map<string, string>
  playingToday: Set<string>
  highlightTeams: string[]
}) {
  const items = rowsForView(rows, view)
  // Bölgeler sadece genel tabloda anlamlı (ev/deplasman tablosunda sıra farklı)
  const showZones = view === 'all'
  const th = 'px-1.5 py-2 text-center font-semibold'

  return (
    <table className="w-full text-sm tabular-nums">
      <thead className="text-xs text-white/45">
        <tr>
          <th className={`${th} w-10`}>#</th>
          <th className={`${th} text-left`}>Takım</th>
          <th className={th} title="Oynanan">O</th>
          <th className={th} title="Galibiyet">G</th>
          <th className={th} title="Beraberlik">B</th>
          <th className={th} title="Mağlubiyet">M</th>
          <th className={th} title="Averaj">Av</th>
          <th className={`${th} hidden sm:table-cell`} title="Attığı : Yediği">Gol</th>
          <th className={`${th} hidden md:table-cell`}>Son 5</th>
          <th className={th} title="Puan">P</th>
        </tr>
      </thead>
      <tbody>
        {items.map(({ row, split, points, rank }, i) => {
          const description = showZones ? row.description : null
          const previous = showZones && i > 0 ? items[i - 1].row.description : undefined
          // Bölge değiştiğinde (ve açıklama varsa) bölüm başlığı
          const startsZone = description !== null && description !== previous
          const color = description ? zones.get(description) : undefined
          const isMatchTeam = highlightTeams.some((name) => sameTeamName(name, row.team.name))
          // Maç sayfasında "bugün oynuyor" kırmızısı yerine maçın iki takımı vurgulanır
          const isPlayingToday = highlightTeams.length === 0 && (playingToday.has(row.team.id) || playingToday.has(teamIdOf(row.team.name)))
          const diff = split.goalsFor - split.goalsAgainst
          return (
            <Fragment key={row.team.id}>
              {startsZone && (
                <tr>
                  <td colSpan={10} className="px-3 pt-4 pb-1.5 text-xs font-semibold text-white/55">
                    {translateZone(description)}
                  </td>
                </tr>
              )}
              <tr className={`border-t border-white/5 ${isMatchTeam ? 'bg-accent/10 font-semibold' : ''}`}>
                <td className="relative px-1.5 py-2.5 text-center font-semibold">
                  {/* Bölge rengi: sıra numarasının solunda ince çizgi */}
                  {color && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-1 rounded-full" style={{ backgroundColor: color }} />}
                  <span className={isPlayingToday ? 'text-red-400' : ''}>{rank}</span>
                </td>
                <td className="max-w-0 px-1.5 py-2.5">
                  <a href={teamLink(row.team)} className="flex items-center gap-2.5 hover:text-accent">
                    <TeamLogo name={row.team.name} logo={row.team.logo} size="row" />
                    <span className={`truncate font-medium ${isPlayingToday ? 'text-red-400' : ''}`}>{row.team.name}</span>
                    {isPlayingToday && <span title="Bugün maçı var" className="size-1.5 shrink-0 rounded-full bg-red-500" />}
                  </a>
                </td>
                <td className="px-1.5 py-2.5 text-center text-white/75">{split.played}</td>
                <td className="px-1.5 py-2.5 text-center text-white/75">{split.win}</td>
                <td className="px-1.5 py-2.5 text-center text-white/75">{split.draw}</td>
                <td className="px-1.5 py-2.5 text-center text-white/75">{split.lose}</td>
                <td className="px-1.5 py-2.5 text-center text-white/75">{diff > 0 ? `+${diff}` : diff}</td>
                <td className="hidden px-1.5 py-2.5 text-center text-white/75 sm:table-cell">
                  {split.goalsFor}:{split.goalsAgainst}
                </td>
                <td className="hidden px-1.5 py-2.5 text-center md:table-cell">
                  {view === 'all' ? <FormBadges form={row.form} /> : <span className="text-white/30">—</span>}
                </td>
                <td className="px-1.5 py-2.5 text-center font-bold">{points}</td>
              </tr>
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

// Puan Durumu sekmesi: Tümü / Ev sahibi / Deplasman, bölge grupları ve renk açıklaması
export default function StandingsTable({ leagueId, season, highlightTeams = [] }: Props) {
  const [view, setView] = useState<StandingsView>('all')
  const standings = useDetailData(`standings:${leagueId}:${season}`, () => getStandings(leagueId, season))

  if (standings.loading) return <LoadingState rows={10} />
  if (standings.error) return <ErrorState message={standings.error} />
  const groups = standings.data?.groups.filter((g) => g.rows.length > 0) ?? []
  if (groups.length === 0) return <EmptyState message="Bu lig için puan durumu bulunmuyor." />

  // Her bölge açıklamasına bir renk (bütün gruplarda aynı)
  const zones = new Map<string, string>()
  for (const row of groups.flatMap((g) => g.rows)) {
    if (row.description && !zones.has(row.description)) zones.set(row.description, zoneColor(row.description, zones.size))
  }
  const playingToday = highlightTeams.length > 0 ? new Set<string>() : teamsPlayingToday(leagueId)
  // Kaynak ev/deplasman ayrımı vermiyorsa sadece genel tablo
  const hasSplits = standings.data?.hasSplits !== false
  const activeView = hasSplits ? view : 'all'

  return (
    <div className="space-y-4 p-3 sm:p-5">
      {hasSplits && <LeagueTabs tabs={VIEWS} active={view} onChange={setView} label="Tablo türü" variant="pill" />}

      {groups.map((group) => (
        <section key={group.name}>
          {/* Birden fazla grup varsa her tablonun başlığı (Grup A, Grup B...) */}
          {groups.length > 1 && <h3 className="mb-2 px-1 text-sm font-semibold text-white/80">{group.name}</h3>}
          <GroupTable
            rows={group.rows}
            view={activeView}
            zones={zones}
            playingToday={playingToday}
            highlightTeams={highlightTeams}
            teamLink={(team) => teamHref(team, leagueId, leagueSourceFor(leagueId)?.region)}
          />
        </section>
      ))}

      {/* Renk açıklaması */}
      {activeView === 'all' && zones.size > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 px-1 pt-4 text-xs text-white/60">
          {[...zones].map(([description, color]) => (
            <li key={description} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
              {translateZone(description)}
            </li>
          ))}
        </ul>
      )}
      {playingToday.size > 0 && (
        <p className="flex items-center gap-2 px-1 text-xs text-white/50">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-red-500" />
          Bugün maçı olan takımlar
        </p>
      )}
    </div>
  )
}
