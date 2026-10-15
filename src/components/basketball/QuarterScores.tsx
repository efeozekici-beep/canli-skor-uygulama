import type { Match } from '../../types/match'
import TeamLogo from '../TeamLogo'

// Çeyrek skorları tablosu: Takım | 1Ç 2Ç 3Ç 4Ç (Uz) | Toplam. Oynanmamış çeyrek "–".
export default function QuarterScores({ match }: { match: Match }) {
  const periods = match.basketball?.periods ?? []
  if (periods.length === 0) return null
  // Canlıyken oynanan çeyrek vurgulanır
  const current = match.status === 'live' ? match.basketball?.period : null
  const cell = (v: number | null) => (v === null ? '–' : v)

  const row = (side: 'home' | 'away') => {
    const name = side === 'home' ? match.homeTeam : match.awayTeam
    const logo = side === 'home' ? match.homeLogo : match.awayLogo
    const total = side === 'home' ? match.homeScore : match.awayScore
    return (
      <tr className="border-t border-white/5">
        <td className="max-w-0 py-2.5 pr-2">
          <span className="flex items-center gap-2">
            <TeamLogo name={name} logo={logo} />
            <span className="truncate font-medium">{name}</span>
          </span>
        </td>
        {periods.map((p, i) => (
          <td key={p.label} className={`px-2 py-2.5 text-center ${current === i + 1 ? 'font-bold text-[#fca5a5]' : 'text-white/75'}`}>
            {cell(p[side])}
          </td>
        ))}
        <td className="py-2.5 pl-2 text-center text-base font-extrabold">{total ?? '–'}</td>
      </tr>
    )
  }

  return (
    <table className="w-full text-sm tabular-nums">
      <thead className="text-xs text-white/45">
        <tr>
          <th className="py-2 text-left font-semibold">Takım</th>
          {periods.map((p) => (
            <th key={p.label} className="px-2 py-2 text-center font-semibold">
              {p.label}
            </th>
          ))}
          <th className="py-2 pl-2 text-center font-semibold">T</th>
        </tr>
      </thead>
      <tbody>
        {row('home')}
        {row('away')}
      </tbody>
    </table>
  )
}
