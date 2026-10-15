import type { MatchEvent } from '../types/matchDetail'

// Dakika yazısı: 45+2'
export const minuteText = (e: MatchEvent) => `${e.minute}${e.extra ? `+${e.extra}` : ''}'`

// Skoru değiştiren olaylar
export const isGoal = (e: MatchEvent) => e.kind === 'goal' || e.kind === 'penalty' || e.kind === 'own-goal'
