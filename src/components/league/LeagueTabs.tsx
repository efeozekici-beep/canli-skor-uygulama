interface Props<T extends string> {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
  label: string
  /** "underline": ana sekmeler (altı çizgili), "pill": alt sekmeler (yuvarlak düğmeler) */
  variant?: 'underline' | 'pill'
}

// Lig sayfasındaki sekmeler; hem ana sekmeler hem alt sekmeler (Tümü/Ev sahibi/...) için.
export default function LeagueTabs<T extends string>({ tabs, active, onChange, label, variant = 'underline' }: Props<T>) {
  if (variant === 'pill') {
    return (
      <div role="tablist" aria-label={label} className="no-scrollbar flex gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`min-h-9 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap ring-1 ring-inset transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] ${
                isActive ? 'bg-white text-pitch-950 ring-white' : 'bg-white/5 text-white ring-white/10 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="tablist" aria-label={label} className="no-scrollbar flex overflow-x-auto border-b border-white/10 px-2">
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative min-h-12 shrink-0 px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
              isActive ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {tab.label}
            {isActive && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        )
      })}
    </div>
  )
}
