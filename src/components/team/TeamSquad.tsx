import type { SquadPosition, TeamInfo } from '../../types/team'
import { getSquad } from '../../services/teamService'
import { getCurrentCoach } from '../../services/matchDetailService'
import { useDetailData } from '../../hooks/useDetailData'
import PlayerAvatar from '../common/PlayerAvatar'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'
import { playerHref } from '../../lib/navigation'

const GROUPS: { position: SquadPosition; label: string }[] = [
  { position: 'G', label: 'Kaleciler' },
  { position: 'D', label: 'Defans' },
  { position: 'M', label: 'Orta saha' },
  { position: 'F', label: 'Forvet' },
]

// Güncel kadro (API-Football), mevkiye göre gruplu. Oyuncuya tıklayınca oyuncu sayfası açılır.
export default function TeamSquad({ team }: { team: TeamInfo }) {
  const squad = useDetailData(`squad:${team.id}`, () => getSquad(team.id))
  const coach = useDetailData(`coach:${team.id}`, () => getCurrentCoach(team.id))

  if (squad.loading) return <LoadingState rows={10} />
  if (squad.error) return <ErrorState message={squad.error} />
  if (!squad.data || squad.data.length === 0) return <EmptyState message="Bu takımın kadro bilgisi bulunmuyor." />
  const players = squad.data

  return (
    <div className="space-y-5 p-3 sm:p-5">
      <p className="px-1 text-xs text-white/50">{players.length} oyuncu</p>
      {coach.data && (
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
          <PlayerAvatar photo={coach.data.photo} name={coach.data.name} size="md" />
          <p className="min-w-0 text-sm">
            <span className="block text-xs text-white/50">Teknik direktör</span>
            <span className="block truncate font-semibold">{coach.data.name}</span>
          </p>
        </div>
      )}

      {GROUPS.map(({ position, label }) => {
        const group = players.filter((p) => p.position === position).sort((a, b) => (a.number ?? 99) - (b.number ?? 99))
        if (group.length === 0) return null
        return (
          <section key={position}>
            <h3 className="mb-2 px-1 text-sm font-semibold text-white/70">
              {label} <span className="font-normal text-white/40">({group.length})</span>
            </h3>
            <ul className="divide-y divide-white/5 overflow-hidden rounded-xl bg-white/[0.03]">
              {group.map((p) => (
                <li key={p.id}>
                  <a href={playerHref(p.id, team.name)} className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.05]">
                    <span className="w-6 text-center text-sm font-bold text-white/55 tabular-nums">{p.number ?? '–'}</span>
                    <PlayerAvatar photo={p.photo} name={p.name} size="base" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                    {p.age !== null && <span className="text-xs text-white/45 tabular-nums">{p.age} yaş</span>}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
