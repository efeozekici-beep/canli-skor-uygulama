import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn yardımcısı: sınıfları birleştirir, çakışan Tailwind sınıflarında sonuncusu kazanır.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
