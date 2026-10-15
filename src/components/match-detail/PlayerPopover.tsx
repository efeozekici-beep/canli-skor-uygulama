import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { LineupPlayer } from '../../types/matchDetail'
import type { PlayerMatchStats } from '../../types/playerStats'
import { teamColor } from '../../lib/team'
import RatingBadge from './RatingBadge'
import PlayerAvatar from '../common/PlayerAvatar'
import { Card } from './EventIcon'

interface Props {
  player: LineupPlayer
  stats?: PlayerMatchStats
  teamName: string
  onClose: () => void
}

const POSITIONS = { G: 'Kaleci', D: 'Defans', M: 'Orta saha', F: 'Forvet' }

// Oyuncuya tıklanınca açılan küçük pencere. Sadece verisi olan istatistikler listelenir.
export default function PlayerPopover({ player, stats, teamName, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  // Açılınca kapat butonuna odaklan, Esc ile kapat
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const played = stats?.minutes != null
  const rows: [string, string][] = []
  if (stats && played) {
    const add = (label: string, value: number | string | null) => value !== null && rows.push([label, String(value)])
    add('Süre', `${stats.minutes}'`)
    add('Gol', stats.goals)
    add('Asist', stats.assists)
    add('Şut', stats.shots)
    add('İsabetli şut', stats.shotsOnTarget)
    add('Pas', stats.passes)
    add('İsabetli pas', stats.passAccuracy !== null ? `%${stats.passAccuracy}` : null)
    if (stats.duelsWon !== null && stats.duelsTotal) {
      add('İkili mücadele', `${stats.duelsWon}/${stats.duelsTotal} (%${Math.round((stats.duelsWon / stats.duelsTotal) * 100)})`)
    }
  }

  // Panelde backdrop-blur var; "fixed" öğeyi panelin içine hapseder.
  // Bu yüzden pencereyi portal ile doğrudan <body>'ye çiziyoruz ki tüm ekranı kaplasın.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 sm:place-items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl border border-white/10 bg-pitch-900 p-5 shadow-2xl sm:max-w-sm sm:rounded-2xl"
      >
        <div className="flex items-start gap-3">
          <PlayerAvatar
            photo={player.photo}
            name={player.name}
            size="xl"
            fallbackText={String(player.number)}
            fallbackColor={player.position === 'G' ? '#d97706' : teamColor(teamName)}
          />
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="truncate text-lg font-bold">
              {player.name}
            </h3>
            <p className="text-sm text-white/60">
              {teamName} · {POSITIONS[player.position]} · #{player.number}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="grid size-9 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        {stats?.rating != null && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
            <span className="text-sm text-white/70">Reyting</span>
            <RatingBadge rating={stats.rating} size="md" />
          </div>
        )}

        {rows.length > 0 ? (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {rows.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white/5 px-3 py-2">
                <dt className="text-xs text-white/55">{label}</dt>
                <dd className="font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-white/55">{stats ? 'Bu maçta oynamadı.' : 'Bu oyuncu için istatistik yok.'}</p>
        )}

        {stats && (stats.yellow > 0 || stats.red > 0) && (
          <div className="mt-3 flex items-center gap-2 text-sm text-white/70">
            Kart:
            {stats.yellow > 0 && <Card color="yellow" />}
            {stats.red > 0 && <Card color="red" />}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
