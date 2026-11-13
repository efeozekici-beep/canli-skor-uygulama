// Bütün çeviriler: anahtar Türkçe metin, değer [İngilizce, Almanca]. Bölümler src/i18n/dict/ altında.
import { COMMON } from './dict/common'
import { DETAIL } from './dict/detail'
import { PAGES_DICT } from './dict/pages'

export const DICT: Record<string, [string, string]> = { ...COMMON, ...DETAIL, ...PAGES_DICT }
