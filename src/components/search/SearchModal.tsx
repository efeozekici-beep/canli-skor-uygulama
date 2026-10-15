import { useEffect, useId, useRef, useState } from 'react'
import KbdInputGroup from '@/components/ui/kbd-input-group'
import { useSearch } from '../../hooks/useSearch'
import { optionId, selectableResults } from '../../lib/search'
import { navigateTo } from '../../lib/navigation'
import SearchResults from './SearchResults'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

// Üst menüdeki arama: input + altında açılan sonuç paneli.
// Ctrl+K (Mac'te ⌘K) odaklar, Esc kapatır, ↑/↓ ile gezilir, Enter seçer.
export default function SearchModal() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  // Klavyeyle seçili sonucun anahtarı (lig-.. / oyuncu-..)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const { status, results } = useSearch(query)
  const selectable = selectableResults(results)
  // Seçili sonuç artık listede yoksa (yeni arama) ilk sonuç seçili sayılır
  const activeIndex = Math.max(0, selectable.findIndex((r) => r.key === activeKey))
  const active = selectable[activeIndex] ?? null

  // Ctrl+K / ⌘K: her yerden aramaya odaklan
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const close = () => {
    setOpen(false)
    setActiveKey(null)
    inputRef.current?.blur()
  }

  // Sonuca gidince panel kapanır ve metin temizlenir
  const select = (href: string) => {
    navigateTo(href)
    setQuery('')
    close()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown' && selectable.length > 0) {
      e.preventDefault()
      setOpen(true)
      setActiveKey(selectable[(activeIndex + 1) % selectable.length].key)
    } else if (e.key === 'ArrowUp' && selectable.length > 0) {
      e.preventDefault()
      setActiveKey(selectable[(activeIndex - 1 + selectable.length) % selectable.length].key)
    } else if (e.key === 'Enter' && active) {
      e.preventDefault()
      select(active.href)
    }
  }

  return (
    <div className="relative w-full">
      <KbdInputGroup
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveKey(null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="Takım, lig veya oyuncu ara…"
        aria-label="Takım, lig veya oyuncu ara"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active ? optionId(listId, active.key) : undefined}
        shortcut={isMac ? ['⌘', 'K'] : ['Ctrl', 'K']}
        className="h-10 bg-black/25"
      />

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-white/10 bg-pitch-950/95 shadow-2xl backdrop-blur-md">
          <SearchResults
            listId={listId}
            status={status}
            results={results}
            activeKey={open ? (active?.key ?? null) : null}
            onSelect={select}
          />
        </div>
      )}
    </div>
  )
}
