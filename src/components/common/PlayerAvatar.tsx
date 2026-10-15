import { useState, type CSSProperties } from 'react'

const SIZES = {
  xs: 'size-5 text-[9px]',
  sm: 'size-8 text-xs',
  base: 'size-10 text-sm',
  md: 'size-11 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-14 text-lg',
  '2xl': 'size-20 text-2xl sm:size-24',
}

interface Props {
  photo?: string
  name: string
  size?: keyof typeof SIZES
  /** Ek sınıflar (halka, gölge, vurgu...) hem fotoğrafa hem yedek daireye uygulanır */
  className?: string
  /** Yedek dairede baş harfler yerine gösterilecek metin (örn. sahada forma numarası) */
  fallbackText?: string
  /** Yedek dairenin arka plan rengi (örn. takım rengi) */
  fallbackColor?: string
}

// "Lamine Yamal" -> "LY"
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

// Oyuncu fotoğrafı: varsa yuvarlak fotoğraf; yoksa ya da yüklenemezse baş harfli daire.
// Tüm sayfalar (arama, oyuncu başlığı, krallık listeleri, kadro sahası) bu bileşeni kullanır.
export default function PlayerAvatar({ photo, name, size = 'md', className = '', fallbackText, fallbackColor }: Props) {
  // Hangi adresin yüklenemediğini tut: fotoğraf değişirse yeniden denensin
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (photo && photo !== failedSrc) {
    return (
      <img
        src={photo}
        alt=""
        loading="lazy"
        onError={() => setFailedSrc(photo)}
        className={`${SIZES[size]} shrink-0 rounded-full bg-white/10 object-cover ${className}`}
      />
    )
  }

  const style: CSSProperties | undefined = fallbackColor ? { backgroundColor: fallbackColor } : undefined
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`${SIZES[size]} grid shrink-0 place-items-center rounded-full font-bold ${fallbackColor ? 'text-white' : 'bg-white/10 text-white/80'} ${className}`}
    >
      {fallbackText ?? initials(name)}
    </span>
  )
}
