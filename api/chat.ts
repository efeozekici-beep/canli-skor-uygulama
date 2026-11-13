// Maç sohbeti (Vercel fonksiyonu):
//   GET  /api/chat?match=<maç id>                    -> { messages: [...] }  (son 60 mesaj, eskiden yeniye)
//   POST /api/chat  { match, text }                  -> { message }   (giriş yapmış kullanıcı; ad hesaptan gelir)
// Mesajlar Upstash Redis'te maç başına bir listede: son 200 mesaj, 3 gün saklanır. Yerelde Redis yoksa hafızada.
// Site sohbet açıkken birkaç saniyede bir GET ister (Vercel'de kalıcı bağlantı yok). GET cevabı CDN'de 2 sn
// saklanır: aynı maçı izleyen herkes aynı cevabı paylaşır, Redis'e her izleyici için ayrı istek gitmez.
// Yorum yazmak için hesap gerekir (api/auth.ts): ad, kayıtlı kullanıcı adıdır, kimse başkası adına yazamaz.
// Kötüye kullanım: mesaj 1-280 karakter; aynı kullanıcı 30 sn'de en fazla 5 mesaj; bazı küfürler yıldızlanır.

import { hasRedis, redisCommand, userScope, type Env } from './_lib/cache.js'
import { currentUser } from './_lib/session.js'

export interface ChatMessage {
  id: number
  name: string
  text: string
  at: number
}

const KEEP = 200
const SEND = 60
const TTL = 3 * 24 * 60 * 60
const RATE = { max: 5, windowSec: 30 }

const listKey = (env: Env, match: string) => `canliskor:${userScope(env)}chat:v1:${match}`

// Redis yoksa (yerelde) hafıza
const memory = new Map<string, ChatMessage[]>()
const memoryRate = new Map<string, number[]>()
let memorySeq = 0

const json = (status: number, body: unknown, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } })

const validMatch = (m: string | null): m is string => !!m && /^[\w-]{1,40}$/.test(m)

// ---------- Küfür filtresi ----------
// Kelime kelime bakılır (Türkçe harfler sadeleştirilerek); eşleşen kelime yıldızlanır. Kökle değil tam kalıpla
// eşleşir ki "sıkıntı" gibi masum kelimeler yakalanmasın.
const BAD = new RegExp(
  '^(' +
    [
      'amk', 'aq', 'amq', 'amına', 'amina\\w*', 'amcik\\w*', 'sik(er|ey|ik|im|is|tir)\\w*', 'siktir\\w*', 'orospu\\w*', 'pic', 'pici', 'piclik',
      'yarra(k|g)\\w*', 'yarak', 'ibne\\w*', 'pezevenk\\w*', 'kahpe\\w*', 'gotveren\\w*', 'gavat\\w*', 'serefsiz\\w*', 'kaltak\\w*',
      'fuck\\w*', 'motherfucker\\w*', 'shit\\w*', 'bitch\\w*', 'cunt\\w*', 'scheisse', 'arschloch\\w*', 'hurensohn\\w*', 'fotze\\w*',
    ].join('|') +
    ')$',
)
const plain = (w: string) =>
  w
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')

function clean(text: string) {
  return text
    .split(/(\s+)/)
    .map((w) => (BAD.test(plain(w)) ? '*'.repeat(Math.min(w.length, 6)) : w))
    .join('')
}

// Kontrol karakterleri atılır, boşluklar sadeleşir
const tidy = (s: unknown, max: number) =>
  String(s ?? '')
    // Kontrol karakterleri ve görünmez yön / boşluk karakterleri boşluğa çevrilir
    .split('')
    .map((ch) => {
      const c = ch.charCodeAt(0)
      return c < 32 || c === 127 || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) ? ' ' : ch
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

// ---------- Saklama ----------
async function readMessages(env: Env, match: string): Promise<ChatMessage[]> {
  if (!hasRedis(env)) return (memory.get(match) ?? []).slice(-SEND)
  const raw = (await redisCommand(env, ['LRANGE', listKey(env, match), 0, SEND - 1])) as string[] | null
  // Listenin başı en yeni mesaj: eskiden yeniye çevrilir
  return (raw ?? []).map((r) => JSON.parse(r) as ChatMessage).reverse()
}

async function rateLimited(env: Env, ip: string) {
  if (!hasRedis(env)) {
    const now = Date.now()
    const hits = (memoryRate.get(ip) ?? []).filter((t) => now - t < RATE.windowSec * 1000)
    hits.push(now)
    memoryRate.set(ip, hits)
    return hits.length > RATE.max
  }
  const key = `canliskor:${userScope(env)}chat:v1:rl:${ip}`
  const n = Number(await redisCommand(env, ['INCR', key]))
  if (n === 1) await redisCommand(env, ['EXPIRE', key, RATE.windowSec])
  return n > RATE.max
}

async function saveMessage(env: Env, match: string, name: string, text: string): Promise<ChatMessage> {
  if (!hasRedis(env)) {
    const msg = { id: ++memorySeq, name, text, at: Date.now() }
    const list = [...(memory.get(match) ?? []), msg].slice(-KEEP)
    memory.set(match, list)
    return msg
  }
  const id = Number(await redisCommand(env, ['INCR', `canliskor:${userScope(env)}chat:v1:seq`]))
  const msg = { id, name, text, at: Date.now() }
  const key = listKey(env, match)
  await redisCommand(env, ['LPUSH', key, JSON.stringify(msg)])
  await redisCommand(env, ['LTRIM', key, 0, KEEP - 1])
  await redisCommand(env, ['EXPIRE', key, TTL])
  return msg
}

// ---------- İstek ----------
export async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method === 'GET') {
      const match = new URL(request.url).searchParams.get('match')
      if (!validMatch(match)) return json(400, { message: 'match gerekli.' })
      return json(200, { messages: await readMessages(env, match) }, 'public, max-age=0, s-maxage=2')
    }
    if (request.method === 'POST') {
      const name = await currentUser(env, request)
      if (!name) return json(401, { message: 'Yorum yazmak için giriş yapmalısın.' })
      const body = (await request.json().catch(() => null)) as { match?: string; text?: string } | null
      const match = body?.match ?? null
      if (!validMatch(match)) return json(400, { message: 'Geçersiz maç.' })
      const text = clean(tidy(body?.text, 280))
      if (!text) return json(400, { message: 'Mesaj boş olamaz.' })
      if (await rateLimited(env, `user:${name.toLocaleLowerCase('tr')}`)) return json(429, { message: 'Çok hızlı yazıyorsun, biraz bekle.' })
      return json(200, { message: await saveMessage(env, match, name, text) })
    }
    return json(405, { message: 'Sadece GET ve POST desteklenir.' })
  } catch (err) {
    console.error('Sohbet hatası:', err)
    return json(502, { message: 'Sohbet şu an çalışmıyor.' })
  }
}

export function GET(request: Request) {
  return handleChatRequest(request, process.env)
}

export function POST(request: Request) {
  return handleChatRequest(request, process.env)
}
