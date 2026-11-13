import { t } from '../i18n'

interface Props {
  label: string
  onPrev: () => void
  onNext: () => void
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
      <path
        d={direction === 'left' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const arrowClass =
  'grid size-10 place-items-center rounded-full text-accent transition-[background-color,transform] duration-150 ease-out hover:bg-white/10 active:scale-[0.94]'

export default function DateSwitcher({ label, onPrev, onNext }: Props) {
  return (
    <div className="flex items-center rounded-full border border-white/15 bg-black/20">
      <button type="button" aria-label={t('Önceki gün')} onClick={onPrev} className={arrowClass}>
        <Chevron direction="left" />
      </button>
      <span aria-live="polite" className="min-w-24 text-center text-sm font-semibold text-accent tabular-nums">
        {label}
      </span>
      <button type="button" aria-label={t('Sonraki gün')} onClick={onNext} className={arrowClass}>
        <Chevron direction="right" />
      </button>
    </div>
  )
}
