// Dış kaynaklardan JSON okuma (backend ortak yardımcısı).
// EuroLeague'in API'si bazı adreslerde önbelleğinde kalmış XML cevabı veriyor (ör. Fenerbahçe'nin maçları),
// "Accept: application/json" gönderilse bile. Cevap XML gelirse adrese zararsız bir parametre eklenip
// önbellek atlatılarak bir kez daha denenir.

export async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const attempt = async (target: string) => {
    const res = await fetch(target, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`${target} HTTP ${res.status}`)
    return res.text()
  }
  let body = await attempt(url)
  if (body.trimStart().startsWith('<')) {
    body = await attempt(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`)
  }
  return JSON.parse(body) as T
}
