import { Ball } from '../match-detail/EventIcon'

// Gol animasyonu: skor ARTTIĞINDA (sayfa ilk açılırken değil) top skor kutusunun İÇİNDE yuvarlanır:
// karşı taraftan girer, dönerek golü atan tarafın sayısının tam üstünde durur, sonra kaybolur ve yeni
// sayı büyüyerek görünür. Hareket CSS'te (index.css: goal-track, goal-spin, goal-digit).
// Skor kutusu "overflow-hidden" olmalı: top kutunun dışına taşmasın.

interface Props {
  value: number | null
  /** useGoal'dan gelen değer; null iken düz sayı */
  goal: number | null
  side: 'home' | 'away'
  size?: 'sm' | 'lg'
}

export default function GoalScore({ value, goal, side, size = 'sm' }: Props) {
  return (
    <span className="relative inline-block">
      {/* Sayı: top üstündeyken gizli, top kaybolunca büyüyerek görünür (key değişince yeniden oynar) */}
      <span key={goal ?? 'none'} className={`inline-block ${goal !== null ? 'goal-digit' : ''}`}>
        {value}
      </span>
      {goal !== null && (
        // Dış span topu sayının ortasına koyar; iç span'ler kayar ve döner (ayrı transform'lar çakışmasın)
        <span key={goal} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className={`goal-track goal-track--${side} block`}>
            <span className={`goal-spin goal-spin--${side} ${size === 'lg' ? 'size-9' : 'size-4'}`}>
              <Ball className="size-full drop-shadow" />
            </span>
          </span>
        </span>
      )}
    </span>
  )
}
