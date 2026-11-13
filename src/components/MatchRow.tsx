import type { Match } from '../types/match'
import { formatTime } from '../lib/date'
import TeamLogo from './TeamLogo'
import StarIcon from './StarIcon'
import GoalScore from './common/GoalScore'
import { useGoal } from '../hooks/useGoal'
import { t } from '../i18n'

interface Props {
  match: Match
  isFavorite: boolean
  isSelected: boolean
  onToggleFavorite: (id: string) => void
  onSelect: (id: string) => void
}

// Soldaki durum sütunu: canlıda kırmızı dakika rozeti, devre arasında amber "İY", bitmişte "MS", başlamamışta saat.
function StatusCell({ match }: { match: Match }) {
  // Basketbol canlı: futboldaki dakika yerine çeyrek + kalan süre, iki satır ("3. Çeyrek" / "05:42")
  const bb = match.basketball
  if (match.status === 'live' && bb && bb.period !== null) {
    return (
      <span className="status-badge status-badge--live text-[11px] leading-tight">
        {bb.period <= 4 ? t(`${bb.period}. Çeyrek`) : t('Uzatma')}
        {bb.clock && <span className="block tabular-nums">{bb.clock}</span>}
      </span>
    )
  }
  if (match.status === 'live') {
    const label = match.statusLabel ?? `${match.minute}'`
    const isBreak = ['İY', 'ARA', 'Devre arası', 'Çeyrek arası'].includes(label)
    return <span className={`status-badge ${isBreak ? 'status-badge--break' : 'status-badge--live'}`}>{t(label)}</span>
  }
  if (match.status === 'finished') return <span>{t(match.statusLabel ?? 'MS')}</span>
  return <span className="text-white/70">{match.statusLabel ? t(match.statusLabel) : formatTime(match.startTime)}</span>
}

// Görünüm index.css'teki .match-row / .match-time-status / .match-team / .match-score sınıflarından gelir.
export default function MatchRow({ match, isFavorite, isSelected, onToggleFavorite, onSelect }: Props) {
  const { status, homeScore, awayScore } = match
  const hasScore = status !== 'upcoming' && homeScore !== null && awayScore !== null
  // Canlı skor güncellenip skor artınca gol animasyonu (sayfa açılırken oynamaz)
  const homeGoal = useGoal(homeScore)
  const awayGoal = useGoal(awayScore)
  const lastGoal = Math.max(homeGoal ?? -1, awayGoal ?? -1)

  // Maç bitince kaybeden taraf soluklaşır (MMA gibi skorsuz sporlarda "winner" alanına göre)
  const dim = (own: number | null, other: number | null, side: 'home' | 'away') =>
    status === 'finished' &&
    (match.winner ? match.winner !== side : own !== null && other !== null && own < other)
      ? 'text-white/50'
      : ''

  // Formula 1: iki taraf yok; seans adı ve ilk üç (bitti / canlı)
  if (match.event) {
    const podium = match.event.results.slice(0, 3)
    return (
      <div className={`match-row relative ${isSelected ? 'bg-accent/10' : ''}`}>
        {isSelected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent" />}
        <button
          type="button"
          onClick={() => onSelect(match.id)}
          aria-current={isSelected ? 'true' : undefined}
          aria-label={t('{name} ayrıntısı', { name: `${match.leagueName} ${t(match.event.title)}` })}
          className="grid min-w-0 flex-1 grid-cols-[52px_minmax(0,1fr)] items-center gap-2 text-left sm:gap-3"
        >
          <span className="match-time-status">
            <StatusCell match={match} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="shrink-0 font-semibold text-white">{t(match.event.title)}</span>
            {podium.length > 0 && (
              <span className="truncate text-sm text-white/60">{podium.map((name, i) => `${i + 1}. ${name}`).join(' · ')}</span>
            )}
          </span>
        </button>
        <div className="match-actions ml-2">
          <button
            type="button"
            aria-pressed={isFavorite}
            aria-label={`${match.leagueName} ${t(match.event.title)}: ${isFavorite ? t('favorilerden çıkar') : t('favorilere ekle')}`}
            onClick={() => onToggleFavorite(match.id)}
            className={`-m-2 grid size-10 place-items-center rounded-full transition-transform duration-150 ease-out active:scale-[0.9] ${
              isFavorite ? 'text-amber-400' : ''
            }`}
          >
            <StarIcon filled={isFavorite} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`match-row relative ${isSelected ? 'bg-accent/10' : ''}`}>
      {/* Son açılan maçın solunda yeşil şerit */}
      {isSelected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent" />}
      {/* Gol olunca satır hafifçe yeşil parlar */}
      {lastGoal >= 0 && <span key={`${homeGoal}-${awayGoal}`} aria-hidden="true" className="goal-flash pointer-events-none absolute inset-0 bg-accent/15" />}

      {/* Satır: durum | ev sahibi (sağa yaslı) | skor | deplasman (sola yaslı). Tıklayınca maç sayfası açılır. */}
      <button
        type="button"
        onClick={() => onSelect(match.id)}
        aria-current={isSelected ? 'true' : undefined}
        aria-label={`${match.homeTeam} - ${match.awayTeam}: ${t('maç detayı')}`}
        className="grid min-w-0 flex-1 grid-cols-[52px_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-left sm:gap-3"
      >
        <span className="match-time-status">
          <StatusCell match={match} />
        </span>

        <span className="match-team justify-end text-right">
          <span className={`truncate ${dim(homeScore, awayScore, 'home')}`}>{match.homeTeam}</span>
          <TeamLogo name={match.homeTeam} logo={match.homeLogo} size="row" />
        </span>

        {/* Skor: canlıda yumuşak kırmızı, başlamamışta soluk tire */}
        <span className={`match-score relative overflow-hidden tabular-nums ${status === 'live' ? 'text-red-300' : ''} ${hasScore ? '' : 'text-white/35'}`}>
          {hasScore ? (
            <>
              <GoalScore value={homeScore} goal={homeGoal} side="home" /> - <GoalScore value={awayScore} goal={awayGoal} side="away" />
            </>
          ) : (
            '-'
          )}
        </span>

        <span className="match-team">
          <TeamLogo name={match.awayTeam} logo={match.awayLogo} size="row" />
          <span className={`truncate ${dim(awayScore, homeScore, 'away')}`}>{match.awayTeam}</span>
        </span>
      </button>

      <div className="match-actions ml-2">
        <button
          type="button"
          aria-pressed={isFavorite}
          aria-label={`${match.homeTeam} - ${match.awayTeam}: ${isFavorite ? t('favorilerden çıkar') : t('favorilere ekle')}`}
          onClick={() => onToggleFavorite(match.id)}
          className={`-m-2 grid size-10 place-items-center rounded-full transition-transform duration-150 ease-out active:scale-[0.9] ${
            isFavorite ? 'text-amber-400' : ''
          }`}
        >
          <StarIcon filled={isFavorite} />
        </button>
      </div>
    </div>
  )
}
