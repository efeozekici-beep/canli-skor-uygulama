import type { BasketballCareerSeason } from '../types/team'
import { getPlayerCareer } from '../services/basketballTeamService'
import { useDetailData } from '../hooks/useDetailData'
import { basketballTeamHref } from '../lib/navigation'
import TeamLogo from '../components/TeamLogo'
import PlayerAvatar from '../components/common/PlayerAvatar'
import { EmptyState, ErrorState, LoadingState } from '../components/match-detail/TabStates'
import { t } from '../i18n'

interface Props {
  leagueId: string
  /** NBA: ESPN oyuncu id'si, EuroLeague / EuroCup: oyuncu kodu */
  playerId: string
  onBack: () => void
}

// Tablo sütunları: [başlık, açıklama, değer]
const COLUMNS: [string, string, (s: BasketballCareerSeason) => number | string | null][] = [
  ['M', 'Oynadığı maç', (s) => s.games],
  ['İ5', 'İlk 5 başladığı maç', (s) => s.starts],
  ['DK', 'Maç başı dakika', (s) => s.minutes],
  ['SAY', 'Maç başı sayı', (s) => s.points],
  ['RİB', 'Maç başı ribaund', (s) => s.rebounds],
  ['AST', 'Maç başı asist', (s) => s.assists],
  ['TÇ', 'Maç başı top çalma', (s) => s.steals],
  ['BLK', 'Maç başı blok', (s) => s.blocks],
  ['TK', 'Maç başı top kaybı', (s) => s.turnovers],
  ['SAHA%', 'Saha içi isabet yüzdesi', (s) => s.fgPct],
  ['3S%', 'Üç sayı isabet yüzdesi', (s) => s.threePct],
  ['SA%', 'Serbest atış isabet yüzdesi', (s) => s.ftPct],
]

// Basketbol oyuncu sayfası (#/oyuncu/bb/bb-12/3112335): profil + sezon sezon bütün istatistikler ve takımı
export default function BasketballPlayerPage({ leagueId, playerId, onBack }: Props) {
  const career = useDetailData(`bb-player:${leagueId}:${playerId}`, () => getPlayerCareer(leagueId, playerId))
  const data = career.data
  const p = data?.profile
  const hasPir = data?.seasons.some((s) => s.pir !== null) ?? false
  const multiComp = new Set(data?.seasons.map((s) => s.competition)).size > 1
  const facts: [string, string | null][] = p
    ? [
        ['Mevki', p.position],
        ['Forma', p.number ? `#${p.number}` : null],
        ['Yaş', p.age !== null ? String(p.age) : null],
        ['Boy', p.height],
        ['Kilo', p.weight],
        ['Uyruk', p.nationality],
      ]
    : []
  const th = 'px-2 py-2 text-center font-semibold whitespace-nowrap'
  const td = 'px-2 py-2 text-center whitespace-nowrap'

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-white/10 bg-pitch-950/95 px-2 py-1.5 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('Geri')}
          className="grid size-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="px-2 text-xs font-medium text-accent">{t('Oyuncu')}</p>
      </div>

      {career.loading ? (
        <LoadingState rows={8} />
      ) : career.error ? (
        <ErrorState message={career.error} />
      ) : !data || !p ? (
        <EmptyState message={t('Bu oyuncu için veri bulunmuyor.')} />
      ) : (
        <>
          <div className="px-4 py-5 sm:px-6">
            <div className="flex items-center gap-4">
              <PlayerAvatar photo={p.photo ?? undefined} name={p.name} size="2xl" className="ring-2 ring-white/15" />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold sm:text-3xl">{p.name}</h1>
                {p.team && (
                  <a href={basketballTeamHref(leagueId, { name: p.team })} className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-accent">
                    <TeamLogo name={p.team} logo={p.teamLogo ?? undefined} />
                    {p.team}
                  </a>
                )}
              </div>
            </div>
            {facts.some((f) => f[1]) && (
              <dl className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {facts
                  .filter((f): f is [string, string] => f[1] !== null)
                  .map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-white/5 px-3 py-2">
                      <dt className="text-xs text-white/50">{t(label)}</dt>
                      <dd className="truncate text-sm font-semibold">{typeof value === 'string' ? t(value) : value}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </div>

          <section className="border-t border-white/10 p-3 sm:p-5">
            <h2 className="mb-1 px-1 text-sm font-semibold text-white/80">{t('Kariyer')}</h2>
            <p className="mb-3 px-1 text-xs text-white/45">{t('Sezon sezon maç başı ortalamalar; yüzdeler isabet oranı.')}</p>
            {data.seasons.length === 0 ? (
              <EmptyState message={t('Geçmiş sezon istatistiği bulunamadı.')} />
            ) : (
              // Dar ekranda yatay kaydırılır; sezon ve takım sütunu solda sabit
              <div className="no-scrollbar overflow-x-auto rounded-xl bg-white/[0.03]">
                <table className="w-full text-sm tabular-nums">
                  <thead className="text-[11px] text-white/45">
                    <tr>
                      <th className={`${th} sticky left-0 bg-pitch-950 text-left`}>{t('Sezon / Takım')}</th>
                      {multiComp && <th className={`${th} text-left`}>Turnuva</th>}
                      {COLUMNS.map(([label, title]) => (
                        <th key={label} className={th} title={t(title)}>
                          {t(label)}
                        </th>
                      ))}
                      {hasPir && (
                        <th className={th} title={t('Verimlilik puanı (PIR)')}>
                          PIR
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.seasons.map((s, i) => (
                      <tr key={`${s.season}-${s.competition}-${s.team}`} className={`border-t border-white/5 ${i === 0 ? 'bg-accent/[0.06]' : ''}`}>
                        <td className="sticky left-0 bg-pitch-950 px-2 py-2">
                          <span className="flex items-center gap-2">
                            <TeamLogo name={s.team ?? '?'} logo={s.teamLogo ?? undefined} />
                            <span className="min-w-0">
                              <span className="block text-xs text-white/55">{s.season}</span>
                              <span className="block max-w-36 truncate font-medium">{s.team ?? '–'}</span>
                            </span>
                          </span>
                        </td>
                        {multiComp && <td className="px-2 py-2 text-xs whitespace-nowrap text-white/60">{s.competition}</td>}
                        {COLUMNS.map(([label, , value]) => {
                          const v = value(s)
                          return (
                            <td key={label} className={`${td} ${label === 'SAY' ? 'font-bold' : label === 'M' || label === 'İ5' ? 'text-white/60' : ''}`}>
                              {v === null ? '–' : v}
                            </td>
                          )
                        })}
                        {hasPir && <td className={`${td} font-semibold`}>{s.pir ?? '–'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
