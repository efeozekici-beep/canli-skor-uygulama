import { readStore, writeStore } from '../../lib/storageCache'

// Ücretsiz plan bir isteği engellediğinde (ör. bu sezonun puan durumu)
export class ProviderPlanError extends Error {}

// Bütün API-Sports kaynakları (football, basketball, nba) aynı cevap biçimini kullanır:
// { errors: [...] | {...}, response: ... }. Hata HTTP 200 ile gelebilir.
interface ApiSportsResponse<T> {
  errors: unknown[] | Record<string, string>
  response: T
}

export async function providerGet<T>(label: string, baseUrl: string, path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, { signal })
  if (!res.ok) throw new Error(`${label} isteği başarısız (HTTP ${res.status}).`)
  const body = (await res.json()) as ApiSportsResponse<T>
  if (!Array.isArray(body.errors) && body.errors.plan) {
    throw new ProviderPlanError(`Ücretsiz ${label} planı bu veriye erişim vermiyor (bu sezonun puan durumu ücretli planda).`)
  }
  const errors = Array.isArray(body.errors) ? body.errors : Object.values(body.errors)
  if (errors.length > 0) throw new Error(`${label}: ${errors.join(' ')}`)
  return body.response
}

// Kaynağa özel önbellek: hafıza + sessionStorage. Her kaynak kendi önekini ve sürelerini kullanır,
// böylece bir kaynağın önbelleği diğerini etkilemez.
export function createCache(prefix: string) {
  const memory = new Map<string, { at: number; ttl: number; promise: Promise<unknown> }>()

  return function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const hit = memory.get(key)
    if (hit && Date.now() - hit.at < hit.ttl) return hit.promise as Promise<T>
    const storageKey = `canliskor:${prefix}:${key}`
    const promise = (async () => {
      const stored = readStore<T>(storageKey, ttl)
      if (stored !== null) return stored
      // Plan hatası da saklanır: yoksa sekme her açıldığında aynı hata için kota harcanır
      const storedError = readStore<string>(`${storageKey}:error`, ttl)
      if (storedError) throw new ProviderPlanError(storedError)
      try {
        const value = await load()
        if (value !== null) writeStore(storageKey, value)
        return value
      } catch (err) {
        if (err instanceof ProviderPlanError) writeStore(`${storageKey}:error`, err.message)
        throw err
      }
    })()
    memory.set(key, { at: Date.now(), ttl, promise })
    // Diğer hatalarda saklama: bir sonraki denemede tekrar istensin
    promise.catch((err: unknown) => {
      if (!(err instanceof ProviderPlanError)) memory.delete(key)
    })
    return promise
  }
}

// Mock'ta yükleniyor durumunu görebilmek için küçük gecikme
export const mockDelay = <T>(value: T, ms = 250) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

// "2026-10-15" (yerel tarih)
export function ymd(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
