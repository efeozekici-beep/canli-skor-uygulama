import type { Match } from '../../types/match'
import { getBasketballTeamStats } from '../../services/basketballService'
import { useDetailData } from '../../hooks/useDetailData'
import StatBars from '../common/StatBars'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'
import { t } from '../../i18n'

// Basketbol takım istatistikleri (bütün ligler): isabet yüzdeleri, ribaund, asist... futboldaki gibi çubuklar
export default function BasketballStatsTab({ match }: { match: Match }) {
  const stats = useDetailData(match.status === 'upcoming' ? null : `bb-teamstats:${match.id}`, () => getBasketballTeamStats(match))

  if (match.status === 'upcoming') return <EmptyState message={t('İstatistikler maç başlayınca görünecek.')} />
  if (stats.loading) return <LoadingState rows={8} />
  if (stats.error) return <ErrorState message={stats.error} />
  if (!stats.data || stats.data.length === 0) return <EmptyState message={t('Bu maç için istatistik verisi yok.')} />

  return <StatBars match={match} items={stats.data} />
}
