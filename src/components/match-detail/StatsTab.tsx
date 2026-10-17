import type { Match } from '../../types/match'
import { getPlayerStats, getStatistics } from '../../services/matchDetailService'
import { useDetailData } from '../../hooks/useDetailData'
import StatBars from '../common/StatBars'
import PlayerRadar from './PlayerRadar'
import { EmptyState, ErrorState, LoadingState } from './TabStates'

// Futbol istatistikleri: takım istatistikleri (StatBars, basketbolla ortak) + oyuncu karşılaştırma radarı.
// İkisi de aynı /fixtures?id= cevabından gelir (ek istek yok).
export default function StatsTab({ match }: { match: Match }) {
  const upcoming = match.status === 'upcoming'
  const stats = useDetailData(upcoming ? null : `stats:${match.id}`, () => getStatistics(match.id))
  const players = useDetailData(upcoming ? null : `players:${match.id}`, () => getPlayerStats(match.id))

  if (upcoming) return <EmptyState message="İstatistikler maç başlayınca görünecek." />
  if (stats.loading) return <LoadingState rows={8} />
  if (stats.error) return <ErrorState message={stats.error} />
  if (!stats.data || stats.data.length === 0) return <EmptyState message="Bu maç için istatistik verisi yok." />

  return (
    <>
      <StatBars match={match} items={stats.data} />
      {players.data && <PlayerRadar players={players.data} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />}
    </>
  )
}
