import type { SquadPosition, TeamInfo } from '../../types/team'
import { findSquadStats, getSquad, getSquadStats, type SquadStats } from '../../services/teamService'
import { getCurrentCoach } from '../../services/matchDetailService'
import { useDetailData } from '../../hooks/useDetailData'
import PlayerAvatar from '../common/PlayerAvatar'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'
import { playerHref } from '../../lib/navigation'
import { ab, t } from '../../i18n'

const GROUPS: { position: SquadPosition; label: string }[] = [
  { position: 'G', label: 'Kaleciler' },
  { position: 'D', label: 'Defans' },
  { position: 'M', label: 'Orta saha' },
  { position: 'F', label: 'Forvet' },
]

// Bu sezonun lig istatistik sütunları: [kısaltma (TR, EN, DE), açıklama, değer]. Dar ekranda bazıları gizlenir.
const COLUMNS: [[string, string, string], string, (s: SquadStats) => number, boolean][] = [
  [['M', 'GP', 'Sp'], 'Maç', (s) => s.appearances, true],
  [['İ11', 'XI', 'S11'], 'İlk 11', (s) => s.starts, false],
  [['G', 'G', 'T'], 'Gol', (s) => s.goals, true],
  [['A', 'A', 'V'], 'Asist', (s) => s.assists, true],
  [['SK', 'YC', 'GK'], 'Sarı kart', (s) => s.yellow, true],
  [['KK', 'RC', 'RK'], 'Kırmızı kart', (s) => s.red, false],
]
const COL = 'w-7 shrink-0 text-center sm:w-9'

function StatCells({ stats }: { stats: SquadStats | null }) {
  return (
    <span className="flex shrink-0 text-sm tabular-nums">
      {COLUMNS.map(([[tr], title, value, always]) => {
        const v = stats ? value(stats) : null
        const strong = tr === 'G' || tr === 'A'
        const color = tr === 'SK' && v ? 'text-amber-400' : tr === 'KK' && v ? 'text-red-400' : strong && v ? 'font-semibold text-white' : 'text-white/60'
        return (
          <span key={title} title={t(title)} className={`${COL} ${always ? '' : 'hidden sm:block'} ${v === null ? 'text-white/25' : color}`}>
            {v ?? '–'}
          </span>
        )
      })}
    </span>
  )
}

// Güncel kadro (API-Football), mevkiye göre gruplu; yanında bu sezonun lig istatistikleri (ESPN).
// Oyuncuya tıklayınca oyuncu sayfası açılır.
export default function TeamSquad({ team, leagueId }: { team: TeamInfo; leagueId?: string | null }) {
  const squad = useDetailData(`squad:${team.id}`, () => getSquad(team.id))
  const coach = useDetailData(`coach:${team.id}`, () => getCurrentCoach(team.id))
  const seasonStats = useDetailData(leagueId ? `squad-stats:${team.id}:${leagueId}` : null, () => getSquadStats(team, leagueId ?? ''))
  const stats = seasonStats.data ?? null

  if (squad.loading) return <LoadingState rows={10} />
  if (squad.error) return <ErrorState message={squad.error} />
  if (!squad.data || squad.data.length === 0) return <EmptyState message={t('Bu takımın kadro bilgisi bulunmuyor.')} />
  const players = squad.data

  return (
    <div className="space-y-5 p-3 sm:p-5">
      <p className="px-1 text-xs text-white/50">
        {t('{n} oyuncu', { n: players.length })}
        {stats && ` · ${t('İstatistikler: bu sezon, lig maçları')}`}
      </p>
      {coach.data && (
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
          <PlayerAvatar photo={coach.data.photo} name={coach.data.name} size="md" />
          <p className="min-w-0 text-sm">
            <span className="block text-xs text-white/50">{t('Teknik direktör')}</span>
            <span className="block truncate font-semibold">{coach.data.name}</span>
          </p>
        </div>
      )}

      {GROUPS.map(({ position, label }) => {
        const group = players.filter((p) => p.position === position).sort((a, b) => (a.number ?? 99) - (b.number ?? 99))
        if (group.length === 0) return null
        return (
          <section key={position}>
            <div className="mb-2 flex items-end gap-3 px-1">
              <h3 className="min-w-0 flex-1 text-sm font-semibold text-white/70">
                {t(label)} <span className="font-normal text-white/40">({group.length})</span>
              </h3>
              {/* Sütun başlıkları (satırlardaki istatistiklerle hizalı) */}
              {stats && (
                <span className="flex shrink-0 pr-3 text-[11px] font-semibold text-white/45">
                  {COLUMNS.map(([[tr, en, de], title, , always]) => (
                    <span key={title} title={t(title)} className={`${COL} ${always ? '' : 'hidden sm:block'}`}>
                      {ab(tr, en, de)}
                    </span>
                  ))}
                </span>
              )}
            </div>
            <ul className="divide-y divide-white/5 overflow-hidden rounded-xl bg-white/[0.03]">
              {group.map((p) => (
                <li key={p.id}>
                  <a href={playerHref(p.id, team.name)} className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.05]">
                    <span className="w-6 text-center text-sm font-bold text-white/55 tabular-nums">{p.number ?? '–'}</span>
                    <PlayerAvatar photo={p.photo} name={p.name} size="base" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {p.name}
                      {p.age !== null && <span className="ml-2 text-xs font-normal text-white/45 tabular-nums">{t('{n} yaş', { n: p.age })}</span>}
                    </span>
                    {stats && <StatCells stats={findSquadStats(p, stats)} />}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
