import { useState } from 'react'
import type { Match } from '../../types/match'
import type { NbaPlayerLine } from '../../types/basketball'
import { getBasketballBoxScore, isNbaMatch } from '../../services/basketballService'
import { getPlayerPhotos } from '../../services/photoService'
import { useDetailData } from '../../hooks/useDetailData'
import TeamLogo from '../TeamLogo'
import PlayerAvatar from '../common/PlayerAvatar'
import NbaPlayerPopover from './NbaPlayerPopover'
import { EmptyState, ErrorState, LoadingState } from '../match-detail/TabStates'

// "–": bu kaynak o istatistiği vermiyor
const dash = (v: number | null) => (v === null ? '–' : v)

// Box score: sekme açılınca çekilir (NBA: API-NBA, diğer ligler: API-Basketball). Veri yoksa hata değil boş durum.
export default function BoxScoreTab({ match }: { match: Match }) {
  const detail = useDetailData(`bb-box:${match.id}`, () => getBasketballBoxScore(match))
  const [side, setSide] = useState<'home' | 'away'>('home')
  const [selected, setSelected] = useState<{ line: NbaPlayerLine; teamName: string } | null>(null)
  // Fotoğraflar box score geldikten sonra iki takım için tek istekte sorulur; gelmezse baş harfler kalır
  const box = detail.data?.kind === 'matched' ? detail.data.box : null
  const names = box ? [...box.home.players, ...box.away.players].map((p) => p.name) : []
  const photos = useDetailData(box ? `bb-photos:${match.id}:${names.length}` : null, () =>
    getPlayerPhotos(isNbaMatch(match) ? 'nba' : 'basketball', names),
  )
  const photoOf = (name: string) => photos.data?.[name] ?? undefined

  if (match.status === 'upcoming') return <EmptyState message="İstatistikler maç başlayınca görünecek." />
  if (detail.loading) return <LoadingState rows={8} />
  // API-NBA hata verse de maçın temel bilgileri (Özet sekmesi) API-Basketball'dan gelmeye devam eder
  if (detail.error) return <ErrorState message="Oyuncu istatistikleri şu an alınamıyor." />
  if (!box) return <EmptyState message="Detaylı istatistik bulunmuyor." />

  const team = box[side]
  const th = 'px-2 py-2 font-semibold whitespace-nowrap'
  const td = 'px-2 py-2 text-center whitespace-nowrap'

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <div role="tablist" aria-label="Takım" className="grid grid-cols-2 gap-1 rounded-full bg-black/30 p-1">
        {(['home', 'away'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={s === side}
            onClick={() => setSide(s)}
            className={`flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors duration-150 ${
              s === side ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <TeamLogo name={box[s].team.name} logo={box[s].team.logo} />
            <span className="truncate">{box[s].team.name}</span>
          </button>
        ))}
      </div>

      {team.players.length === 0 ? (
        <EmptyState message="Bu takım için oyuncu istatistiği yok." />
      ) : (
        // Dar ekranda tablo yatay kaydırılır
        <div className="no-scrollbar overflow-x-auto rounded-xl bg-white/[0.03]">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-white/45">
              <tr>
                <th className={`${th} sticky left-0 bg-[#131b16] text-left`}>Oyuncu</th>
                <th className={th} title="Dakika">DK</th>
                <th className={th} title="Sayı">SAY</th>
                <th className={th} title="Ribaund">RİB</th>
                <th className={th} title="Asist">AST</th>
                <th className={th} title="Top çalma">TÇ</th>
                <th className={th} title="Blok">BLK</th>
                <th className={th} title="Top kaybı">TK</th>
                <th className={th} title="Saha içi isabet / deneme">SAHA</th>
                <th className={th} title="Üç sayı isabet / deneme">3S</th>
                <th className={th} title="Serbest atış isabet / deneme">SA</th>
                <th className={th} title="Sahadayken skor farkı">+/-</th>
              </tr>
            </thead>
            <tbody>
              {team.players.map((p) => (
                <tr key={p.playerId} className="border-t border-white/5">
                  <td className="sticky left-0 bg-[#131b16] px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setSelected({ line: p, teamName: team.team.name })}
                      className="flex items-center gap-2 text-left font-medium hover:text-accent"
                    >
                      <PlayerAvatar photo={photoOf(p.name)} name={p.name} size="sm" />
                      <span className="whitespace-nowrap">{p.name}</span>
                      {p.position && <span className="text-xs text-white/40">{p.position}</span>}
                    </button>
                  </td>
                  <td className={`${td} text-white/60`}>{p.minutes ?? '–'}</td>
                  <td className={`${td} font-bold`}>{p.points}</td>
                  <td className={td}>{p.rebounds}</td>
                  <td className={td}>{p.assists}</td>
                  <td className={td}>{dash(p.steals)}</td>
                  <td className={td}>{dash(p.blocks)}</td>
                  <td className={td}>{dash(p.turnovers)}</td>
                  <td className={td}>
                    {p.fgm}-{p.fga}
                  </td>
                  <td className={td}>
                    {p.tpm}-{p.tpa}
                  </td>
                  <td className={td}>
                    {p.ftm}-{p.fta}
                  </td>
                  <td className={`${td} ${p.plusMinus !== null && p.plusMinus > 0 ? 'text-accent' : p.plusMinus !== null && p.plusMinus < 0 ? 'text-red-300' : ''}`}>
                    {p.plusMinus === null ? '–' : p.plusMinus > 0 ? `+${p.plusMinus}` : p.plusMinus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-white/40">
        {box.profiles === 'nba' ? 'Oyuncu adına dokunarak profilini görebilirsin.' : 'Oyuncu adına dokunarak maç istatistiklerini görebilirsin.'}
      </p>

      {selected && (
        <NbaPlayerPopover line={selected.line} teamName={selected.teamName} photo={photoOf(selected.line.name)} showProfile={box.profiles === 'nba'} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
