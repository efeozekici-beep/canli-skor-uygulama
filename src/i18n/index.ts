import { useSyncExternalStore } from 'react'
import { DICT } from './dict'

// Dil sistemi: Türkçe, İngilizce, Almanca.
// Anahtar Türkçe metnin kendisi: t('Maçlar yükleniyor…'). Çevirisi olmayan metin Türkçe kalır (site bozulmaz).
// Değişkenli metinler: t('{n} maç', { n: 5 }). Veriden gelen sayılı etiketler ("2. Set", "3. Periyot",
// "1. Yarı 45'") aşağıdaki kalıplarla çevrilir. Dil değişince bütün uygulama yeniden çizilir (main.tsx).

export type Lang = 'tr' | 'en' | 'de'

export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: 'tr', label: 'TR', name: 'Türkçe' },
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'de', label: 'DE', name: 'Deutsch' },
]

const KEY = 'canliskor:lang'
const listeners = new Set<() => void>()

// Kayıtlı seçim, yoksa tarayıcının dili (Almanca / İngilizce), o da değilse Türkçe
function initial(): Lang {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'tr' || v === 'en' || v === 'de') return v
  } catch {
    // ignore
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'tr'
  if (nav.startsWith('tr')) return 'tr'
  if (nav.startsWith('de')) return 'de'
  if (nav.startsWith('en')) return 'en'
  return 'tr'
}

let lang: Lang = initial()
if (typeof document !== 'undefined') document.documentElement.lang = lang

export const getLang = () => lang

export function setLang(next: Lang) {
  if (next === lang) return
  lang = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // ignore
  }
  document.documentElement.lang = next
  listeners.forEach((l) => l())
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => lang,
    () => 'tr' as Lang,
  )
}

/** Tarih / sayı biçimleri için yerel ayar */
export const locale = () => ({ tr: 'tr-TR', en: 'en-GB', de: 'de-DE' })[lang]

type Rule = [RegExp, (m: RegExpExecArray) => string, (m: RegExpExecArray) => string]

// Veriden gelen sayılı / kalıplı etiketler: [kalıp, İngilizce, Almanca]
const ord = (n: string) => {
  const v = Number(n)
  const s = v % 100 >= 11 && v % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][v % 10] ?? 'th'
  return `${n}${s}`
}
const PATTERNS: Rule[] = [
  [/^(\d+)\. Set$/, (m) => `Set ${m[1]}`, (m) => `${m[1]}. Satz`],
  [/^(\d+)\. Periyot$/, (m) => `${ord(m[1])} Period`, (m) => `${m[1]}. Drittel`],
  [/^(\d+)\. İnning$/, (m) => `${ord(m[1])} Inning`, (m) => `${m[1]}. Inning`],
  [/^(\d+)\. Çeyrek$/, (m) => `Q${m[1]}`, (m) => `${m[1]}. Viertel`],
  [/^(\d+)\. Yarı$/, (m) => `${ord(m[1])} Half`, (m) => `${m[1]}. Halbzeit`],
  [/^(\d+)\. Raunt$/, (m) => `Round ${m[1]}`, (m) => `Runde ${m[1]}`],
  [/^(\d+)\. Antrenman$/, (m) => `Practice ${m[1]}`, (m) => `${m[1]}. Training`],
  [/^(\d+)\. Hafta$/, (m) => `Matchday ${m[1]}`, (m) => `${m[1]}. Spieltag`],
  [/^(\d+)\. Tur$/, (m) => `Round ${m[1]}`, (m) => `${m[1]}. Runde`],
  [/^Grup (\S+)$/, (m) => `Group ${m[1]}`, (m) => `Gruppe ${m[1]}`],
  [/^(.+) isteği başarısız \(HTTP (\d+)\)\.$/, (m) => `${t(m[1])} request failed (HTTP ${m[2]}).`, (m) => `${t(m[1])}-Anfrage fehlgeschlagen (HTTP ${m[2]}).`],
  [/^(.+) alınamadı \(HTTP (\d+)\)\.$/, (m) => `${t(m[1])} could not be loaded (HTTP ${m[2]}).`, (m) => `${t(m[1])} konnte nicht geladen werden (HTTP ${m[2]}).`],
  [/^Ücretsiz (.+) planı bu veriye erişim vermiyor/, (m) => `The free ${m[1]} plan doesn't include this data.`, (m) => `Der kostenlose ${m[1]}-Tarif enthält diese Daten nicht.`],
  [/^(\d+)\. Çeyrek ?(.*)$/, (m) => `Q${m[1]} ${m[2]}`.trim(), (m) => `${m[1]}. Viertel ${m[2]}`.trim()],
  [/^Uzatma ?(.+)$/, (m) => `OT ${m[1]}`, (m) => `Verl. ${m[1]}`],
  // "2. Yarı 47'" / "3. Periyot 12'" / "2. Yarı 05:42": etiket + dakika / süre
  [/^(.+?) (\d+'|\d{1,2}:\d{2})$/, (m) => `${t(m[1])} ${m[2]}`, (m) => `${t(m[1])} ${m[2]}`],
]

function fill(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`))
}

/** Türkçe metni seçili dile çevirir; çevirisi yoksa Türkçe döner. */
export function t(text: string, vars?: Record<string, string | number>): string {
  if (lang === 'tr' || !text) return fill(text, vars)
  const entry = DICT[text]
  if (entry) return fill(entry[lang === 'en' ? 0 : 1], vars)
  // "Lig Aşaması · 3. Hafta" gibi birleşik etiketler: parça parça
  if (text.includes(' · ')) return fill(text.split(' · ').map((part) => t(part)).join(' · '), vars)
  for (const [re, en, de] of PATTERNS) {
    const m = re.exec(text)
    if (m) {
      const out = lang === 'en' ? en(m) : de(m)
      // Kalıbın içi çevrilemediyse (ör. bilinmeyen etiket + dakika) olduğu gibi bırak
      if (out !== text) return fill(out, vars)
    }
  }
  return fill(text, vars)
}

/** Kısaltmalar (tablo başlıkları): ab('G', 'W', 'S') — Türkçe, İngilizce, Almanca */
export const ab = (tr: string, en: string, de: string) => (lang === 'en' ? en : lang === 'de' ? de : tr)

/** Sayıya göre tekil / çoğul: tn(n, '{n} maç', '{n} maç') — İngilizce / Almanca çoğullar sözlükte */
export function tn(n: number, one: string, many: string): string {
  // Tekil hal için sözlükte "<metin>#1" anahtarı olabilir (Türkçede tekil / çoğul aynı: "1 maç", "3 maç")
  if (n === 1 && lang !== 'tr' && DICT[`${one}#1`]) return fill(DICT[`${one}#1`][lang === 'en' ? 0 : 1], { n })
  return t(n === 1 ? one : many, { n })
}
