import type { ReactNode } from 'react'
import type { Match } from '../../types/match'
import type { PastMatch } from '../../types/matchDetail'
import { getH2H } from '../../services/matchDetailService'
import { useDetailData } from '../../hooks/useDetailData'
import { matchTeamIds } from '../../lib/team'
import TeamLogo from '../TeamLogo'
import { EmptyState, ErrorState, LoadingState } from './TabStates'
import { locale, t } from '../../i18n'

type Result = 'G' | 'B' | 'M'

// Bir takımın gözünden maç sonucu: Galibiyet / Beraberlik / Mağlubiyet
function resultFor(m: PastMatch, teamId: string): Result {
  const own = m.home.id === teamId ? m.homeScore : m.awayScore
  const other = m.home.id === teamId ? m.awayScore : m.homeScore
  return own > other ? 'G' : own === other ? 'B' : 'M'
}

const RESULT_STYLE: Record<Result, string> = {
  G: 'bg-accent text-pitch-950',
  B: 'bg-white/25 text-white',
  M: 'bg-red-500 text-onaccent',
}

function ResultBadge({ result }: { result: Result }) {
  return <span className={`grid size-6 place-items-center rounded-md text-xs font-bold ${RESULT_STYLE[result]}`}>{result}</span>
}

function PastMatchRow({ match, teamId }: { match: PastMatch; teamId?: string }) {
  const date = new Date(match.date).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: '2-digit' })
  return (
    <li className="grid grid-cols-[4.5rem_1fr_auto_auto] items-center gap-3 px-3 py-2">
      <span className="text-xs text-white/50 tabular-nums">
        {date}
        <span className="block truncate">{match.leagueName}</span>
      </span>
      <span className="min-w-0 space-y-1 text-sm">
        <span className="flex items-center gap-2">
          <TeamLogo name={match.home.name} logo={match.home.logo} />
          <span className="truncate">{match.home.name}</span>
        </span>
        <span className="flex items-center gap-2">
          <TeamLogo name={match.away.name} logo={match.away.logo} />
          <span className="truncate">{match.away.name}</span>
        </span>
      </span>
      <span className="space-y-1 text-right text-sm font-bold tabular-nums">
        <span className="block">{match.homeScore}</span>
        <span className="block">{match.awayScore}</span>
      </span>
      {teamId ? <ResultBadge result={resultFor(match, teamId)} /> : <span />}
    </li>
  )
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white/80">{title}</h3>
        {aside}
      </div>
      <ul className="divide-y divide-white/5 rounded-xl bg-white/[0.03]">{children}</ul>
    </section>
  )
}

// İki takımın son 5 maçı ve aralarındaki geçmiş maçlar
export default function FormH2HTab({ match }: { match: Match }) {
  const ids = matchTeamIds(match)
  const data = useDetailData(`h2h:${ids.home}:${ids.away}`, () => getH2H(ids.home, ids.away))

  if (data.loading) return <LoadingState rows={8} />
  if (data.error) return <ErrorState message={data.error} />
  if (!data.data) return <EmptyState message={t('Bu takımlar için geçmiş maç verisi yok.')} />
  const { homeLast, awayLast, h2h } = data.data

  const form = (list: PastMatch[], teamId: string) => (
    <span className="flex gap-1">
      {list.map((m) => (
        <ResultBadge key={m.id} result={resultFor(m, teamId)} />
      ))}
    </span>
  )

  // Aralarındaki maçların özeti: ev sahibi galibiyeti / beraberlik / deplasman galibiyeti
  const summary = h2h.reduce(
    (s, m) => {
      const r = resultFor(m, ids.home)
      return { ...s, [r]: s[r] + 1 }
    },
    { G: 0, B: 0, M: 0 },
  )

  return (
    <div className="space-y-6 p-4">
      {homeLast.length > 0 && (
        <Section title={`${match.homeTeam} · ${t('son 5 maç')}`} aside={form(homeLast, ids.home)}>
          {homeLast.map((m) => (
            <PastMatchRow key={m.id} match={m} teamId={ids.home} />
          ))}
        </Section>
      )}
      {awayLast.length > 0 && (
        <Section title={`${match.awayTeam} · ${t('son 5 maç')}`} aside={form(awayLast, ids.away)}>
          {awayLast.map((m) => (
            <PastMatchRow key={m.id} match={m} teamId={ids.away} />
          ))}
        </Section>
      )}
      {homeLast.length === 0 && awayLast.length === 0 && (
        <p className="rounded-xl bg-white/[0.03] px-4 py-3 text-xs text-white/55">
          Takımların son 5 maçı ücretsiz API-Football planında alınamıyor; şimdilik sadece aralarındaki maçlar gösteriliyor.
        </p>
      )}
      <Section
        title={t('Aralarındaki maçlar')}
        aside={
          <span className="text-xs text-white/60 tabular-nums">
            {match.homeTeam} {summary.G} · Beraberlik {summary.B} · {match.awayTeam} {summary.M}
          </span>
        }
      >
        {h2h.length === 0 ? <li className="px-3 py-4 text-sm text-white/55">{t('Daha önce karşılaşmadılar.')}</li> : h2h.map((m) => <PastMatchRow key={m.id} match={m} />)}
      </Section>
    </div>
  )
}
