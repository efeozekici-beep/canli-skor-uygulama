import { useState } from 'react'
import { getPlayerProfile, rememberPlayerTeam } from '../services/playerService'
import { useDetailData } from '../hooks/useDetailData'
import PlayerHeader from '../components/player/PlayerHeader'
import PlayerTabs, { type PlayerTab } from '../components/player/PlayerTabs'
import SeasonStatsTab from '../components/player/SeasonStatsTab'
import CareerTab from '../components/player/CareerTab'
import TransfersTab from '../components/player/TransfersTab'
import TrophiesTab from '../components/player/TrophiesTab'
import { EmptyState, ErrorState, LoadingState } from '../components/match-detail/TabStates'
import { t } from '../i18n'

interface Props {
  playerId: string
  /** Kadrodan / maçtan açıldıysa oyuncunun takımı (ESPN'de doğru oyuncuyu bulmak için) */
  teamHint?: string | null
  onBack: () => void
}

// Oyuncu sayfası (#/oyuncu/:id): başlık + Genel / Kariyer / Transferler / Kupalar
export default function PlayerPage({ playerId, teamHint = null, onBack }: Props) {
  // Takım ipucu profil yüklenmeden önce kaydedilir; diğer sekmeler de aynı ipucunu kullanır
  const profile = useDetailData(`profile:${playerId}`, () => {
    rememberPlayerTeam(playerId, teamHint)
    return getPlayerProfile(playerId)
  })
  const [tab, setTab] = useState<PlayerTab>('overview')

  return (
    <div className="flex min-h-full flex-col">
      {/* Üst çubuk: geri butonu */}
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-white/10 bg-pitch-950/95 px-2 py-1.5 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('Geri')}
          className="grid size-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="px-2 text-xs font-medium text-accent">{t('Oyuncu')}</p>
      </div>

      {profile.loading ? (
        <LoadingState rows={6} />
      ) : profile.error ? (
        <ErrorState message={profile.error} />
      ) : !profile.data ? (
        <EmptyState message={t('Bu oyuncu için veri bulunmuyor.')} />
      ) : (
        <>
          <PlayerHeader profile={profile.data} />
          <PlayerTabs active={tab} onChange={setTab} />
          {/* Sadece aktif sekme ekranda; verisi de ilk açıldığında yüklenir */}
          <div role="tabpanel" className="flex-1">
            {tab === 'overview' && <SeasonStatsTab playerId={playerId} />}
            {tab === 'career' && <CareerTab playerId={playerId} />}
            {tab === 'transfers' && <TransfersTab playerId={playerId} />}
            {tab === 'trophies' && <TrophiesTab playerId={playerId} />}
          </div>
        </>
      )}
    </div>
  )
}
