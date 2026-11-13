import type { Match } from '../../types/match'
import { getLeagueStandings } from '../../services/basketballService'
import { useDetailData } from '../../hooks/useDetailData'
import { zoneColor } from '../../lib/league'
import TeamLogo from '../TeamLogo'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'
import { sameTeamName } from '../../lib/team'
import { basketballTeamHref } from '../../lib/navigation'
import { hasBasketballTeamPage } from '../../services/basketballTeamService'
import { ab, t } from '../../i18n'

// Bölge rengi: play-off yeşil, play-in sarı, diğerleri genel kurala göre
const colorFor = (description: string, index: number) =>
  /play-?in/i.test(description) ? '#eab308' : /play-?off/i.test(description) ? '#22c55e' : zoneColor(description, index)

// Basketbol puan durumu (API-Basketball): beraberlik yok; G, M, galibiyet yüzdesi, atılan/yenilen sayı
export default function BasketballStandingsTab({ match }: { match: Match }) {
  if (!match.basketball?.season) return <EmptyState message={t('Bu lig için puan durumu bulunmuyor.')} />
  return (
    <BasketballStandingsTable
      leagueId={match.leagueId}
      season={match.basketball.season}
      highlightIds={[match.homeTeamId, match.awayTeamId]}
      highlightNames={[match.homeTeam, match.awayTeam]}
    />
  )
}

// Puan tablosu: maç sayfasında (maçın takımları vurgulu) ve basketbol lig sayfasında kullanılır
export function BasketballStandingsTable({ leagueId, season, highlightIds = [], highlightNames = [] }: {
  leagueId: string
  season: string
  highlightIds?: (string | undefined)[]
  highlightNames?: string[]
}) {
  const standings = useDetailData(`bb-standings:${leagueId}:${season}`, () => getLeagueStandings(leagueId, season))

  if (standings.loading) return <LoadingState rows={8} />
  if (standings.error) return <ErrorState message={standings.error} />
  if (!standings.data) return <EmptyState message={t('Bu lig için puan durumu bulunmuyor.')} />

  const highlighted = new Set(highlightIds)
  const descriptions = [...new Set(standings.data.groups.flatMap((g) => g.rows.map((r) => r.description)).filter((d): d is string => d !== null))]
  const th = 'px-1.5 py-2 text-center font-semibold'

  return (
    <div className="space-y-5 p-3 sm:p-5">
      {standings.data.groups.map((group) => (
        <section key={group.name}>
          {standings.data!.groups.length > 1 && <h3 className="mb-2 px-1 text-sm font-semibold text-white/80">{t(group.name)}</h3>}
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-white/45">
              <tr>
                <th className={`${th} w-10`}>#</th>
                <th className={`${th} text-left`}>{t('Takım')}</th>
                <th className={th} title={t('Oynanan')}>{ab('O', 'P', 'Sp')}</th>
                <th className={th} title={t('Galibiyet')}>{ab('G', 'W', 'S')}</th>
                <th className={th} title={t('Mağlubiyet')}>{ab('M', 'L', 'N')}</th>
                <th className={th} title={t('Galibiyet yüzdesi')}>%</th>
                <th className={`${th} hidden sm:table-cell`} title={t('Atılan : yenilen sayı')}>{t('Sayı')}</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => {
                // NBA / EuroLeague tablosu başka kaynaktan: id tutmaz, adla eşleştirilir
                const isMatchTeam = highlighted.has(row.team.id) || highlightNames.some((name) => sameTeamName(row.team.name, name))
                const color = row.description ? colorFor(row.description, descriptions.indexOf(row.description)) : undefined
                return (
                  <tr key={row.team.id} className={`border-t border-white/5 ${isMatchTeam ? 'bg-accent/10 font-semibold' : ''}`}>
                    <td className="relative px-1.5 py-2.5 text-center">
                      {color && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-1 rounded-full" style={{ backgroundColor: color }} />}
                      {row.rank}
                    </td>
                    <td className="max-w-0 px-1.5 py-2.5">
                      {/* NBA / EuroLeague / EuroCup'ta takım sayfası var */}
                      <a
                        href={hasBasketballTeamPage(leagueId) ? basketballTeamHref(leagueId, { id: row.team.id.replace(/^(espn|el)-/, ''), name: row.team.name }) : undefined}
                        className="flex items-center gap-2.5 [&[href]]:hover:text-accent"
                      >
                        <TeamLogo name={row.team.name} logo={row.team.logo} size="row" />
                        <span className="truncate">{row.team.name}</span>
                      </a>
                    </td>
                    <td className="px-1.5 py-2.5 text-center text-white/75">{row.played}</td>
                    <td className="px-1.5 py-2.5 text-center">{row.won}</td>
                    <td className="px-1.5 py-2.5 text-center text-white/75">{row.lost}</td>
                    <td className="px-1.5 py-2.5 text-center font-bold">{row.winPct !== null ? row.winPct.toFixed(3).replace(/^0/, '') : '–'}</td>
                    <td className="hidden px-1.5 py-2.5 text-center text-white/75 sm:table-cell">
                      {row.pointsFor}:{row.pointsAgainst}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ))}

      {descriptions.length > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 px-1 pt-4 text-xs text-white/60">
          {descriptions.map((d, i) => (
            <li key={d} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: colorFor(d, i) }} />
              {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
