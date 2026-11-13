// Hesap işlemleri (Vercel fonksiyonu):
//   GET  /api/auth                                   -> { user: { name } | null }   (oturum açık mı)
//   POST /api/auth?action=register { username, password }
//   POST /api/auth?action=login    { username, password }
//   POST /api/auth?action=logout
// Oturum HttpOnly çerezde (api/_lib/session.ts). Giriş / kayıt denemeleri IP başına sınırlı.

import type { Env } from './_lib/cache.js'
import {
  checkPassword,
  clientIp,
  createSession,
  createUser,
  currentUser,
  endSession,
  sessionCookie,
  sessionToken,
  tooMany,
  validUsername,
} from './_lib/session.js'

const json = (status: number, body: unknown, cookie?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) },
  })

export async function handleAuthRequest(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method === 'GET') {
      const name = await currentUser(env, request)
      return json(200, { user: name ? { name } : null })
    }
    if (request.method !== 'POST') return json(405, { message: 'Sadece GET ve POST desteklenir.' })

    const action = new URL(request.url).searchParams.get('action')
    if (action === 'logout') {
      const token = sessionToken(request)
      if (token) await endSession(env, token)
      return json(200, { user: null }, sessionCookie(request, null))
    }
    if (action !== 'login' && action !== 'register') return json(400, { message: 'Geçersiz işlem.' })

    const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null
    const username = String(body?.username ?? '').trim()
    const password = String(body?.password ?? '')
    const ip = clientIp(request)

    if (action === 'register') {
      if (await tooMany(env, `register:${ip}`, 5, 60 * 60)) return json(429, { message: 'Çok fazla deneme, biraz sonra tekrar dene.' })
      if (!validUsername(username)) return json(400, { message: 'Kullanıcı adı 3-20 karakter olmalı; harf, rakam, nokta ve alt çizgi kullanılabilir.' })
      if (password.length < 6 || password.length > 100) return json(400, { message: 'Şifre en az 6 karakter olmalı.' })
      if (!(await createUser(env, username, password))) return json(409, { message: 'Bu kullanıcı adı alınmış.' })
      const token = await createSession(env, username)
      return json(200, { user: { name: username } }, sessionCookie(request, token))
    }

    if (await tooMany(env, `login:${ip}`, 10, 10 * 60)) return json(429, { message: 'Çok fazla deneme, biraz sonra tekrar dene.' })
    const name = await checkPassword(env, username, password)
    if (!name) return json(401, { message: 'Kullanıcı adı ya da şifre yanlış.' })
    const token = await createSession(env, name)
    return json(200, { user: { name } }, sessionCookie(request, token))
  } catch (err) {
    console.error('Hesap işlemi başarısız:', err)
    return json(502, { message: 'Şu an işlem yapılamıyor.' })
  }
}

export function GET(request: Request) {
  return handleAuthRequest(request, process.env)
}

export function POST(request: Request) {
  return handleAuthRequest(request, process.env)
}
