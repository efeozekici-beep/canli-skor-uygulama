// Tarayıcı depolaması tabanlı basit önbellek: sayfa yenilense de aynı veri tekrar istenmez.
// Varsayılan sessionStorage (sekme kapanınca silinir); kalıcı olması gerekenler localStorage kullanır.
// Günlük API kotasını korumak için.

type StoreKind = 'session' | 'local'

const storage = (kind: StoreKind) => (kind === 'local' ? localStorage : sessionStorage)

export function readStore<T>(key: string, maxAgeMs: number, kind: StoreKind = 'session'): T | null {
  try {
    const raw = storage(kind).getItem(key)
    if (!raw) return null
    const { at, value } = JSON.parse(raw) as { at: number; value: T }
    return Date.now() - at < maxAgeMs ? value : null
  } catch {
    return null
  }
}

export function writeStore<T>(key: string, value: T, kind: StoreKind = 'session') {
  try {
    storage(kind).setItem(key, JSON.stringify({ at: Date.now(), value }))
  } catch {
    // Depolama dolu ya da kapalı: bir sonraki seferde tekrar istenir.
  }
}
