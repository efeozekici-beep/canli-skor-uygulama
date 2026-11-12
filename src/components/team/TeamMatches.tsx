import { useState } from 'react'
import type { Match } from '../../types/match'
import type { TeamInfo } from '../../types/team'
import { getTeamMatches, getTeamStats } from '../../services/teamService'
import { resolveLeagueMatch } from '../../services/leagueService'
import { useDetailData } from '../../hooks/useDetailData'
import { useFavorites } from '../../hooks/useFavorites'
import { sameTeamName } from '../../lib/team'
import MatchRow from '../MatchRow'
import TeamStatsCard from './TeamStatsCard'
import ResultBadge from './ResultBadge'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'

const dayLabel = (m: Match) =>
  new Date(m.startTime).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' })

// Takımın bu maçtaki sonucu (ev sahibi mi deplasman mı adından anlaşılır)
function resultFor(m: Match, teamName: string): 'W' | 'D' | 'L' | null {
  if (m.homeScore === null || m.awayScore === null) return null
  const isHome = sameTeamName(m.homeTeam, teamName)
  const own = isHome ? m.homeScore : m.awayScore
  const other = isHome ? m.awayScore : m.homeScore
  return own > other ? 'W' : own === other ? 'D' : 'L'
}

// Maçlar sekmesi: üstte sezon özeti, altında son 10 maç (sonuç rozetiyle) ve yaklaşan 10 maç (ESPN takvimi).
// Satıra tıklayınca maçın API-Football karşılığı bulunup maç sayfası açılır.
export default function TeamMatches({ team, leagueId, onSelectMatch }: { team: TeamInfo; leagueId: string; onSelectMatch: (id: string) => void }) {
  const matches = useDetailData(`team-matches:${team.id}:${leagueId}`, () => getTeamMatches(team, leagueId))
  const stats = useDetailData(`team-stats:${team.id}:${leagueId}`, () => getTeamStats(team, leagueId))
  const { favorites, toggleFavorite } = useFavorites()
  const [unresolved, setUnresolved] = useState<string | null>(null)

  const all = matches.data ?? []
  const past = all.filter((m) => m.status === 'finished').reverse().slice(0, 10)
  const upcoming = all.filter((m) => m.status !== 'finished').slice(0, 10)

  const open = async (id: string) => {
    const match = all.find((m) => m.id === id)
    if (!match) return
    setUnresolved(null)
    const realId = await resolveLeagueMatch(match).catch(() => null)
    if (realId) onSelectMatch(realId)
    else setUnresolved(id)
  }

  const list = (items: Match[], withResult: boolean) => (
    <ul className="overflow-hidden rounded-xl bg-white/[0.03]">
      {items.map((m) => {
        const result = withResult ? resultFor(m, team.name) : null
        return (
          <li key={m.id} className="border-t border-white/5 first:border-t-0">
            <p className="flex items-center gap-2 px-4 pt-2 text-[11px] font-semibold text-white/50 capitalize">
              {result && <ResultBadge result={result} />}
              {dayLabel(m)}
            </p>
            <MatchRow match={m} isFavorite={favorites.has(m.id)} isSelected={false} onToggleFavorite={toggleFavorite} onSelect={open} />
            {unresolved === m.id && <p className="px-4 pb-2 text-xs text-white/50">Bu maçın detay sayfası şu an açılamıyor.</p>}
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="space-y-5 p-3 sm:p-5">
      {stats.data && <TeamStatsCard stats={stats.data} unit="gol" />}
      {matches.loading ? (
        <LoadingState rows={8} />
      ) : matches.error ? (
        <ErrorState message={matches.error} />
      ) : all.length === 0 ? (
        <EmptyState message="Bu sezonun maçları bulunamadı." />
      ) : (
        <>
          <section>
            <h3 className="mb-2 px-1 text-sm font-semibold text-white/70">Son Maçlar</h3>
            {past.length > 0 ? list(past, true) : <EmptyState message="Bu sezon henüz maç oynamadı." />}
          </section>
          <section>
            <h3 className="mb-2 px-1 text-sm font-semibold text-white/70">Yaklaşan Maçlar</h3>
            {upcoming.length > 0 ? list(upcoming, false) : <EmptyState message="Fikstürde yaklaşan maç yok." />}
          </section>
        </>
      )}
    </div>
  )
}
