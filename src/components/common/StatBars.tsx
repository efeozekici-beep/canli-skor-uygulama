import type { Match } from '../../types/match'
import type { StatItem } from '../../types/matchDetail'
import { TEAM_COLORS } from '../../lib/chartColors'
import TeamLogo from '../TeamLogo'

// İki taraflı istatistikler (futbol ve basketbol ortak). Renk takımı gösterir (ev sahibi yeşil, deplasman mavi);
// önde olan tarafın çubuğu tam, geride olanınki soluk. Rakamlar her zaman yazılı (renk tek başına bilgi taşımaz).
//  - Topla oynama varsa en üstte büyük bölünmüş çubuk
//  - xG / şut / isabetli şut varsa öne çıkan kartlar
//  - Kalanlar iki taraflı çubuklar

const HERO_KEYS = ['xg', 'shots', 'shotsOnTarget']
type Side = 'home' | 'away'

const format = (value: number, unit?: '%') => `${Number.isInteger(value) ? value : value.toFixed(2)}${unit ?? ''}`
const leaderOf = (item: StatItem): Side | null => (item.home === item.away ? null : item.home > item.away ? 'home' : 'away')

function Possession({ item }: { item: StatItem }) {
  const total = item.home + item.away || 1
  return (
    <section aria-label={`${item.label}: ${item.home}% - ${item.away}%`}>
      <div className="mb-1.5 flex items-baseline justify-between tabular-nums">
        <span className="text-2xl font-bold">{format(item.home, '%')}</span>
        <span className="text-xs text-white/60">{item.label}</span>
        <span className="text-2xl font-bold">{format(item.away, '%')}</span>
      </div>
      {/* İki parça arasında 2px boşluk */}
      <div className="flex h-3 gap-0.5">
        <div className="rounded-l-full" style={{ width: `${(item.home / total) * 100}%`, backgroundColor: TEAM_COLORS.home }} />
        <div className="rounded-r-full" style={{ width: `${(item.away / total) * 100}%`, backgroundColor: TEAM_COLORS.away }} />
      </div>
    </section>
  )
}

function HeroTile({ item }: { item: StatItem }) {
  const leader = leaderOf(item)
  const value = (side: Side) => (
    <span className={`flex items-center gap-1.5 ${leader === side || leader === null ? 'text-white' : 'text-white/55'}`}>
      <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: TEAM_COLORS[side] }} />
      {format(item[side], item.unit)}
    </span>
  )
  return (
    <div className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-center">
      <p className="truncate text-[11px] text-white/55">{item.label}</p>
      <p className="mt-1 flex items-center justify-center gap-3 text-lg font-bold tabular-nums">
        {value('home')}
        <span className="text-white/25">–</span>
        {value('away')}
      </p>
    </div>
  )
}

function BarRow({ item }: { item: StatItem }) {
  const total = item.home + item.away
  const pct = (side: Side) => (total ? (item[side] / total) * 100 : 0)
  const leader = leaderOf(item)
  // Önde olan tam renk, geride olan soluk; eşitlikte ikisi de tam
  const opacity = (side: Side) => (leader === null || leader === side ? 1 : 0.4)
  const valueClass = (side: Side) => (leader === side ? 'font-bold text-white' : 'text-white/70')
  return (
    <li>
      <div className="flex items-center justify-between text-sm tabular-nums">
        <span className={valueClass('home')}>{format(item.home, item.unit)}</span>
        <span className="text-white/70">{item.label}</span>
        <span className={valueClass('away')}>{format(item.away, item.unit)}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <div className="flex h-2 justify-end overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${pct('home')}%`, backgroundColor: TEAM_COLORS.home, opacity: opacity('home') }} />
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${pct('away')}%`, backgroundColor: TEAM_COLORS.away, opacity: opacity('away') }} />
        </div>
      </div>
    </li>
  )
}

export default function StatBars({ match, items }: { match: Match; items: StatItem[] }) {
  const possession = items.find((i) => i.key === 'possession')
  const heroes = HERO_KEYS.map((key) => items.find((i) => i.key === key)).filter((i): i is StatItem => i !== undefined)
  const rest = items.filter((i) => i !== possession && !heroes.includes(i))

  return (
    <div className="space-y-5 p-4">
      {/* Takımlar: altındaki renkli çizgi grafiklerdeki takım rengini tanıtır */}
      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
        {(['home', 'away'] as const).map((side) => (
          <span key={side} className={`flex min-w-0 flex-col gap-1.5 ${side === 'away' ? 'items-end' : ''}`}>
            <span className={`flex min-w-0 items-center gap-2 ${side === 'away' ? 'flex-row-reverse' : ''}`}>
              <TeamLogo name={side === 'home' ? match.homeTeam : match.awayTeam} logo={side === 'home' ? match.homeLogo : match.awayLogo} />
              <span className="truncate">{side === 'home' ? match.homeTeam : match.awayTeam}</span>
            </span>
            <span aria-hidden="true" className="h-1 w-10 rounded-full" style={{ backgroundColor: TEAM_COLORS[side] }} />
          </span>
        ))}
      </div>

      {possession && <Possession item={possession} />}

      {heroes.length > 0 && (
        <div className={`grid gap-2 ${heroes.length === 3 ? 'grid-cols-3' : heroes.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {heroes.map((item) => (
            <HeroTile key={item.key} item={item} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <ul className="space-y-4">
          {rest.map((item) => (
            <BarRow key={item.key} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}
