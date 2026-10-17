import type { Match } from '../../types/match'
import { getStandings } from '../../services/matchDetailService'
import { useDetailData } from '../../hooks/useDetailData'
import { matchTeamIds } from '../../lib/team'
import { currentSeasonFor } from '../../lib/league'
import { leagueSourceFor } from '../../config/leagueSources'
import TeamLogo from '../TeamLogo'
import StandingsTable from '../league/StandingsTable'
import { EmptyState, ErrorState, LoadingState } from './TabStates'

// Ligin puan tablosu; bu maçtaki iki takımın satırı vurgulanır.
// API-Football'un ücretsiz planı bu sezonu vermediği için kaynağı olan liglerde (ESPN / football-data)
// lig sayfasındaki tablo kullanılır; diğerlerinde eski API-Football tablosu.
export default function StandingsTab({ match }: { match: Match }) {
  if (leagueSourceFor(match.leagueId)) {
    return <StandingsTable leagueId={match.leagueId} season={match.season ?? currentSeasonFor()} highlightTeams={[match.homeTeam, match.awayTeam]} />
  }
  return <ApiFootballStandings match={match} />
}

function ApiFootballStandings({ match }: { match: Match }) {
  const ids = matchTeamIds(match)
  const standings = useDetailData(`standings:${match.leagueId}:${match.season ?? ''}`, () =>
    getStandings(match.leagueId, match.season, [ids.home, ids.away]),
  )

  if (standings.loading) return <LoadingState rows={8} />
  if (standings.error) return <ErrorState message={standings.error} />
  if (!standings.data) return <EmptyState message="Bu lig için puan durumu verisi yok." />
  const highlighted = new Set([ids.home, ids.away])
  const th = 'px-1.5 py-2 text-center font-semibold'

  return (
    <div className="p-2 sm:p-4">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-white/50">
          <tr>
            <th className={th}>#</th>
            <th className={`${th} text-left`}>Takım</th>
            <th className={th} title="Oynanan">O</th>
            <th className={th} title="Galibiyet">G</th>
            <th className={th} title="Beraberlik">B</th>
            <th className={th} title="Mağlubiyet">M</th>
            <th className={th} title="Averaj">A</th>
            <th className={th} title="Puan">P</th>
          </tr>
        </thead>
        <tbody>
          {standings.data.rows.map((row) => {
            const isMatchTeam = highlighted.has(row.team.id)
            return (
              <tr key={row.team.id} className={`border-t border-white/5 ${isMatchTeam ? 'bg-accent/10 font-semibold' : ''}`}>
                <td className="px-1.5 py-2 text-center">
                  <span className={`inline-grid size-6 place-items-center rounded-full text-xs ${isMatchTeam ? 'bg-accent text-pitch-950' : 'text-white/60'}`}>
                    {row.rank}
                  </span>
                </td>
                <td className="max-w-0 px-1.5 py-2">
                  <span className="flex items-center gap-2">
                    <TeamLogo name={row.team.name} logo={row.team.logo} />
                    <span className="truncate">{row.team.name}</span>
                  </span>
                </td>
                <td className="px-1.5 py-2 text-center text-white/70">{row.played}</td>
                <td className="px-1.5 py-2 text-center text-white/70">{row.win}</td>
                <td className="px-1.5 py-2 text-center text-white/70">{row.draw}</td>
                <td className="px-1.5 py-2 text-center text-white/70">{row.lose}</td>
                <td className="px-1.5 py-2 text-center text-white/70">{row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}</td>
                <td className="px-1.5 py-2 text-center font-bold">{row.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
