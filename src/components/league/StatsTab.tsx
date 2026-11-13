import { useState } from 'react'
import type { PlayerStatKind } from '../../types/league'
import { PLAYER_STAT_LOADERS } from '../../services/leagueService'
import { useDetailData } from '../../hooks/useDetailData'
import LeagueTabs from './LeagueTabs'
import PlayerStatList from './PlayerStatList'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'
import { t } from '../../i18n'

interface Props {
  leagueId: string
  season: number
}

const KINDS: { id: PlayerStatKind; label: string; valueLabel: string }[] = [
  { id: 'goals', label: 'Gol Krallığı', valueLabel: 'Gol' },
  { id: 'assists', label: 'Asist', valueLabel: 'Asist' },
  { id: 'yellow', label: 'Sarı Kart', valueLabel: 'Sarı kart' },
  { id: 'red', label: 'Kırmızı Kart', valueLabel: 'Kırmızı kart' },
]

// İstatistikler sekmesi: her alt sekmenin verisi sadece o alt sekme açılınca çekilir.
export default function StatsTab({ leagueId, season }: Props) {
  const [kind, setKind] = useState<PlayerStatKind>('goals')
  const data = useDetailData(`${kind}:${leagueId}:${season}`, () => PLAYER_STAT_LOADERS[kind](leagueId, season))
  const current = KINDS.find((k) => k.id === kind) ?? KINDS[0]

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <LeagueTabs tabs={KINDS} active={kind} onChange={setKind} label={t('İstatistik türü')} variant="pill" />
      {data.loading ? (
        <LoadingState rows={8} />
      ) : data.error ? (
        <ErrorState message={data.error} />
      ) : !data.data || data.data.length === 0 ? (
        <EmptyState message={t('Bu lig için istatistik bulunmuyor.')} />
      ) : (
        // key: alt sekme değişince "Daha fazla göster" sıfırlansın
        <PlayerStatList key={kind} players={data.data} valueLabel={current.valueLabel} />
      )}
    </div>
  )
}
