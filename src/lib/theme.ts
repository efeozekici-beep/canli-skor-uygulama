import { useSyncExternalStore } from 'react'

// Açık / koyu tema. Kullanıcı seçmediyse cihazın ayarı (prefers-color-scheme) kullanılır ve cihaz ayarı
// değişince site de değişir. Seçim tarayıcıda saklanır. İlk boyamadan önce temayı index.html'deki küçük
// betik koyar (sayfa açılırken beyaz-koyu yanıp sönmesin).

export type Theme = 'light' | 'dark'

const KEY = 'canliskor:theme'
const listeners = new Set<() => void>()
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const systemTheme = (): Theme => (media?.matches ? 'dark' : 'light')

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  // Telefon tarayıcısının üst çubuğu da temaya uysun
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a1530' : '#ffffff')
  listeners.forEach((l) => l())
}

export const getTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Saklanamazsa sadece bu oturumda geçerli olur
  }
  apply(theme)
}

media?.addEventListener('change', () => {
  if (!stored()) apply(systemTheme())
})

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getTheme,
    () => 'light',
  )
}
