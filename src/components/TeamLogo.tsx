import { useState } from 'react'
import { teamColor } from '../lib/team'

const SIZES = {
  sm: 'size-5 text-[10px]',
  // Maç listesi satırı: mobilde 24px, geniş ekranda 28px
  row: 'size-6 text-[11px] sm:size-7 sm:text-xs',
  md: 'size-8 text-xs',
  lg: 'size-14 text-xl sm:size-16',
}

interface Props {
  name: string
  logo?: string
  size?: keyof typeof SIZES
}

// Logo varsa resmi; yoksa ya da yüklenemezse takımın baş harfli renkli dairesi.
export default function TeamLogo({ name, logo, size = 'sm' }: Props) {
  // Yüklenemeyen adresi hatırla: logo değişirse yeniden denensin
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (logo && logo !== failedSrc) {
    return <img src={logo} alt="" loading="lazy" onError={() => setFailedSrc(logo)} className={`${SIZES[size]} shrink-0 object-contain`} />
  }
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: teamColor(name) }}
      className={`${SIZES[size]} grid shrink-0 place-items-center rounded-full font-bold text-white`}
    >
      {name.charAt(0)}
    </span>
  )
}
