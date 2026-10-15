import type { Match } from '../../types/match'
import type { StatItem } from '../../types/matchDetail'
import TeamLogo from '../TeamLogo'

// İki taraflı yatay istatistik çubukları (futbol ve basketbol ortak): önde olan taraf yeşil.
export default function StatBars({ match, items }: { match: Match; items: StatItem[] }) {
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm font-semibold">
        <span className="flex min-w-0 items-center gap-2">
          <TeamLogo name={match.homeTeam} logo={match.homeLogo} />
          <span className="truncate">{match.homeTeam}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{match.awayTeam}</span>
          <TeamLogo name={match.awayTeam} logo={match.awayLogo} />
        </span>
      </div>

      <ul className="space-y-4">
        {items.map((item) => {
          const total = item.home + item.away
          const homePct = total ? (item.home / total) * 100 : 0
          const awayPct = total ? (item.away / total) * 100 : 0
          const leader = item.home === item.away ? null : item.home > item.away ? 'home' : 'away'
          const bar = (side: 'home' | 'away') => (leader === side ? 'bg-accent' : leader === null ? 'bg-white/50' : 'bg-white/30')
          const value = (side: 'home' | 'away') => (leader === side ? 'font-bold text-white' : 'text-white/70')
          const unit = item.unit ?? ''
          return (
            <li key={item.key}>
              <div className="flex items-center justify-between text-sm tabular-nums">
                <span className={value('home')}>
                  {item.home}
                  {unit}
                </span>
                <span className="text-white/70">{item.label}</span>
                <span className={value('away')}>
                  {item.away}
                  {unit}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <div className="flex h-2 justify-end overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${bar('home')}`} style={{ width: `${homePct}%` }} />
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${bar('away')}`} style={{ width: `${awayPct}%` }} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
