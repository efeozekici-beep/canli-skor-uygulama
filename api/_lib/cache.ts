// Backend'in ortak önbelleği: Upstash Redis, yoksa (yerelde) hafıza.
// "_" ile başlayan klasörleri Vercel fonksiyon saymaz; burası sadece yardımcı kod.

export type Env = Record<string, string | undefined>

export interface Entry {
  expiresAt: number
  body: string
}

const memory = new Map<string, Entry>()

// Vercel'in Upstash entegrasyonu KV_* adlarını da kullanabiliyor; ikisi de kabul
function redisConfig(env: Env) {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN
  return url && token ? { url, token } : null
}

async function redis(cfg: { url: string; token: string }, command: (string | number)[]) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`)
  return ((await res.json()) as { result: unknown }).result
}

export async function cacheGet(env: Env, key: string): Promise<Entry | null> {
  const cfg = redisConfig(env)
  if (!cfg) {
    const hit = memory.get(key)
    return hit && hit.expiresAt > Date.now() ? hit : null
  }
  try {
    const raw = await redis(cfg, ['GET', key])
    return typeof raw === 'string' ? (JSON.parse(raw) as Entry) : null
  } catch (err) {
    // Redis çökerse site durmasın: doğrudan kaynaktan devam
    console.error('Redis okunamadı:', err)
    return null
  }
}

export async function cacheSet(env: Env, key: string, body: string, ttl: number) {
  const entry: Entry = { expiresAt: Date.now() + ttl * 1000, body }
  const cfg = redisConfig(env)
  if (!cfg) {
    // Hafıza şişmesin: arada süresi dolanları temizle
    if (memory.size > 500) for (const [k, v] of memory) if (v.expiresAt <= Date.now()) memory.delete(k)
    memory.set(key, entry)
    return
  }
  try {
    await redis(cfg, ['SET', key, JSON.stringify(entry), 'EX', ttl])
  } catch (err) {
    console.error('Redis yazılamadı:', err)
  }
}

/** Redis'e doğrudan komut (sohbet gibi liste / sayaç işleri için). Redis tanımlı değilse null döner (yerel hafıza kullanılır). */
export async function redisCommand(env: Env, command: (string | number)[]): Promise<unknown> {
  const cfg = redisConfig(env)
  if (!cfg) return null
  return redis(cfg, command)
}

export const hasRedis = (env: Env) => redisConfig(env) !== null

/** Kullanıcı verisi (hesaplar, oturumlar, sohbet) için anahtar öneki: yerel geliştirme canlı siteyle aynı
 *  Redis'i kullanır, karışmasın diye yerelde "dev:" eklenir (Vercel'de VERCEL=1 tanımlıdır). API önbelleği ortaktır. */
export const userScope = (env: Env) => (env.VERCEL ? '' : 'dev:')
