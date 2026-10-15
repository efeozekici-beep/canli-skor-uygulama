import type { ReactNode } from 'react'
import type { SearchResults as Results } from '../../types/search'
import { optionId } from '../../lib/search'
import SearchResultItem from './SearchResultItem'

interface Props {
  listId: string
  status: 'idle' | 'loading' | 'done' | 'error'
  results: Results | null
  activeKey: string | null
  onSelect: (href: string) => void
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li role="presentation">
      <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-white/40 uppercase">{title}</p>
      <ul role="group" aria-label={title}>
        {children}
      </ul>
    </li>
  )
}

// Gruplu sonuç paneli: Takımlar | Ligler | Oyuncular + yükleniyor / boş / hata durumları
export default function SearchResults({ listId, status, results, activeKey, onSelect }: Props) {
  if (status === 'idle') return <p className="px-4 py-5 text-center text-sm text-white/50">Aramak için en az 3 harf yaz.</p>
  if (status === 'loading') {
    return (
      <div role="status" aria-label="Aranıyor" className="space-y-2 p-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-8 animate-pulse rounded-full bg-white/[0.08]" />
            <div className="h-3.5 flex-1 animate-pulse rounded bg-white/[0.08]" />
          </div>
        ))}
      </div>
    )
  }
  if (status === 'error') return <p role="alert" className="px-4 py-5 text-center text-sm text-red-300">Arama şu an çalışmıyor.</p>
  if (!results || (results.teams.length === 0 && results.leagues.length === 0 && results.players.length === 0)) {
    return <p className="px-4 py-5 text-center text-sm text-white/50">Sonuç bulunamadı.</p>
  }

  const isActive = (key: string) => key === activeKey

  return (
    <ul id={listId} role="listbox" aria-label="Arama sonuçları" className="p-1">
      {results.teams.length > 0 && (
        <Group title="Takımlar">
          {results.teams.map((t) => (
            <SearchResultItem
              key={t.id}
              id={optionId(listId, `takim-${t.id}`)}
              title={t.name}
              subtitle={t.country}
              image={t.logo}
              kind="team"
              active={false}
              badge="Yakında"
            />
          ))}
        </Group>
      )}
      {results.leagues.length > 0 && (
        <Group title="Ligler">
          {results.leagues.map((l) => {
            const key = `lig-${l.id}`
            return (
              <SearchResultItem
                key={key}
                id={optionId(listId, key)}
                title={l.name}
                subtitle={l.region}
                image={l.logo}
                kind="league"
                active={isActive(key)}
                onSelect={() => onSelect(`#/lig/${encodeURIComponent(l.id)}`)}
              />
            )
          })}
        </Group>
      )}
      {results.players.length > 0 && (
        <Group title="Oyuncular">
          {results.players.map((p) => {
            const key = `oyuncu-${p.id}`
            return (
              <SearchResultItem
                key={key}
                id={optionId(listId, key)}
                title={p.name}
                subtitle={p.teamName}
                image={p.photo}
                kind="player"
                active={isActive(key)}
                onSelect={() => onSelect(`#/oyuncu/${encodeURIComponent(p.id)}`)}
              />
            )
          })}
        </Group>
      )}
    </ul>
  )
}
