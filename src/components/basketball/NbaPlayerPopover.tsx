import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { NbaPlayerLine } from '../../types/basketball'
import { getBasketballCareer, getNbaPlayerProfile, type CareerSource } from '../../services/basketballService'
import { useDetailData } from '../../hooks/useDetailData'
import PlayerAvatar from '../common/PlayerAvatar'

interface Props {
  line: NbaPlayerLine
  teamName: string
  /** Backend'in bulduğu fotoğraf (yoksa baş harfler) */
  photo?: string
  /** Oyuncu geçmişinin kaynağı (NBA / EuroLeague / EuroCup); diğer liglerde null: tablo gösterilmez */
  careerSource?: CareerSource | null
  /** Profil sadece NBA oyuncuları için var (API-NBA); diğer liglerde sadece maç istatistiği */
  showProfile: boolean
  onClose: () => void
}

// Oyuncuya tıklayınca: maç istatistiği + (NBA'da) API-NBA profili. Profil sadece pencere açılınca çekilir.
export default function NbaPlayerPopover({ line, teamName, photo, showProfile, careerSource = null, onClose }: Props) {
  const profile = useDetailData(showProfile ? `nba-player:${line.playerId}` : null, () => getNbaPlayerProfile(line.playerId))
  // Sezon sezon ortalamalar: pencere açılınca çekilir
  const career = useDetailData(careerSource ? `bb-career:${line.name}:${JSON.stringify(careerSource)}` : null, () =>
    careerSource ? getBasketballCareer(line.name, careerSource) : Promise.resolve(null),
  )
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const p = profile.data
  const facts: [string, string | null][] = p
    ? [
        ['Mevki', p.position],
        ['Forma', p.jersey !== null ? `#${p.jersey}` : null],
        ['Boy', p.height],
        ['Kilo', p.weight],
        ['Doğum', p.birthDate ? new Date(p.birthDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : null],
        ['Ülke', p.country],
        ['Üniversite', p.college],
        ['NBA\'de ilk yıl', p.nbaStart !== null ? String(p.nbaStart) : null],
      ]
    : []
  const shown = facts.filter((f): f is [string, string] => f[1] !== null)
  const pct = (m: number, a: number) => (a ? ` (%${Math.round((m / a) * 100)})` : '')

  // Portal: panelin backdrop-blur'u "fixed" pencereyi hapsetmesin diye doğrudan <body>'ye
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-pitch-900 p-5 shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start gap-3">
          <PlayerAvatar photo={photo} name={line.name} size="xl" />
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="truncate text-lg font-bold">
              {line.name}
            </h3>
            <p className="text-sm text-white/60">{teamName}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Kapat" className="grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/10">
            ✕
          </button>
        </div>

        {/* Bu maçtaki istatistikler */}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['Sayı', line.points],
            ['Ribaund', line.rebounds],
            ['Asist', line.assists],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-white/5 py-2">
              <dt className="text-xs text-white/50">{label}</dt>
              <dd className="text-xl font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-white/55 tabular-nums">
          Saha: {line.fgm}/{line.fga}{pct(line.fgm, line.fga)} · 3 sayı: {line.tpm}/{line.tpa} · Serbest: {line.ftm}/{line.fta}
          {line.minutes && ` · ${line.minutes} dk`}
        </p>

        {/* Kariyer: sezon sezon maç başı ortalamalar (yeniden eskiye) */}
        {careerSource && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <h4 className="mb-2 text-sm font-semibold text-white/80">Kariyer (maç başı ortalama)</h4>
            {career.loading ? (
              <div className="h-24 animate-pulse rounded-lg bg-white/[0.06]" />
            ) : !career.data || career.data.length === 0 ? (
              <p className="text-sm text-white/55">Bu oyuncunun geçmiş istatistiği bulunamadı.</p>
            ) : (
              <table className="w-full text-xs tabular-nums">
                <thead className="text-white/45">
                  <tr>
                    <th className="py-1 text-left font-semibold">Sezon</th>
                    <th className="py-1 text-left font-semibold">Takım</th>
                    <th className="py-1 text-center font-semibold" title="Maç">M</th>
                    <th className="py-1 text-center font-semibold" title="Sayı">SAY</th>
                    <th className="py-1 text-center font-semibold" title="Ribaund">RİB</th>
                    <th className="py-1 text-center font-semibold" title="Asist">AST</th>
                  </tr>
                </thead>
                <tbody>
                  {career.data.slice(0, 10).map((s) => (
                    <tr key={`${s.season}-${s.team}`} className="border-t border-white/5">
                      <td className="py-1.5 text-white/70">{s.season}</td>
                      <td className="max-w-0 truncate py-1.5 pr-1">{s.team ?? '–'}</td>
                      <td className="py-1.5 text-center text-white/70">{s.games}</td>
                      <td className="py-1.5 text-center font-bold">{s.points}</td>
                      <td className="py-1.5 text-center">{s.rebounds}</td>
                      <td className="py-1.5 text-center">{s.assists}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* API-NBA profili (sadece NBA) */}
        {showProfile && (
        <div className="mt-4 border-t border-white/10 pt-3">
          {profile.loading ? (
            <div className="h-16 animate-pulse rounded-lg bg-white/[0.06]" />
          ) : profile.error ? (
            <p className="text-sm text-red-300">Profil şu an alınamıyor.</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-white/55">Profil bilgisi bulunmuyor.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-2">
              {shown.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white/5 px-3 py-1.5">
                  <dt className="text-[11px] text-white/50">{label}</dt>
                  <dd className="truncate text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
