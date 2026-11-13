import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleApiRequest } from './api/proxy.ts'
import { handlePhotosRequest } from './api/photos.ts'
import { handleLiveRequest } from './api/live.ts'
import { handleLeadersRequest } from './api/leaders.ts'
import { handleTeamRequest } from './api/team.ts'
import { handleArchiveRequest } from './api/archive.ts'
import { handleDayRequest } from './api/day.ts'
import { handleSportsRequest } from './api/sports.ts'
import { handleChatRequest } from './api/chat.ts'
import { handleAuthRequest } from './api/auth.ts'

// Yerelde /api/* isteklerini canlıdaki backend koduyla (api/proxy.ts, api/photos.ts) karşılar:
// anahtar ekleme, izinli uç noktalar ve önbellek yerelde de aynı çalışır.
function localApi(env: Record<string, string>): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith('/api/')) return next()
    const url = req.url
    // POST (sohbet mesajı) için gövde de okunur
    const readBody = () =>
      new Promise<string | undefined>((resolve) => {
        if (req.method !== 'POST') return resolve(undefined)
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
    const handler = url.startsWith('/api/auth')
      ? handleAuthRequest
      : url.startsWith('/api/chat')
      ? handleChatRequest
      : url.startsWith('/api/photos')
      ? handlePhotosRequest
      : url.startsWith('/api/live')
        ? handleLiveRequest
        : url.startsWith('/api/leaders')
          ? handleLeadersRequest
          : url.startsWith('/api/team?') || url === '/api/team'
            ? handleTeamRequest
            : url.startsWith('/api/archive')
              ? handleArchiveRequest
              : url.startsWith('/api/day')
                ? handleDayRequest
                : url.startsWith('/api/sports?')
                  ? handleSportsRequest
                  : handleApiRequest
    readBody()
      .then((body) =>
        handler(
          new Request(new URL(url, 'http://localhost'), {
            method: req.method,
            body,
            // Oturum çerezi (giriş yapmış kullanıcı) ve içerik türü backend'e iletilir
            headers: { 'content-type': 'application/json', ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}) },
          }),
          env,
        ),
      )
      .then(async (response) => {
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(await response.text())
      })
      .catch(next)
  }
  return {
    name: 'canliskor-local-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

export default defineConfig(({ mode }) => {
  // Empty prefix loads non-VITE_ vars too; they stay on the server side.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss(), localApi(env)],
    // "@/components/ui/x" -> "src/components/ui/x" (matches tsconfig.app.json paths)
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  }
})
