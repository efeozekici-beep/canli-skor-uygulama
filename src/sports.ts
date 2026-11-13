export interface Sport {
  id: string
  label: string
  emoji: string
}

export const SPORTS: Sport[] = [
  { id: 'football', label: 'Futbol', emoji: '⚽' },
  { id: 'basketball', label: 'Basketbol', emoji: '🏀' },
  { id: 'tennis', label: 'Tenis', emoji: '🎾' },
  { id: 'f1', label: 'Formula 1', emoji: '🏎️' },
  { id: 'hockey', label: 'Buz Hokeyi', emoji: '🏒' },
  { id: 'baseball', label: 'Beyzbol', emoji: '⚾' },
  { id: 'handball', label: 'Hentbol', emoji: '🤾' },
  { id: 'rugby', label: 'Rugby', emoji: '🏉' },
  { id: 'american-football', label: 'Amerikan Futbolu', emoji: '🏈' },
  { id: 'volleyball', label: 'Voleybol', emoji: '🏐' },
  { id: 'mma', label: 'MMA', emoji: '🥊' },
]

export interface Page {
  path: string
  label: string
}

export const PAGES: Page[] = [
  { path: '/oyunlar', label: 'Oyunlar' },
  { path: '/puan-durumu', label: 'Puan Durumu' },
  { path: '/iddaa-programi', label: 'İddaa Programı' },
  { path: '/uefa-puanlari', label: 'UEFA Puanları' },
  { path: '/fifa-siralamasi', label: 'FIFA Sıralaması' },
  { path: '/bulten', label: 'Bülten' },
]
