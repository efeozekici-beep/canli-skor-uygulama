import TeamLogo from '../TeamLogo'
import LeagueLogo from '../common/LeagueLogo'
import PlayerAvatar from '../common/PlayerAvatar'

interface Props {
  id: string
  title: string
  subtitle: string | null
  image?: string
  /** Görsel türü: oyuncu fotoğrafı, takım logosu veya lig logosu (hepsi yüklenmezse baş harflere düşer) */
  kind: 'team' | 'league' | 'player'
  active: boolean
  /** Verilmezse satır tıklanamaz (ör. henüz sayfası olmayan takımlar) */
  onSelect?: () => void
  badge?: string
}

// Arama sonucundaki tek satır: logo/fotoğraf + ad + altta küçük bilgi
export default function SearchResultItem({ id, title, subtitle, image, kind, active, onSelect, badge }: Props) {
  const visual =
    kind === 'player' ? (
      <PlayerAvatar photo={image} name={title} size="sm" />
    ) : kind === 'league' ? (
      <LeagueLogo logo={image} name={title} size="md" />
    ) : (
      <TeamLogo logo={image} name={title} size="md" />
    )

  const content = (
    <>
      {visual}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle && <span className="block truncate text-xs text-white/50">{subtitle}</span>}
      </span>
      {badge && <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/60">{badge}</span>}
    </>
  )

  return (
    <li id={id} role="option" aria-selected={active} aria-disabled={!onSelect}>
      {onSelect ? (
        // onMouseDown: input odağı kaybolmadan önce seçim yakalansın (mobilde dokunma da bu olayı tetikler)
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect()
          }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-100 ${active ? 'bg-white/12' : 'hover:bg-white/8'}`}
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2 opacity-70">{content}</div>
      )}
    </li>
  )
}
