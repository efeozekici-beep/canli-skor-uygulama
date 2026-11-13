import type { LeagueStandingRow, StandingSplit, StandingsView } from '../types/league'
import { getLang } from '../i18n'

// 2026 -> "2026/27"
export function seasonLabel(season: number) {
  return `${season}/${String(season + 1).slice(2)}`
}

// Avrupa liglerinde sezon yaz aylarında başlar: Temmuz ve sonrası yeni sezon.
export function currentSeasonFor(date = new Date()) {
  return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1
}

// Eşit değerler aynı sırayı alır: [5,4,4,4,3] -> [1,2,2,2,3]
export function denseRanks(values: number[]) {
  let rank = 0
  let previous: number | null = null
  return values.map((v) => {
    if (v !== previous) {
      rank++
      previous = v
    }
    return rank
  })
}

// API'nin İngilizce bölge açıklamaları: İngilizcede olduğu gibi (temizlenmiş), Almancada / Türkçede kısa çeviri
export function translateZone(description: string) {
  const lang = getLang()
  if (lang === 'en') return description.replace(/Promotion - /gi, '').replace(/\(League phase: ?\)/gi, '').trim()
  if (lang === 'de') return zoneDe(description)
  return description
    .replace(/Promotion - /gi, '')
    // ESPN biçimi: "Champions League qualifying", "Qualifies for round of 16", "Knockout phase playoffs - seeded"
    .replace(/Qualifies for round of 16/gi, 'Son 16')
    .replace(/Knockout phase playoffs - seeded/gi, 'Eleme play-off (seri başı)')
    .replace(/Knockout phase playoffs - unseeded/gi, 'Eleme play-off')
    .replace(/Champions League/gi, 'Şampiyonlar Ligi')
    .replace(/Europa League/gi, 'Avrupa Ligi')
    .replace(/Conference League/gi, 'Konferans Ligi')
    .replace(/Championship playoffs/gi, 'Şampiyonluk play-off')
    .replace(/European playoffs/gi, 'Avrupa play-off')
    .replace(/Relegation playoffs?/gi, 'Düşme play-off')
    .replace(/Promotion playoffs?/gi, 'Yükselme play-off')
    .replace(/^Promotion$/gi, 'Yükselme')
    .replace(/Relegated/gi, 'Düşme')
    .replace(/ qualifying/gi, ' (ön eleme)')
    .replace(/Relegation/gi, 'Düşme')
    .replace(/Qualification/gi, 'Ön eleme')
    .replace(/Play Offs?|Play-offs?|Playoffs?/gi, 'Play-off')
    .replace(/Knockout Round/gi, 'Eleme turu')
    .replace(/Round of 16/gi, 'Son 16')
    .replace(/Next Round/gi, 'Bir sonraki tur')
    .replace(/\(League phase: ?\)/gi, '')
    .trim()
}

function zoneDe(description: string) {
  return description
    .replace(/Promotion - /gi, '')
    .replace(/Qualifies for round of 16/gi, 'Achtelfinale')
    .replace(/Knockout phase playoffs - seeded/gi, 'K.-o.-Playoffs (gesetzt)')
    .replace(/Knockout phase playoffs - unseeded/gi, 'K.-o.-Playoffs')
    .replace(/Championship playoffs/gi, 'Meisterschafts-Playoffs')
    .replace(/European playoffs/gi, 'Europa-Playoffs')
    .replace(/Relegation playoffs?/gi, 'Relegation')
    .replace(/Promotion playoffs?/gi, 'Aufstiegs-Playoffs')
    .replace(/^Promotion$/gi, 'Aufstieg')
    .replace(/Relegated/gi, 'Abstieg')
    .replace(/ qualifying/gi, ' (Qualifikation)')
    .replace(/Relegation/gi, 'Abstieg')
    .replace(/Qualification/gi, 'Qualifikation')
    .replace(/Play Offs?|Play-offs?|Playoffs?/gi, 'Playoffs')
    .replace(/Knockout Round/gi, 'K.-o.-Runde')
    .replace(/Round of 16/gi, 'Achtelfinale')
    .replace(/Next Round/gi, 'Nächste Runde')
    .replace(/\(League phase: ?\)/gi, '')
    .trim()
}

// Bölge rengi açıklamadaki anahtar kelimeye göre seçilir (her lig için ayrı kodlamaya gerek yok).
const FALLBACK_COLORS = ['#a855f7', '#ec4899', '#64748b', '#0ea5e9']

export function zoneColor(description: string, index: number) {
  const d = description.toLocaleLowerCase('tr')
  if (/düşme|relegation|elendi|eliminated/.test(d)) return '#ef4444'
  if (/play/.test(d)) return '#eab308'
  if (/şampiyonlar|champions/.test(d)) return '#3b82f6'
  if (/konferans|conference/.test(d)) return '#14b8a6'
  if (/avrupa ligi|europa/.test(d)) return '#f97316'
  if (/yükselme|promotion|son 16|sonraki tur|next round/.test(d)) return '#22c55e'
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

// "Tümü" API'nin sırasını kullanır; Ev sahibi / Deplasman için tablo o maçlara göre yeniden hesaplanır.
export function rowsForView(rows: LeagueStandingRow[], view: StandingsView) {
  if (view === 'all') return rows.map((row) => ({ row, split: row.all, points: row.points, rank: row.rank }))
  const points = (s: StandingSplit) => s.win * 3 + s.draw
  return rows
    .map((row) => ({ row, split: row[view], points: points(row[view]) }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.split.goalsFor - b.split.goalsAgainst - (a.split.goalsFor - a.split.goalsAgainst) ||
        b.split.goalsFor - a.split.goalsFor ||
        a.row.team.name.localeCompare(b.row.team.name, 'tr'),
    )
    .map((item, i) => ({ ...item, rank: i + 1 }))
}
