import type { TeamStatsSummary } from '../../types/team'

// Takım sayfasının üstündeki sezon özeti: O / G / B / M, atılan : yenen ve fark.
// Basketbolda beraberlik yok (draw null): o kutu çizilmez, "gol" yerine "sayı" yazar.
export default function TeamStatsCard({ stats, unit }: { stats: TeamStatsSummary; unit: 'gol' | 'sayı' }) {
  const diff = stats.scored - stats.conceded
  const tiles: [string, string | number, string?][] = [
    ['Maç', stats.played],
    ['Galibiyet', stats.won, 'text-accent'],
    ...(stats.draw !== null ? ([['Beraberlik', stats.draw, 'text-white/80']] as [string, number, string][]) : []),
    ['Mağlubiyet', stats.lost, 'text-red-300'],
    [unit === 'gol' ? 'Gol (A:Y)' : 'Sayı (A:Y)', `${stats.scored}:${stats.conceded}`],
    ['Fark', diff > 0 ? `+${diff}` : diff, diff > 0 ? 'text-accent' : diff < 0 ? 'text-red-300' : ''],
  ]
  return (
    <section aria-label="Sezon özeti" className={`grid gap-2 ${tiles.length === 6 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-5'}`}>
      {tiles.map(([label, value, tone]) => (
        <div key={label} className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-center">
          <p className="truncate text-[11px] text-white/50">{label}</p>
          <p className={`mt-0.5 text-lg font-bold tabular-nums ${tone ?? ''}`}>{value}</p>
        </div>
      ))}
    </section>
  )
}
