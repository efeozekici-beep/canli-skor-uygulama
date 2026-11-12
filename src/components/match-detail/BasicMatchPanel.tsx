import { findMatchById } from '../../services/matchService'
import { useFavorites } from '../../hooks/useFavorites'
import MatchHeader from './MatchHeader'
import { EmptyState } from './TabStates'

interface Props {
  matchId: string
  onClose: () => void
}

// API'nin vermediği günlerden gelen maçlar (id "espn-…" / "el-…", ESPN ve EuroLeague listelerinden): ücretsiz
// planda bu maçların olay / kadro / istatistik verisi yok, sadece başlık (skor, saat, takımlar) gösterilir.
export default function BasicMatchPanel({ matchId, onClose }: Props) {
  const match = findMatchById(matchId)
  const { favorites, toggleFavorite } = useFavorites()

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-white/10 bg-pitch-950/95 px-2 py-1.5 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          aria-label="Geri"
          className="grid size-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="min-w-0 flex-1 truncate px-2 text-xs font-medium text-accent">{match ? `${match.region} › ${match.leagueName}` : 'Maç'}</p>
      </div>

      {!match ? (
        <EmptyState message="Maç bulunamadı. Ana sayfada maçın gününe gidip tekrar açabilirsin." />
      ) : (
        <>
          <MatchHeader match={match} events={null} isFavorite={favorites.has(match.id)} onToggleFavorite={() => toggleFavorite(match.id)} />
          <EmptyState message="Bu günün maç ayrıntıları (olaylar, kadrolar, istatistikler) ücretsiz planda yok; sadece skor gösteriliyor." />
        </>
      )}
    </div>
  )
}
