import { useSyncExternalStore } from 'react'

// Giriş yapmış kullanıcı (sohbette yorum yazmak için). Oturum sunucuda, HttpOnly çerezde tutulur;
// burada sadece adı bilinir. Bütün bileşenler aynı durumu paylaşır.

export interface User {
  name: string
}

let user: User | null = null
let loaded = false
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function setUser(next: User | null) {
  user = next
  loaded = true
  emit()
}

/** Oturum açık mı: sayfa açılınca bir kez sorulur */
export function loadUser() {
  if (loaded || loading) return loading ?? Promise.resolve()
  loading = fetch('/api/auth')
    .then((res) => (res.ok ? res.json() : { user: null }))
    .then((data: { user: User | null }) => setUser(data.user))
    .catch(() => setUser(null))
    .finally(() => (loading = null))
  return loading
}

async function post(action: string, body?: unknown): Promise<User | null> {
  const res = await fetch(`/api/auth?action=${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as { user?: User | null; message?: string }
  if (!res.ok) throw new Error(data.message ?? 'Şu an işlem yapılamıyor.')
  setUser(data.user ?? null)
  return data.user ?? null
}

export const register = (username: string, password: string) => post('register', { username, password })
export const login = (username: string, password: string) => post('login', { username, password })
export const logout = () => post('logout')

export function useUser(): { user: User | null; loaded: boolean } {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (loaded ? user : undefined),
    () => undefined,
  )
  if (!loaded) void loadUser()
  return { user: snapshot ?? null, loaded: snapshot !== undefined }
}
