import { useId, type ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  icon: ReactNode
  liveCount: number
  total: number
  collapsed: boolean
  onToggle: () => void
  /** Verilirse logo + ad bu adrese (lig sayfası) gider; ok sadece katlar */
  href?: string
  children: ReactNode
}

export default function LeagueGroup({ title, subtitle, icon, liveCount, total, collapsed, onToggle, href, children }: Props) {
  const panelId = useId()

  const label = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold transition-colors duration-150 group-hover:text-accent">{title}</span>
        {subtitle && <span className="block truncate text-xs text-white/50">{subtitle}</span>}
      </span>
    </>
  )

  return (
    <section className="border-t border-white/10 first:border-t-0">
      {/* Lig başlığı koyu bir şeritte: maç satırlarından net ayrılsın (Flashscore/Mackolik tarzı) */}
      <div className="flex items-center gap-3 bg-black/25 px-4 py-2.5">
        {href ? (
          <a href={href} className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg" title={`${title} sayfası`}>
            {label}
          </a>
        ) : (
          // Lig sayfası yoksa (Favoriler grubu) başlığa tıklamak da katlar
          <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            {label}
          </button>
        )}
        <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold tabular-nums">
          <span className={liveCount > 0 ? 'text-red-400' : 'text-white/50'}>{liveCount}</span>
          <span className="text-white/50">/{total}</span>
        </span>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          aria-label={collapsed ? `${title} maçlarını göster` : `${title} maçlarını gizle`}
          onClick={onToggle}
          className="grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-white/10 ring-inset transition-colors duration-150 hover:bg-white/10"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className={`size-5 transition-transform duration-200 ease-out ${collapsed ? 'rotate-180' : ''}`}
          >
            <path d="M5 12.5 10 7.5l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div
        id={panelId}
        inert={collapsed}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </section>
  )
}
