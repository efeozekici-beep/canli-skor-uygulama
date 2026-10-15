import { useEffect, useState } from 'react'
import { getEvents, getMatchDetail } from '../../services/matchDetailService'
import { useDetailData } from '../../hooks/useDetailData'
import { useFavorites } from '../../hooks/useFavorites'
import MatchHeader from './MatchHeader'
import DetailTabs, { type DetailTab } from './DetailTabs'
import EventsTab from './EventsTab'
import LineupsTab from './LineupsTab'
import StatsTab from './StatsTab'
import StandingsTab from './StandingsTab'
import FormH2HTab from './FormH2HTab'
import MediaTab from './MediaTab'
import { EmptyState, ErrorState, LoadingState } from './TabStates'

interface Props {
  matchId: string
  /** panel: listenin yanında / mobilde tam ekran. page: /mac/:id tam sayfa */
  variant: 'panel' | 'page'
  onClose: () => void
}

export default function MatchDetailPanel({ matchId, variant, onClose }: Props) {
  const [tab, setTab] = useState<DetailTab>('details')
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(null)
  const { favorites, toggleFavorite } = useFavorites()

  // Başlıktaki skor/dakika için her dakika maçı yeniden oku (ağ isteği atmaz, listenin önbelleğinden okur).
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const detailQuery = useDetailData(`detail:${matchId}:${tick}`, () => getMatchDetail(matchId))
  const detail = detailQuery.data ?? detailQuery.previous
  // Gol atanlar başlıkta da gösterildiği için olaylar en başta yüklenir (Ayrıntılar sekmesiyle aynı önbellek).
  const events = useDetailData(`events:${matchId}`, () => getEvents(matchId))

  // Maçın Adamı kartına tıklanınca: Kadrolar sekmesine geç ve oyuncuyu vurgula
  const showPlayer = (playerId: string) => {
    setHighlightedPlayerId(playerId)
    setTab('lineups')
  }

  const backButton = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Geri"
      className={`grid size-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white ${variant === 'panel' ? 'lg:hidden' : ''}`}
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
        <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )

  return (
    <div className="flex min-h-full flex-col">
      {/* Üst çubuk: geri butonu (mobil), lig bilgisi, kapat (masaüstü) */}
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-white/10 bg-pitch-950/95 px-2 py-1.5 backdrop-blur">
        {backButton}
        <p className="min-w-0 flex-1 truncate px-2 text-xs font-medium text-accent">
          {detail ? `${detail.match.region} › ${detail.match.leagueName}${detail.round ? ` · ${detail.round}` : ''}` : 'Maç detayı'}
        </p>
        {variant === 'panel' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Detayı kapat"
            className="hidden size-10 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white lg:grid"
          >
            ✕
          </button>
        )}
      </div>

      {detailQuery.loading && !detail ? (
        <LoadingState rows={6} />
      ) : detailQuery.error && !detail ? (
        <ErrorState message={detailQuery.error} />
      ) : !detail ? (
        <EmptyState message="Maç bulunamadı." />
      ) : (
        <>
          <MatchHeader
            match={detail.match}
            events={events.data}
            isFavorite={favorites.has(matchId)}
            onToggleFavorite={() => toggleFavorite(matchId)}
            fullPageHref={variant === 'panel' ? `#/mac/${matchId}` : undefined}
          />
          <DetailTabs active={tab} onChange={setTab} />

          {/* Sadece aktif sekme ekranda; verisi de ilk açıldığında yüklenir */}
          <div role="tabpanel" className="flex-1">
            {tab === 'details' && <EventsTab match={detail.match} onPlayerSelect={showPlayer} />}
            {tab === 'lineups' && <LineupsTab match={detail.match} highlightedPlayerId={highlightedPlayerId} />}
            {tab === 'stats' && <StatsTab match={detail.match} />}
            {tab === 'standings' && <StandingsTab match={detail.match} />}
            {tab === 'matches' && <FormH2HTab match={detail.match} />}
            {tab === 'media' && <MediaTab />}
          </div>
        </>
      )}
    </div>
  )
}
