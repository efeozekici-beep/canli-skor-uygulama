import { useState } from 'react'
import type { Match } from '../../types/match'
import type { FixtureKind } from '../../types/league'
import { getLeagueFixtures, resolveLeagueMatch } from '../../services/leagueService'
import { useDetailData } from '../../hooks/useDetailData'
import { useFavorites } from '../../hooks/useFavorites'
import MatchRow from '../MatchRow'
import LeagueTabs from './LeagueTabs'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'

interface Props {
  leagueId: string
  season: number
  onSelectMatch: (id: string) => void
}

const KINDS: { id: FixtureKind; label: string }[] = [
  { id: 'results', label: 'Sonuçlar' },
  { id: 'fixtures', label: 'Fikstür' },
]

// Maçları güne göre grupla (liste zaten tarihe göre sıralı geliyor)
function groupByDay(matches: Match[]) {
  const groups: { day: string; matches: Match[] }[] = []
  for (const m of matches) {
    const day = new Date(m.startTime).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })
    const last = groups[groups.length - 1]
    if (last?.day === day) last.matches.push(m)
    else groups.push({ day, matches: [m] })
  }
  return groups
}

// Maçlar sekmesi: Sonuçlar / Fikstür, tarihe göre gruplu; satırlar ana listedeki MatchRow ile aynı.
export default function LeagueFixtures({ leagueId, season, onSelectMatch }: Props) {
  const [kind, setKind] = useState<FixtureKind>('results')
  const data = useDetailData(`${kind}:${leagueId}:${season}`, () => getLeagueFixtures(leagueId, season, kind))
  const { favorites, toggleFavorite } = useFavorites()
  // Başka kaynaktan gelen maçın API-Football karşılığı bulunamazsa satırın altında kısa not
  const [unresolved, setUnresolved] = useState<string | null>(null)

  const openMatch = async (id: string) => {
    const match = data.data?.find((m) => m.id === id)
    if (!match) return
    setUnresolved(null)
    const realId = await resolveLeagueMatch(match).catch(() => null)
    if (realId) onSelectMatch(realId)
    else setUnresolved(id)
  }

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <LeagueTabs tabs={KINDS} active={kind} onChange={setKind} label="Maç türü" variant="pill" />
      {data.loading ? (
        <LoadingState rows={8} />
      ) : data.error ? (
        <ErrorState message={data.error} />
      ) : !data.data || data.data.length === 0 ? (
        <EmptyState message={kind === 'results' ? 'Bu lig için sonuç bulunmuyor.' : 'Bu lig için fikstür bulunmuyor.'} />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white/[0.03]">
          {groupByDay(data.data).map((group) => (
            <section key={group.day}>
              <h3 className="bg-black/25 px-4 py-2 text-xs font-semibold text-white/60 capitalize">{group.day}</h3>
              {group.matches.map((m) => (
                <div key={m.id}>
                  <MatchRow match={m} isFavorite={favorites.has(m.id)} isSelected={false} onToggleFavorite={toggleFavorite} onSelect={openMatch} />
                  {unresolved === m.id && <p className="px-4 pb-2 text-xs text-white/50">Bu maçın detay sayfası şu an açılamıyor.</p>}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
