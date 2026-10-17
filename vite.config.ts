import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleApiRequest } from './api/proxy.ts'
import { handlePhotosRequest } from './api/photos.ts'

// Yerelde /api/* isteklerini canlıdaki backend koduyla (api/proxy.ts, api/photos.ts) karşılar:
// anahtar ekleme, izinli uç noktalar ve önbellek yerelde de aynı çalışır.
function localApi(env: Record<string, string>): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith('/api/')) return next()
    const request = new Request(new URL(req.url, 'http://localhost'), { method: req.method })
    const handler = req.url.startsWith('/api/photos') ? handlePhotosRequest : handleApiRequest
    handler(request, env)
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
