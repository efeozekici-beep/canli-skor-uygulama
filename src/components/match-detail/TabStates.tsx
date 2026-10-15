// Sekmelerin ortak yükleniyor / hata / boş durumları.

export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Yükleniyor" className="space-y-3 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.06]" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p role="alert" className="px-6 py-12 text-center text-sm text-red-300">
      {message}
    </p>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <p className="px-6 py-12 text-center text-sm text-white/55">{message}</p>
}
