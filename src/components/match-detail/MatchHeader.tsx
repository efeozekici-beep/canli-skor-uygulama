import type { Match } from '../../types/match'
import type { MatchEvent, Side } from '../../types/matchDetail'
import { formatTime } from '../../lib/date'
import { isGoal, minuteText } from '../../lib/events'
import TeamLogo from '../TeamLogo'
import StarIcon from '../StarIcon'
import { Ball } from './EventIcon'

interface Props {
  match: Match
  events: MatchEvent[] | null | undefined
  isFavorite: boolean
  onToggleFavorite: () => void
  /** Verilmezse "Tam sayfa görünümü" butonu gizlenir (zaten tam sayfadayız). */
  fullPageHref?: string
}

// Gol atanları oyuncuya göre grupla: "Salah 9', 45+2' (P)"
function scorers(events: MatchEvent[], side: Side) {
  const byPlayer = new Map<string, string[]>()
  for (const e of events) {
    if (e.side !== side || !isGoal(e)) continue
    const tag = e.kind === 'penalty' ? ' (P)' : e.kind === 'own-goal' ? ' (OG)' : ''
    byPlayer.set(e.player, [...(byPlayer.get(e.player) ?? []), minuteText(e) + tag])
  }
  return [...byPlayer].map(([player, minutes]) => `${player} ${minutes.join(', ')}`)
}

function statusText(match: Match) {
  if (match.status === 'live') return { text: `Canlı ${match.statusLabel ?? `${match.minute}'`}`, className: 'text-red-400' }
  if (match.status === 'finished') {
    const extra = match.statusLabel && match.statusLabel !== 'MS' ? ` (${match.statusLabel})` : ''
    return { text: `Bitti${extra}`, className: 'text-white/60' }
  }
  const day = new Date(match.startTime).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  return { text: `${day} · ${formatTime(match.startTime)}`, className: 'text-white/60' }
}

export default function MatchHeader({ match, events, isFavorite, onToggleFavorite, fullPageHref }: Props) {
  const hasScore = match.status !== 'upcoming' && match.homeScore !== null && match.awayScore !== null
  const status = statusText(match)
  const homeScorers = events ? scorers(events, 'home') : []
  const awayScorers = events ? scorers(events, 'away') : []

  // Her iki taraftaki yıldız da listedeki aynı favori durumunu değiştirir.
  const star = (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Maçı favorilerden çıkar' : 'Maçı favorilere ekle'}
      onClick={onToggleFavorite}
      className={`grid size-9 place-items-center rounded-full transition-[color,transform] duration-150 ease-out active:scale-[0.9] ${
        isFavorite ? 'text-amber-400' : 'text-white/60 hover:text-white'
      }`}
    >
      <StarIcon filled={isFavorite} />
    </button>
  )

  const team = (name: string, logo?: string) => (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <TeamLogo name={name} logo={logo} size="lg" />
      <span className="line-clamp-2 text-sm font-semibold sm:text-base">{name}</span>
    </div>
  )

  return (
    <div className="px-4 pt-4 pb-5">
      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-start gap-1 sm:gap-2">
        {star}
        {team(match.homeTeam, match.homeLogo)}
        <div className="flex flex-col items-center px-1 pt-2">
          <span className={`text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl ${match.status === 'live' ? 'text-red-400' : ''}`}>
            {hasScore ? `${match.homeScore} - ${match.awayScore}` : 'vs'}
          </span>
          <span className={`mt-1 text-sm font-semibold whitespace-nowrap ${status.className}`}>{status.text}</span>
        </div>
        {team(match.awayTeam, match.awayLogo)}
        {star}
      </div>

      {/* Gol atanlar: ev sahibi solda, deplasman sağda */}
      {(homeScorers.length > 0 || awayScorers.length > 0) && (
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-3 text-xs text-white/70">
          <ul className="space-y-0.5 text-right">
            {homeScorers.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <Ball className="mt-0.5 size-3.5 text-white/50" />
          <ul className="space-y-0.5">
            {awayScorers.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {fullPageHref && (
        <div className="mt-4 flex justify-center">
          <a
            href={fullPageHref}
            className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-pitch-950 transition-[background-color,transform] duration-150 ease-out hover:bg-accent/90 active:scale-[0.97]"
          >
            Tam sayfa görünümü
          </a>
        </div>
      )}
    </div>
  )
}
