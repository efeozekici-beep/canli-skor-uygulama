export function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export function dayLabel(offset: number, date: Date) {
  if (offset === 0) return 'Bugün'
  if (offset === -1) return 'Dün'
  if (offset === 1) return 'Yarın'
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' })
}
