import { getBasketballLeaders } from '../../services/basketballService'
import { useDetailData } from '../../hooks/useDetailData'
import PlayerAvatar from '../common/PlayerAvatar'
import TeamLogo from '../TeamLogo'

// Lig sayfasında puan tablosunun yanında: sayı / ribaund / asist... kralları (maç başı ortalama, ilk 5).
// Kaynağı olmayan liglerde hiç çizilmez.
export default function LeadersPanel({ leagueId }: { leagueId: string }) {
  const leaders = useDetailData(`bb-leaders:${leagueId}`, () => getBasketballLeaders(leagueId))

  if (leaders.loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    )
  }
  if (!leaders.data || leaders.data.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="px-1 text-sm font-semibold text-white/80">İstatistik liderleri</h3>
      {leaders.data.map((cat) => (
        <section key={cat.key} className="rounded-xl bg-white/[0.04] p-3">
          <h4 className="mb-2 flex items-baseline justify-between text-xs font-semibold text-white/60">
            {cat.label}
            <span className="font-normal text-white/35">maç başı</span>
          </h4>
          <ol className="space-y-1.5">
            {cat.leaders.map((l, i) => (
              <li key={`${l.name}-${i}`} className="flex items-center gap-2.5">
                <span className="w-4 text-center text-xs font-semibold text-white/45 tabular-nums">{i + 1}</span>
                <PlayerAvatar photo={l.photo ?? undefined} name={l.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${i === 0 ? 'font-semibold' : ''}`}>{l.name}</span>
                  {l.team && (
                    <span className="flex items-center gap-1 text-[11px] text-white/50">
                      <TeamLogo name={l.team} logo={l.teamLogo ?? undefined} />
                      <span className="truncate">{l.team}</span>
                    </span>
                  )}
                </span>
                <span className={`text-sm tabular-nums ${i === 0 ? 'font-bold text-white' : 'text-white/75'}`}>{l.value}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
