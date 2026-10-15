import { useCallback, useMemo, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'canliskor:favorites'

function load(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

// Favoriler tek bir ortak depoda tutulur; listedeki ve detay panelindeki yıldızlar
// aynı veriyi okur, biri değişince hepsi güncellenir.
let ids = load()
const listeners = new Set<() => void>()

function setIds(next: string[]) {
  ids = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage can be unavailable (private mode); favorites then last for the session.
  }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  // Başka bir sekmede değişirse burada da güncellensin.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return
    ids = load()
    notify()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(notify)
    window.removeEventListener('storage', onStorage)
  }
}

export function useFavorites() {
  const snapshot = useSyncExternalStore(subscribe, () => ids)
  const favorites = useMemo(() => new Set(snapshot), [snapshot])

  const toggleFavorite = useCallback((id: string) => {
    setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  }, [])

  return { favorites, toggleFavorite }
}
