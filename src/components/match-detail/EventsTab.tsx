import { Fragment } from 'react'
import type { Match } from '../../types/match'
import type { MatchEvent } from '../../types/matchDetail'
import { getEvents, getPlayerStats } from '../../services/matchDetailService'
import { useDetailData } from '../../hooks/useDetailData'
import { getManOfTheMatch } from '../../lib/ratings'
import { isGoal, minuteText } from '../../lib/events'
import { abbreviateName } from '../../lib/team'
import EventIcon from './EventIcon'
import ManOfTheMatchCard from './ManOfTheMatchCard'
import { EmptyState, ErrorState, LoadingState } from './TabStates'
import { t } from '../../i18n'

interface Props {
  match: Match
  onPlayerSelect: (playerId: string) => void
}

// Olayın açıklama satırı: asist, oyundan çıkan oyuncu, penaltı/kendi kalesine notu
function subtitle(e: MatchEvent) {
  if (e.kind === 'sub') return e.secondPlayer ? t('Çıkan: {name}', { name: e.secondPlayer }) : null
  if (e.kind === 'penalty') return t('Penaltı (P)')
  if (e.kind === 'own-goal') return t('Kendi kalesine (OG)')
  if (e.kind === 'missed-penalty') return t('Kaçan penaltı')
  if (e.kind === 'goal' && e.secondPlayer) return t('Asist: {name}', { name: e.secondPlayer })
  return null
}

function Divider({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-3 py-2 text-xs font-semibold text-white/55">
      <span className="h-px flex-1 bg-white/10" />
      {label}
      <span className="h-px flex-1 bg-white/10" />
    </li>
  )
}

export default function EventsTab({ match, onPlayerSelect }: Props) {
  const events = useDetailData(`events:${match.id}`, () => getEvents(match.id))
  // Reytingler maç başladıktan sonra var; başlamadıysa hiç istek atma.
  const players = useDetailData(match.status === 'upcoming' ? null : `players:${match.id}`, () => getPlayerStats(match.id))

  const best = players.data ? getManOfTheMatch(players.data) : null

  if (events.loading) return <LoadingState />
  if (events.error) return <ErrorState message={events.error} />
  if (!events.data) return <EmptyState message={t('Bu maç için olay verisi yok.')} />

  // Dakikaya göre sırala ve her golden sonraki skoru hesapla
  const sorted = [...events.data].sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0))
  const score = { home: 0, away: 0 }
  const rows = sorted.map((e) => {
    if (isGoal(e)) score[e.side]++
    return { event: e, scoreAfter: isGoal(e) ? `${score.home} - ${score.away}` : null }
  })

  // Devre arası çizgisi: ilk yarı olaylarından sonra
  const firstHalfCount = sorted.filter((e) => e.minute <= 45).length
  const halfTimeScore = sorted.slice(0, firstHalfCount).reduce(
    (s, e) => (isGoal(e) ? { ...s, [e.side]: s[e.side] + 1 } : s),
    { home: 0, away: 0 },
  )
  const pastHalfTime = match.status === 'finished' || (match.minute ?? 0) > 45

  return (
    <div className="space-y-4 p-4">
      {best && (
        <ManOfTheMatchCard
          player={best}
          teamName={best.side === 'home' ? match.homeTeam : match.awayTeam}
          live={match.status === 'live'}
          onClick={() => onPlayerSelect(best.playerId)}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState message={match.status === 'upcoming' ? t('Maç henüz başlamadı.') : t('Henüz olay yok.')} />
      ) : (
        <ol className="space-y-1">
          {rows.map(({ event: e, scoreAfter }, i) => {
            const content = (
              <span className={`flex items-center gap-2 ${e.side === 'home' ? 'flex-row-reverse text-right' : ''}`}>
                <EventIcon kind={e.kind} />
                <span className="min-w-0">
                  {/* Skor rozeti adın dışında: ad kısaltılsa da rozet kesilmez */}
                  <span className={`flex items-center gap-2 ${e.side === 'home' ? 'flex-row-reverse' : ''}`}>
                    <span className="truncate text-sm font-semibold">
                      <span className="sm:hidden">{abbreviateName(e.player)}</span>
                      <span className="hidden sm:inline">{e.player}</span>
                    </span>
                    {scoreAfter && <span className="shrink-0 rounded bg-accent/15 px-1.5 text-xs text-accent tabular-nums">{scoreAfter}</span>}
                  </span>
                  {subtitle(e) && <span className="block truncate text-xs text-white/55">{subtitle(e)}</span>}
                </span>
              </span>
            )
            return (
              <Fragment key={e.id}>
                {i === firstHalfCount && pastHalfTime && <Divider label={`${t('İY')} ${halfTimeScore.home} - ${halfTimeScore.away}`} />}
                <li className="grid grid-cols-[1fr_3.5rem_1fr] items-center gap-2 rounded-lg py-1.5 hover:bg-white/[0.03]">
                  <div className="min-w-0">{e.side === 'home' && content}</div>
                  <div className="text-center">
                    <span className="inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold tabular-nums">{minuteText(e)}</span>
                  </div>
                  <div className="min-w-0">{e.side === 'away' && content}</div>
                </li>
              </Fragment>
            )
          })}
          {/* Tüm olaylar ilk yarıdaysa çizgiyi sona koy */}
          {firstHalfCount === rows.length && pastHalfTime && <Divider label={`${t('İY')} ${halfTimeScore.home} - ${halfTimeScore.away}`} />}
          {match.status === 'finished' && <Divider label={`MS ${match.homeScore} - ${match.awayScore}`} />}
        </ol>
      )}
    </div>
  )
}
