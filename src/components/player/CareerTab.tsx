import type { CareerEntry } from '../../types/player'
import { getPlayerTeams } from '../../services/playerService'
import { useDetailData } from '../../hooks/useDetailData'
import { seasonLabel } from '../../lib/league'
import TeamLogo from '../TeamLogo'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'

// Aynı takımda üst üste geçen sezonları grupla: takım hücresi grubun ilk satırında bir kez çizilir
function groupConsecutive(entries: CareerEntry[]) {
  const groups: CareerEntry[][] = []
  for (const entry of entries) {
    const last = groups[groups.length - 1]
    if (last && last[last.length - 1].team.id === entry.team.id) last.push(entry)
    else groups.push([entry])
  }
  return groups
}

const value = (n: number | null) => (n === null ? '—' : n)

// Kariyer sekmesi: takım geçmişi, yeniden eskiye
export default function CareerTab({ playerId }: { playerId: string }) {
  const career = useDetailData(`career:${playerId}`, () => getPlayerTeams(playerId))

  if (career.loading) return <LoadingState rows={6} />
  if (career.error) return <ErrorState message={career.error} />
  if (!career.data || career.data.length === 0) return <EmptyState message="Bu oyuncu için veri bulunmuyor." />

  const sorted = [...career.data].sort((a, b) => b.season - a.season)
  const th = 'px-2 py-2 font-semibold'
  // ESPN toplam maç vermiyor, ilk 11 veriyor: sütun adı ona göre
  const startsOnly = sorted.every((e) => e.appearances === null) && sorted.some((e) => e.starts != null)
  const games = (e: CareerEntry) => (startsOnly ? (e.starts ?? null) : e.appearances)

  return (
    <div className="p-3 sm:p-5">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-white/45">
          <tr>
            <th className={`${th} text-left`}>Sezon</th>
            <th className={`${th} text-left`}>Takım</th>
            <th className={`${th} hidden text-left sm:table-cell`}>Lig</th>
            <th className={`${th} text-center`} title={startsOnly ? 'İlk 11' : 'Maç'}>
              {startsOnly ? 'İ11' : 'M'}
            </th>
            <th className={`${th} text-center`} title="Gol">G</th>
            <th className={`${th} text-center`} title="Asist">A</th>
          </tr>
        </thead>
        {groupConsecutive(sorted).map((group) => (
          // Her takım dönemi ayrı bir tbody: aralarında ince çizgi
          <tbody key={`${group[0].team.id}-${group[0].season}`} className="border-t border-white/10">
            {group.map((entry, i) => (
              <tr key={`${entry.season}-${entry.team.id}`}>
                <td className="px-2 py-2 text-white/70">{seasonLabel(entry.season)}</td>
                {i === 0 && (
                  <td rowSpan={group.length} className="px-2 py-2 align-top">
                    <span className="flex items-center gap-2 font-medium">
                      <TeamLogo name={entry.team.name} logo={entry.team.logo} size="row" />
                      <span className="truncate">{entry.team.name}</span>
                    </span>
                  </td>
                )}
                <td className="hidden px-2 py-2 text-white/60 sm:table-cell">{entry.league ?? '—'}</td>
                <td className="px-2 py-2 text-center">{value(games(entry))}</td>
                <td className="px-2 py-2 text-center font-semibold">{value(entry.goals)}</td>
                <td className="px-2 py-2 text-center">{value(entry.assists)}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
