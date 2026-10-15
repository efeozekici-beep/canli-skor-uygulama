import type { SearchResults } from '../types/search'

// Klavye ile seçilebilen bir sonuç (lig veya oyuncu)
export interface SelectableResult {
  key: string
  href: string
}

// Seçilebilir sonuçlar sırası: önce ligler, sonra oyuncular (takım sayfası henüz yok)
export function selectableResults(results: SearchResults | null): SelectableResult[] {
  if (!results) return []
  return [
    ...results.leagues.map((l) => ({ key: `lig-${l.id}`, href: `#/lig/${encodeURIComponent(l.id)}` })),
    ...results.players.map((p) => ({ key: `oyuncu-${p.id}`, href: `#/oyuncu/${encodeURIComponent(p.id)}` })),
  ]
}

// Ekran okuyucular için her sonucun benzersiz id'si (aria-activedescendant)
export const optionId = (listId: string, key: string) => `${listId}-${key}`
