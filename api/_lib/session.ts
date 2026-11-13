// Kullanıcı hesapları ve oturumlar (sohbet için). Hesaplar ve oturumlar Upstash Redis'te; yerelde Redis yoksa hafızada.
//  - Şifre açık tutulmaz: scrypt ile tuzlanıp özetlenir.
//  - Oturum: rastgele anahtar, HttpOnly çerezde (sayfadaki kod okuyamaz), Redis'te 30 gün.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { hasRedis, redisCommand, userScope, type Env } from './cache.js'

const scrypt = promisify(scryptCb) as (password: string, salt: string, keylen: number) => Promise<Buffer>

export const SESSION_COOKIE = 'cs_session'
export const SESSION_DAYS = 30
const SESSION_TTL = SESSION_DAYS * 24 * 60 * 60

interface StoredUser {
  name: string
  salt: string
  hash: string
  created: number
}

const memory = new Map<string, string>()

async function get(env: Env, key: string): Promise<string | null> {
  if (!hasRedis(env)) return memory.get(key) ?? null
  const v = await redisCommand(env, ['GET', key])
  return typeof v === 'string' ? v : null
}

async function set(env: Env, key: string, value: string, ttl?: number, onlyIfNew = false): Promise<boolean> {
  if (!hasRedis(env)) {
    if (onlyIfNew && memory.has(key)) return false
    memory.set(key, value)
    return true
  }
  const cmd: (string | number)[] = ['SET', key, value]
  if (ttl) cmd.push('EX', ttl)
  if (onlyIfNew) cmd.push('NX')
  return (await redisCommand(env, cmd)) === 'OK'
}

async function del(env: Env, key: string) {
  if (!hasRedis(env)) return void memory.delete(key)
  await redisCommand(env, ['DEL', key])
}

const userKey = (env: Env, name: string) => `canliskor:${userScope(env)}user:v1:${name.toLocaleLowerCase('tr')}`
const sessionKey = (env: Env, token: string) => `canliskor:${userScope(env)}session:v1:${token}`

// Kullanıcı adı: 3-20 karakter; harf (Türkçe dahil), rakam, nokta, alt çizgi
export const validUsername = (name: string) => /^[A-Za-z0-9_.çğıöşüÇĞİÖŞÜ]{3,20}$/.test(name)

async function hashPassword(password: string, salt: string) {
  return (await scrypt(password, salt, 64)).toString('hex')
}

export async function createUser(env: Env, name: string, password: string): Promise<boolean> {
  const salt = randomBytes(16).toString('hex')
  const user: StoredUser = { name, salt, hash: await hashPassword(password, salt), created: Date.now() }
  // NX: aynı ad (büyük / küçük harf fark etmez) ikinci kez alınamaz
  return set(env, userKey(env, name), JSON.stringify(user), undefined, true)
}

export async function checkPassword(env: Env, name: string, password: string): Promise<string | null> {
  const raw = await get(env, userKey(env, name))
  if (!raw) return null
  const user = JSON.parse(raw) as StoredUser
  const hash = Buffer.from(await hashPassword(password, user.salt), 'hex')
  const stored = Buffer.from(user.hash, 'hex')
  return hash.length === stored.length && timingSafeEqual(hash, stored) ? user.name : null
}

export async function createSession(env: Env, name: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await set(env, sessionKey(env, token), name, SESSION_TTL)
  return token
}

export async function endSession(env: Env, token: string) {
  await del(env, sessionKey(env, token))
}

export function sessionToken(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? ''
  const m = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([A-Za-z0-9_-]{20,})`).exec(cookie)
  return m ? m[1] : null
}

/** İsteği yapan kullanıcının adı (giriş yapmamışsa null) */
export async function currentUser(env: Env, request: Request): Promise<string | null> {
  const token = sessionToken(request)
  return token ? get(env, sessionKey(env, token)) : null
}

/** Oturum çerezi: HttpOnly, SameSite=Lax; https'te Secure */
export function sessionCookie(request: Request, token: string | null) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return token
    ? `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}${secure}`
    : `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

export { tooMany, clientIp } from './limit.js'
