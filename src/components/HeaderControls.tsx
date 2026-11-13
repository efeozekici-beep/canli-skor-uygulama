import { LANGS, setLang, t, useLang } from '../i18n'
import { setTheme, useTheme } from '../lib/theme'

// Üst menünün sağındaki dil seçimi (TR / EN / DE) ve açık / koyu tema düğmesi
export default function HeaderControls() {
  const lang = useLang()
  const theme = useTheme()
  const dark = theme === 'dark'

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div role="group" aria-label={t('Dil')} className="flex rounded-full bg-black/10 p-0.5 ring-1 ring-white/10 ring-inset">
        {LANGS.map((l) => {
          const active = l.id === lang
          return (
            <button
              key={l.id}
              type="button"
              lang={l.id}
              title={l.name}
              aria-label={l.name}
              aria-pressed={active}
              onClick={() => setLang(l.id)}
              className={`min-h-8 min-w-9 rounded-full px-2 text-xs font-bold transition-[background-color,color] duration-150 ease-out ${
                active ? 'bg-accent text-onaccent' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {l.label}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        aria-label={dark ? t('Açık temaya geç') : t('Koyu temaya geç')}
        title={dark ? t('Açık tema') : t('Koyu tema')}
        className="grid size-9 place-items-center rounded-full bg-black/10 text-white/80 ring-1 ring-white/10 transition-[background-color,color,transform] duration-150 ease-out ring-inset hover:bg-white/10 hover:text-white active:scale-[0.94]"
      >
        {dark ? (
          // Güneş: açık temaya geç
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px]">
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          // Ay: koyu temaya geç
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px]">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  )
}
