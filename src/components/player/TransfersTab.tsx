import type { PlayerTransfer } from '../../types/player'
import { getPlayerTransfers } from '../../services/playerService'
import { useDetailData } from '../../hooks/useDetailData'
import TeamLogo from '../TeamLogo'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'

// Transfer türü etiketi. Bedel bilinmiyorsa boş kalır (uydurulmaz).
function TypeBadge({ transfer }: { transfer: PlayerTransfer }) {
  if (transfer.kind === 'fee') return <span className="font-semibold text-accent">{transfer.fee}</span>
  if (transfer.kind === 'loan') return <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-xs font-semibold text-sky-300">Kiralık</span>
  if (transfer.kind === 'free') return <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/70">Serbest</span>
  return null
}

function Team({ name, logo }: { name: string; logo?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <TeamLogo name={name} logo={logo} size="row" />
      <span className="truncate font-medium">{name}</span>
    </span>
  )
}

// Transferler sekmesi: tarih, hangi takımdan hangi takıma, tür / bedel
export default function TransfersTab({ playerId }: { playerId: string }) {
  const transfers = useDetailData(`transfers:${playerId}`, () => getPlayerTransfers(playerId))

  if (transfers.loading) return <LoadingState rows={5} />
  if (transfers.error) return <ErrorState message={transfers.error} />
  if (!transfers.data || transfers.data.length === 0) return <EmptyState message="Bu oyuncu için veri bulunmuyor." />

  return (
    <ol className="space-y-2 p-3 sm:p-5">
      {[...transfers.data]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((t) => (
          <li key={`${t.date}-${t.from.id}-${t.to.id}`} className="rounded-xl bg-white/[0.03] px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-white/50">
              <time dateTime={t.date}>{new Date(t.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
              <TypeBadge transfer={t} />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-sm">
              <Team name={t.from.name} logo={t.from.logo} />
              <span aria-label="takımına" className="text-white/40">→</span>
              <Team name={t.to.name} logo={t.to.logo} />
            </div>
          </li>
        ))}
    </ol>
  )
}
