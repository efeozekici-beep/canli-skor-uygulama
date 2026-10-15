import { PAGES } from '../sports'
import SportTabs from './SportTabs'
import SearchModal from './search/SearchModal'

interface Props {
  path: string
  sport: string
  onSportChange: (id: string) => void
}

export default function Header({ path, sport, onSportChange }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-pitch-950/70 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Masaüstü: logo | arama | menü. Telefonda menü linkleri alt satıra geçer. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 pb-2 lg:flex-nowrap lg:gap-6 lg:pb-3">
          <a href="#/" className="shrink-0 text-2xl font-extrabold tracking-tight">
            Canlı<span className="text-accent">Skor</span>
          </a>

          <div className="min-w-0 flex-1 lg:max-w-xs">
            <SearchModal />
          </div>

          <nav aria-label="Ana menü" className="no-scrollbar -mx-4 w-full overflow-x-auto px-4 lg:mx-0 lg:ml-auto lg:w-auto lg:px-0">
            <ul className="flex w-max gap-1">
              {PAGES.map((page) => {
                const isActive = page.path === path
                return (
                  <li key={page.path}>
                    <a
                      href={`#${page.path}`}
                      aria-current={isActive ? 'page' : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                        isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {page.label}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>

        <SportTabs active={sport} onChange={onSportChange} />
      </div>
    </header>
  )
}
