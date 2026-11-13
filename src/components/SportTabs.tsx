import { useEffect, useRef } from 'react'
import { SPORTS } from '../sports'
import { useDragScroll } from '../hooks/useDragScroll'
import { t } from '../i18n'

interface Props {
  active: string
  onChange: (id: string) => void
}

export default function SportTabs({ active, onChange }: Props) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  // Masaüstünde fareyle sürükleyerek / tekerlekle kaydırma (dokunmatikte parmakla kaydırma zaten var)
  const scrollRef = useDragScroll<HTMLElement>()

  // Keep the active pill visible when it sits off-screen on mobile.
  useEffect(() => {
    buttons.current.get(active)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <nav
      ref={scrollRef}
      aria-label={t('Sporlar')}
      className="no-scrollbar -mx-4 cursor-grab overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-24px),transparent)]"
    >
      <ul className="flex w-max gap-2">
        {SPORTS.map((sport) => {
          const isActive = sport.id === active
          return (
            <li key={sport.id}>
              <button
                type="button"
                ref={(el) => {
                  if (el) buttons.current.set(sport.id, el)
                  else buttons.current.delete(sport.id)
                }}
                aria-pressed={isActive}
                onClick={() => onChange(sport.id)}
                className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-[background-color,color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  isActive
                    ? 'bg-accent text-pitch-900 shadow-[0_4px_16px_rgba(29,78,216,0.35)]'
                    : 'bg-pitch-950/85 text-white ring-1 ring-white/10 ring-inset hover:bg-pitch-950'
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {sport.emoji}
                </span>
                {t(sport.label)}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
