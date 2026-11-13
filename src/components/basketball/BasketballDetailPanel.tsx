import { useState } from 'react'
import { findMatchById } from '../../services/matchService'
import { findBasketballGame, isNbaMatch } from '../../services/basketballService'
import { useDetailData } from '../../hooks/useDetailData'
import { useFavorites } from '../../hooks/useFavorites'
import MatchHeader from '../match-detail/MatchHeader'
import LeagueTabs from '../league/LeagueTabs'
import QuarterScores from './QuarterScores'
import BoxScoreTab from './BoxScoreTab'
import BasketballStatsTab from './BasketballStatsTab'
import BasketballStandingsTab from './BasketballStandingsTab'
import { EmptyState, LoadingState } from '../match-detail/TabStates'
import { locale, t } from '../../i18n'
import MatchChat from '../match-detail/MatchChat'

type Tab = 'summary' | 'chat' | 'stats' | 'box' | 'standings'

interface Props {
  matchId: string
  onClose: () => void
}

// Basketbol maç sayfası. Temel bilgi (skor, çeyrekler) API-Basketball'dan hemen gösterilir.
// İstatistikler (takım) bütün liglerde API-Basketball'dan; Box Score NBA'da API-NBA'dan, diğer liglerde
// API-Basketball'dan — her sekmenin verisi sekme açılınca çekilir.
export default function BasketballDetailPanel({ matchId, onClose }: Props) {
  // Önce listenin zaten bildiği maç (anında), yoksa dün/bugün/yarın listelerinden ara
  const match = useDetailData(`bb-match:${matchId}`, async () => findMatchById(matchId) ?? (await findBasketballGame(matchId)))
  const [tab, setTab] = useState<Tab>('summary')
  const { favorites, toggleFavorite } = useFavorites()

  const m = match.data
  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Özet' },
    { id: 'stats', label: 'İstatistikler' },
    { id: 'box', label: m && isNbaMatch(m) ? 'Box Score' : 'Oyuncular' },
    { id: 'standings', label: 'Puan durumu' },
    { id: 'chat', label: 'Sohbet' },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-white/10 bg-pitch-950/95 px-2 py-1.5 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Geri')}
          className="grid size-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="min-w-0 flex-1 truncate px-2 text-xs font-medium text-accent">{m ? `${m.region} › ${m.leagueName}` : 'Basketbol'}</p>
      </div>

      {match.loading ? (
        <LoadingState rows={6} />
      ) : !m ? (
        <EmptyState message={t('Maç bulunamadı.')} />
      ) : (
        <>
          <MatchHeader match={m} events={null} isFavorite={favorites.has(m.id)} onToggleFavorite={() => toggleFavorite(m.id)} />
          <LeagueTabs tabs={tabs} active={tab} onChange={setTab} label={t('Maç detayı')} />
          <div role="tabpanel" className="flex-1">
            {tab === 'summary' && (
              <div className="space-y-5 p-4 sm:p-5">
                {m.status === 'upcoming' ? (
                  <EmptyState message={t('Maç henüz başlamadı.')} />
                ) : (
                  <QuarterScores match={m} />
                )}
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-white/5 px-3 py-2">
                    <dt className="text-xs text-white/50">{t('Lig')}</dt>
                    <dd className="truncate font-semibold">{m.leagueName}</dd>
                  </div>
                  <div className="rounded-lg bg-white/5 px-3 py-2">
                    <dt className="text-xs text-white/50">{t('Başlama')}</dt>
                    <dd className="truncate font-semibold">
                      {new Date(m.startTime).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
            {tab === 'stats' && <BasketballStatsTab match={m} />}
            {tab === 'box' && <BoxScoreTab match={m} />}
            {tab === 'standings' && <BasketballStandingsTab match={m} />}
            {tab === 'chat' && <MatchChat matchId={m.id} />}
          </div>
        </>
      )}
    </div>
  )
}
