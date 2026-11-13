import type { ReactNode } from 'react'
import { t } from '../i18n'

interface Props {
  title: string
  subtitle?: string
  icon: ReactNode
  liveCount: number
  total: number
  /** Verilirse logo + ad bu adrese (lig sayfası) gider */
  href?: string
  children: ReactNode
}

// Lig grubu: başlık şeridi (logo, ad, bölge, canlı / toplam maç) ve altında maçlar. Gruplar hep açık.
export default function LeagueGroup({ title, subtitle, icon, liveCount, total, href, children }: Props) {
  const label = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold transition-colors duration-150 group-hover:text-accent">{t(title)}</span>
        {subtitle && <span className="block truncate text-xs text-white/50">{t(subtitle)}</span>}
      </span>
    </>
  )

  return (
    <section className="border-t border-white/10 first:border-t-0">
      {/* Lig başlığı ayrı bir şeritte: maç satırlarından net ayrılsın */}
      <div className="flex items-center gap-3 bg-black/25 px-4 py-2.5">
        {href ? (
          <a href={href} className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg" title={t('{name} sayfası', { name: t(title) })}>
            {label}
          </a>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">{label}</div>
        )}
        <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold tabular-nums">
          <span className={liveCount > 0 ? 'text-red-400' : 'text-white/50'}>{liveCount}</span>
          <span className="text-white/50">/{total}</span>
        </span>
      </div>
      {children}
    </section>
  )
}
