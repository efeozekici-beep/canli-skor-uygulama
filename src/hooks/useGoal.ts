import { useState } from 'react'

// Skor arttıysa yeni skoru döndürür (animasyonun key'i: her yeni gol animasyonu baştan oynatır), yoksa null.
// Önceki skoru render sırasında karşılaştırır (React'in "önceki prop'tan türetilen state" kalıbı).
export function useGoal(score: number | null) {
  const [seen, setSeen] = useState(score)
  const [goal, setGoal] = useState<number | null>(null)
  if (score !== seen) {
    setSeen(score)
    if (seen !== null && score !== null && score > seen) setGoal(score)
  }
  return goal
}
