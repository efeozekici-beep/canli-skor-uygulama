import { formatRating, ratingTone } from '../../lib/ratings'

// Puana göre renklenen küçük reyting rozeti (6.7 gibi).
export default function RatingBadge({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'px-1 text-[10px] leading-4' : 'px-2 py-0.5 text-sm'
  return (
    <span className={`inline-block rounded font-bold tabular-nums ${sizeClass} ${ratingTone(rating)}`} aria-label={`Reyting ${formatRating(rating)}`}>
      {formatRating(rating)}
    </span>
  )
}
