import type { PlayerTrophy } from '../../types/player'
import { getPlayerTrophies } from '../../services/playerService'
import { useDetailData } from '../../hooks/useDetailData'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'
import { t } from '../../i18n'

const PLACE: Record<PlayerTrophy['place'], { label: string; className: string; icon: string }> = {
  winner: { label: 'Şampiyon', className: 'bg-amber-400/15 text-amber-300', icon: '🏆' },
  runnerup: { label: 'İkinci', className: 'bg-slate-300/15 text-slate-200', icon: '🥈' },
  other: { label: '', className: 'bg-white/10 text-white/70', icon: '🏅' },
}

// Kupalar sekmesi: turnuva, sezon ve derece; şampiyonluklar önce, sonra yeniden eskiye
export default function TrophiesTab({ playerId }: { playerId: string }) {
  const trophies = useDetailData(`trophies:${playerId}`, () => getPlayerTrophies(playerId))

  if (trophies.loading) return <LoadingState rows={5} />
  if (trophies.error) return <ErrorState message={trophies.error} />
  if (!trophies.data || trophies.data.length === 0) return <EmptyState message={t('Bu oyuncu için veri bulunmuyor.')} />

  const order = { winner: 0, runnerup: 1, other: 2 }
  const sorted = [...trophies.data].sort((a, b) => order[a.place] - order[b.place] || b.season.localeCompare(a.season))
  const wins = trophies.data.filter((tr) => tr.place === 'winner').length

  return (
    <div className="space-y-3 p-3 sm:p-5">
      <p className="text-sm text-white/60">
        Toplam <span className="font-semibold text-white">{wins}</span> şampiyonluk
      </p>
      <ul className="space-y-2">
        {sorted.map((tr) => {
          const place = PLACE[tr.place]
          return (
            <li key={`${tr.competition}-${tr.season}-${tr.place}`} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3">
              <span aria-hidden="true" className="text-xl">
                {place.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{tr.competition}</span>
                <span className="block text-xs text-white/50">
                  {[tr.country, tr.season].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${place.className}`}>{t(place.label) || tr.placeLabel}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
