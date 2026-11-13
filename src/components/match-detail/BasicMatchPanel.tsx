import type { Match } from '../../types/match'
import { findMatchById } from '../../services/matchService'
import { useFavorites } from '../../hooks/useFavorites'
import { formatTime } from '../../lib/date'
import MatchHeader from './MatchHeader'
import { EmptyState } from './TabStates'
import { t } from '../../i18n'
import MatchChat from './MatchChat'

interface Props {
  matchId: string
  onClose: () => void
}

// Tenis: set set oyun skorları
function SetsTable({ match }: { match: Match }) {
  const sets = match.sets ?? []
  const rows = [
    { name: match.homeTeam, side: 'home' as const },
    { name: match.awayTeam, side: 'away' as const },
  ]
  return (
    <div className="mx-4 mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-white/50">
            <th className="px-3 py-2 text-left font-medium">{t('Oyuncu')}</th>
            {sets.map((_, i) => (
              <th key={i} className="w-10 px-2 py-2 text-center font-medium">
                {t('{n}. Set', { n: i + 1 })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ name, side }) => (
            <tr key={side} className={`border-t border-white/5 ${match.winner && match.winner !== side ? 'text-white/50' : 'text-white'}`}>
              <td className="truncate px-3 py-2">{name}</td>
              {sets.map((s, i) => {
                const own = s[side]
                const other = side === 'home' ? s.away : s.home
                return (
                  <td key={i} className={`px-2 py-2 text-center ${own !== null && other !== null && own > other ? 'font-semibold' : ''}`}>
                    {own ?? '-'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Formula 1: seans başlığı ve sıralama
function SessionView({ match }: { match: Match }) {
  const event = match.event!
  const state = match.status === 'live' ? t('Canlı') : match.status === 'finished' ? t('Bitti') : t('Başlangıç {time}', { time: formatTime(match.startTime) })
  return (
    <>
      <div className="px-4 pt-6 pb-4 text-center">
        <p className="text-sm text-white/60">{match.leagueName}</p>
        <h1 className="mt-1 text-2xl font-bold text-white">{t(event.title)}</h1>
        <p className={`mt-2 text-sm ${match.status === 'live' ? 'text-red-400' : 'text-white/60'}`}>{match.statusLabel ? t(match.statusLabel) : state}</p>
      </div>
      {event.results.length === 0 ? (
        <EmptyState message={t('Sıralama seans başlayınca görünecek.')} />
      ) : (
        <ol className="mx-4 mb-6 overflow-hidden rounded-xl border border-white/10">
          {event.results.map((name, i) => (
            <li key={`${i}-${name}`} className="flex items-center gap-3 border-t border-white/5 px-3 py-2 first:border-t-0">
              <span className={`w-6 text-right tabular-nums ${i < 3 ? 'font-bold text-accent' : 'text-white/50'}`}>{i + 1}</span>
              <span className="truncate text-white">{name}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

// API'nin vermediği günlerden ya da detay sayfası henüz olmayan sporlardan gelen maçlar: sadece başlık (skor, saat,
// taraflar); tenis maçında set tablosu, Formula 1 seansında sıralama.
export default function BasicMatchPanel({ matchId, onClose }: Props) {
  const match = findMatchById(matchId)
  const { favorites, toggleFavorite } = useFavorites()

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-white/10 bg-pitch-950/95 px-2 py-1.5 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Geri')}
          className="grid size-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="min-w-0 flex-1 truncate px-2 text-xs font-medium text-accent">{match ? `${t(match.region)} › ${match.leagueName}` : t('Maç')}</p>
      </div>

      {!match ? (
        <EmptyState message={t('Maç bulunamadı. Ana sayfada maçın gününe gidip tekrar açabilirsin.')} />
      ) : match.event ? (
        <>
          <SessionView match={match} />
          <MatchChat matchId={match.id} />
        </>
      ) : (
        <>
          <MatchHeader match={match} events={null} isFavorite={favorites.has(match.id)} onToggleFavorite={() => toggleFavorite(match.id)} />
          {match.sets && match.sets.length > 0 && <SetsTable match={match} />}
          <EmptyState
            message={
              match.sport === 'football' || match.sport === 'basketball'
                ? t('Bu günün maç ayrıntıları (olaylar, kadrolar, istatistikler) ücretsiz planda yok; sadece skor gösteriliyor.')
                : t('Bu sporda maç ayrıntıları henüz eklenmedi; şimdilik skor gösteriliyor.')
            }
          />
          <MatchChat matchId={match.id} />
        </>
      )}
    </div>
  )
}
