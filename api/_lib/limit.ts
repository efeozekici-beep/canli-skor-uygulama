// İstek sınırı (IP / kullanıcı başına): Redis'te sayaç, yoksa hafızada. Sohbet, giriş ve API istekleri kullanır.
import { hasRedis, redisCommand, type Env } from './cache.js'

/** Basit deneme sınırı (giriş / kayıt): aynı IP pencere içinde en fazla max deneme */
const memoryRate = new Map<string, number[]>()
export async function tooMany(env: Env, key: string, max: number, windowSec: number) {
  if (!hasRedis(env)) {
    const now = Date.now()
    const hits = (memoryRate.get(key) ?? []).filter((t) => now - t < windowSec * 1000)
    hits.push(now)
    memoryRate.set(key, hits)
    return hits.length > max
  }
  const k = `canliskor:rl:v1:${key}`
  const n = Number(await redisCommand(env, ['INCR', k]))
  if (n === 1) await redisCommand(env, ['EXPIRE', k, windowSec])
  return n > max
}

export const clientIp = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'yerel'
