import type { LeagueInfo } from '../../types/league'
import { seasonLabel } from '../../lib/league'
import LeagueLogo from '../common/LeagueLogo'
import { t } from '../../i18n'

interface Props {
  league: LeagueInfo
  season: number
  onSeasonChange: (season: number) => void
}

// Lig logosu, adı, bölgesi ve sağda sezon seçici
export default function LeagueHeader({ league, season, onSeasonChange }: Props) {
  // Son 4 sezon seçilebilir (güncel sezon varsayılan)
  const seasons = Array.from({ length: 4 }, (_, i) => league.currentSeason - i)

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-5 sm:px-6">
      <LeagueLogo name={league.name} logo={league.logo} size="lg" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold sm:text-2xl">{league.name}</h1>
        <p className="mt-0.5 flex items-center gap-2 text-sm text-white/55">
          {league.region}
          {league.isMock && (
            <span title={t('Bu lig için şimdilik örnek veri gösteriliyor')} className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              {t('Örnek veri')}
            </span>
          )}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-white/60">
        {t('Sezon')}
        <select
          value={season}
          onChange={(e) => onSeasonChange(Number(e.target.value))}
          className="min-h-10 rounded-full border border-white/15 bg-black/30 px-3 font-semibold text-white"
        >
          {seasons.map((s) => (
            <option key={s} value={s} className="bg-pitch-950">
              {seasonLabel(s)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
