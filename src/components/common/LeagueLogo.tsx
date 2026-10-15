import { useState } from 'react'

// Boyut + şekil: listede yuvarlak, lig sayfası başlığında köşeli kutu
const SIZES = {
  sm: { box: 'size-5 rounded-full text-[7px]', pad: 'p-0.5' },
  md: { box: 'size-9 rounded-full text-[11px]', pad: 'p-1' },
  lg: { box: 'size-14 rounded-xl text-lg sm:size-16', pad: 'p-1.5' },
}

interface Props {
  name: string
  logo?: string
  size?: keyof typeof SIZES
}

// "UEFA Champions League" -> "UCL"
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()

// Lig logosu: varsa resim (açık zeminde, koyu logolar da okunsun); yoksa ya da yüklenemezse baş harfler.
export default function LeagueLogo({ name, logo, size = 'md' }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const { box, pad } = SIZES[size]

  if (logo && logo !== failedSrc) {
    return <img src={logo} alt="" loading="lazy" onError={() => setFailedSrc(logo)} className={`${box} ${pad} shrink-0 bg-white/90 object-contain`} />
  }
  return (
    <span aria-hidden="true" className={`${box} grid shrink-0 place-items-center bg-white/10 font-bold tracking-tight`}>
      {initials(name)}
    </span>
  )
}
