import type { SearchResults } from '../types/search'

// Klavye ile seçilebilen bir sonuç (takım, lig veya oyuncu)
export interface SelectableResult {
  key: string
  href: string
}

// Seçilebilir sonuçlar sırası ekrandakiyle aynı: takımlar, ligler, oyuncular
export function selectableResults(results: SearchResults | null): SelectableResult[] {
  if (!results) return []
  return [
    ...results.teams.map((t) => ({ key: `takim-${t.id}`, href: t.href })),
    ...results.leagues.map((l) => ({ key: `lig-${l.id}`, href: `#/lig/${encodeURIComponent(l.id)}` })),
    ...results.players.map((p) => ({ key: `oyuncu-${p.id}`, href: p.href })),
  ]
}

// Ekran okuyucular için her sonucun benzersiz id'si (aria-activedescendant)
export const optionId = (listId: string, key: string) => `${listId}-${key}`
