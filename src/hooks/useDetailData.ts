import { useEffect, useState } from 'react'

interface State<T> {
  key: string
  data?: T
  error?: string
}

// Bir sekmenin verisini yükler. "key" değişince yeniden yükler, null ise hiç yüklemez.
// Sekme bileşeni ancak sekme açılınca ekrana geldiği için veri de o zaman çekilir (lazy).
export function useDetailData<T>(key: string | null, load: () => Promise<T>) {
  const [state, setState] = useState<State<T> | null>(null)

  useEffect(() => {
    if (key === null) return
    let cancelled = false
    load()
      .then((data) => {
        if (!cancelled) setState({ key, data })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ key, error: err instanceof Error ? err.message : 'Veri yüklenemedi.' })
      })
    return () => {
      cancelled = true
    }
    // load her render'da yeni bir fonksiyon; yeniden yükleme kararını sadece key verir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const loading = key !== null && state?.key !== key
  return {
    data: loading ? undefined : state?.data,
    error: loading ? undefined : state?.error,
    loading,
    /** Yeniden yüklenirken bir önceki sonuç (ekran boşalmasın diye) */
    previous: state?.data,
  }
}
