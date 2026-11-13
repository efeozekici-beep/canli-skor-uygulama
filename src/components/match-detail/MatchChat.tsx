import { useEffect, useRef, useState, type FormEvent } from 'react'
import { locale, t } from '../../i18n'
import { login, logout, register, useUser } from '../../services/authService'

// Maç sohbeti: herkes okur, yorum yazmak için hesap gerekir (kullanıcı adı + şifre, api/auth.ts).
// Mesajlar /api/chat'ten (Redis) gelir; sohbet açıkken ve sekme görünürken 3 saniyede bir yeni mesajlara bakılır.

interface ChatMessage {
  id: number
  name: string
  text: string
  at: number
}

const POLL_MS = 3000

const inputClass =
  'min-w-0 flex-1 rounded-full border border-white/15 bg-black/10 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none'
const buttonClass = 'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-onaccent transition-opacity hover:bg-accent/90 disabled:opacity-50'

// Giriş / kayıt formu (yorum yazmadan önce)
function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await (mode === 'login' ? login(username.trim(), password) : register(username.trim(), password))
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'Şu an işlem yapılamıyor.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl bg-white/[0.04] p-3">
      <p className="mb-2 text-sm text-white/80">{t('Yorum yazmak için giriş yap ya da hesap aç.')}</p>
      <div role="tablist" className="mb-3 flex gap-1 rounded-full bg-black/10 p-1 text-sm font-semibold">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${mode === m ? 'bg-accent text-onaccent' : 'text-white/70 hover:text-white'}`}
          >
            {m === 'login' ? t('Giriş yap') : t('Kayıt ol')}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          maxLength={20}
          placeholder={t('Kullanıcı adı')}
          aria-label={t('Kullanıcı adı')}
          className={inputClass}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          maxLength={100}
          placeholder={t('Şifre')}
          aria-label={t('Şifre')}
          className={inputClass}
        />
        <button type="submit" disabled={busy || !username.trim() || !password} className={buttonClass}>
          {mode === 'login' ? t('Giriş yap') : t('Kayıt ol')}
        </button>
      </form>
      {mode === 'register' && (
        <p className="mt-2 px-1 text-[11px] text-white/45">{t('Kullanıcı adı 3-20 karakter (harf, rakam, nokta, alt çizgi), şifre en az 6 karakter.')}</p>
      )}
      {error && (
        <p role="alert" className="mt-2 px-1 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

// Takma ada göre sabit bir renk (aynı kişi hep aynı renkte)
const NAME_COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d']
function nameColor(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0
  return NAME_COLORS[Math.abs(h) % NAME_COLORS.length]
}

const time = (at: number) => new Date(at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })

export default function MatchChat({ matchId }: { matchId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const { user, loaded: userLoaded } = useUser()
  const name = user?.name ?? ''
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Kullanıcı yukarı kaydırıp eski mesajları okuyorsa yeni mesaj gelince aşağı atlama
  const stickToBottom = useRef(true)

  // Mesajları birkaç saniyede bir al (sekme görünürken)
  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch(`/api/chat?match=${encodeURIComponent(matchId)}`)
        .then(async (res) => {
          if (!res.ok) throw new Error()
          const data = (await res.json()) as { messages: ChatMessage[] }
          if (cancelled) return
          setFailed(false)
          // Gönderdiğimiz ama henüz listede görünmeyen (CDN önbelleği) mesajlar kaybolmasın
          setMessages((prev) => {
            const byId = new Map(data.messages.map((m) => [m.id, m]))
            for (const m of prev) if (!byId.has(m.id) && m.id > (data.messages.at(-1)?.id ?? 0)) byId.set(m.id, m)
            return [...byId.values()].sort((a, b) => a.id - b.id)
          })
        })
        .catch(() => !cancelled && setFailed(true))
        .finally(() => !cancelled && setLoaded(true))
    load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [matchId])

  // Yeni mesajda en alta kaydır
  useEffect(() => {
    const el = listRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ match: matchId, text: body }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: ChatMessage | string }
      if (!res.ok || typeof data.message !== 'object') throw new Error(typeof data.message === 'string' ? data.message : 'Mesaj gönderilemedi.')
      const sent = data.message
      setMessages((prev) => [...prev.filter((m) => m.id !== sent.id), sent].sort((a, b) => a.id - b.id))
      setText('')
      stickToBottom.current = true
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'Mesaj gönderilemedi.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col p-3 sm:p-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-white/80">{t('Maç sohbeti')}</h3>
        <span className="flex items-center gap-1.5 text-xs text-white/50">
          <span aria-hidden="true" className={`size-2 rounded-full ${failed ? 'bg-white/30' : 'bg-red-500'}`} />
          {failed ? t('Bağlantı yok') : t('Canlı')}
        </span>
      </div>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={t('Sohbet mesajları')}
        onScroll={(e) => {
          const el = e.currentTarget
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
        }}
        className="h-[55vh] min-h-64 space-y-2 overflow-y-auto rounded-xl bg-white/[0.03] p-3"
      >
        {!loaded ? (
          <p className="py-10 text-center text-sm text-white/50">{t('Yükleniyor')}…</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/50">{t('Henüz yorum yok. İlk yorumu sen yaz!')}</p>
        ) : (
          messages.map((m) => {
            const own = !!name && m.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr')
            return (
              <div key={m.id} className={`rounded-lg px-3 py-1.5 text-sm ${own ? 'bg-accent/10' : ''}`}>
                <span className="font-semibold" style={{ color: nameColor(m.name) }}>
                  {m.name}
                </span>
                <span className="ml-2 text-[11px] text-white/40 tabular-nums">{time(m.at)}</span>
                <p className="break-words whitespace-pre-wrap text-white/90">{m.text}</p>
              </div>
            )
          })
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 px-1 text-xs text-red-400">
          {error}
        </p>
      )}

      {!userLoaded ? null : !user ? (
        <AuthForm />
      ) : (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
            placeholder={t('{name} olarak yorum yaz…', { name })}
            aria-label={t('Yorum yaz')}
            className={inputClass}
          />
          <button type="submit" disabled={sending || !text.trim()} className={buttonClass}>
            {t('Gönder')}
          </button>
        </form>
      )}
      {user && (
        <button type="button" onClick={() => void logout()} className="mt-1.5 self-start px-1 text-[11px] text-white/40 hover:text-white/70">
          {t('{name} hesabından çıkış yap', { name: user.name })}
        </button>
      )}
      <p className="mt-2 px-1 text-[11px] text-white/35">{t('Saygılı ol: küfürlü kelimeler yıldızlanır, mesajlar 3 gün sonra silinir.')}</p>
    </div>
  )
}
