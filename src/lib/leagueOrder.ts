import type { Match } from '../types/match'

// Ana listede liglerin sırası: alfabe değil güç sıralaması.
//  1. Süper Lig (futbolda Trendyol Süper Lig, basketbolda Basketbol Süper Ligi) her zaman en üstte
//  2. Önemli uluslararası turnuvalar / NBA, EuroLeague
//  3. Büyük ligler (elle verilen sıra)
//  4. Diğer ligler (Türkiye'nin alt ligleri dahil): ülkenin güç sırasına göre; kadın / alt yaş / yedek
//     ligleri ülkesinin sonunda
//  5. Sıralamada olmayan ülkeler: alfabetik

// API'nin İngilizce ülke adlarını Türkçe göster (listede bölge adı olarak görünür)
export const COUNTRY_TR: Record<string, string> = {
  World: 'Dünya',
  Europe: 'Avrupa',
  Turkey: 'Türkiye',
  England: 'İngiltere',
  Spain: 'İspanya',
  Italy: 'İtalya',
  Germany: 'Almanya',
  France: 'Fransa',
  Netherlands: 'Hollanda',
  Portugal: 'Portekiz',
  Belgium: 'Belçika',
  Scotland: 'İskoçya',
  Austria: 'Avusturya',
  Switzerland: 'İsviçre',
  Greece: 'Yunanistan',
  Denmark: 'Danimarka',
  'Czech-Republic': 'Çekya',
  'Czech Republic': 'Çekya',
  Norway: 'Norveç',
  Poland: 'Polonya',
  Croatia: 'Hırvatistan',
  Serbia: 'Sırbistan',
  Ukraine: 'Ukrayna',
  Sweden: 'İsveç',
  Israel: 'İsrail',
  Cyprus: 'Kıbrıs',
  Russia: 'Rusya',
  Romania: 'Romanya',
  Hungary: 'Macaristan',
  Slovenia: 'Slovenya',
  Slovakia: 'Slovakya',
  Bulgaria: 'Bulgaristan',
  Lithuania: 'Litvanya',
  Finland: 'Finlandiya',
  Ireland: 'İrlanda',
  Wales: 'Galler',
  Azerbaijan: 'Azerbaycan',
  Georgia: 'Gürcistan',
  Brazil: 'Brezilya',
  Argentina: 'Arjantin',
  USA: 'ABD',
  Mexico: 'Meksika',
  'Saudi-Arabia': 'Suudi Arabistan',
  'Saudi Arabia': 'Suudi Arabistan',
  Japan: 'Japonya',
  'South-Korea': 'Güney Kore',
  'South Korea': 'Güney Kore',
  China: 'Çin',
  Australia: 'Avustralya',
  Egypt: 'Mısır',
  Morocco: 'Fas',
  Qatar: 'Katar',
  'United-Arab-Emirates': 'BAE',
  Colombia: 'Kolombiya',
  Chile: 'Şili',
  Uruguay: 'Uruguay',
}

// ---------- Futbol ----------
const FOOTBALL_PINNED = 203 // Süper Lig
// Türkiye'nin diğer liglerinin kendi içindeki sırası: 1. Lig, Türkiye Kupası, 2. Lig, 3. Lig
const FOOTBALL_TURKEY = [204, 206, 205, 552]
const FOOTBALL_TOP = [
  1, 4, 2, 3, 848, 531, 5, // Dünya Kupası, EURO, Şampiyonlar Ligi, Avrupa Ligi, Konferans Ligi, Süper Kupa, Uluslar Ligi
  39, 140, 135, 78, 61, // Premier League, La Liga, Serie A, Bundesliga, Ligue 1
  88, 94, 144, 179, 40, // Eredivisie, Primeira Liga, Belçika, İskoçya, Championship
  13, 9, 307, 71, 128, 253, 262, // Libertadores, Copa América, Suudi, Brezilya, Arjantin, MLS, Liga MX
]
// UEFA ülke sıralamasına yakın (Türkiye'nin alt ligleri dahil), sonra Avrupa dışı
const FOOTBALL_COUNTRIES = [
  'İngiltere', 'İtalya', 'İspanya', 'Almanya', 'Fransa', 'Hollanda', 'Portekiz', 'Belçika', 'Türkiye', 'Çekya', 'Yunanistan',
  'Norveç', 'Danimarka', 'Polonya', 'Avusturya', 'İsviçre', 'İskoçya', 'İsveç', 'İsrail', 'Kıbrıs', 'Hırvatistan',
  'Sırbistan', 'Ukrayna', 'Rusya', 'Romanya', 'Macaristan', 'Slovenya', 'Slovakya', 'Bulgaristan', 'Azerbaycan',
  'Brezilya', 'Arjantin', 'Suudi Arabistan', 'ABD', 'Meksika', 'Japonya', 'Güney Kore', 'Kolombiya', 'Şili', 'Uruguay',
  'Katar', 'BAE', 'Mısır', 'Fas', 'Çin', 'Avustralya',
]

// ---------- Basketbol (lig id'leri "bb-" önekli) ----------
const BASKETBALL_PINNED = 104 // Basketbol Süper Ligi (TBF)
// Türkiye'nin diğer ligleri: TBL, TB2L
const BASKETBALL_TURKEY = [102, 103]
const BASKETBALL_TOP = [12, 120] // NBA, EuroLeague
const BASKETBALL_COUNTRIES = [
  'İspanya', 'Türkiye', 'Yunanistan', 'İtalya', 'Almanya', 'Fransa', 'Litvanya', 'İsrail', 'Avrupa', 'Sırbistan', 'Rusya',
  'Hırvatistan', 'Slovenya', 'Polonya', 'Çekya', 'Avustralya', 'Çin', 'Japonya', 'Güney Kore', 'Arjantin', 'Brezilya',
]
// Ülkelerin birinci ligleri: kendi ülkesinde 2. lig ve kupalardan önce (ACB, Basket League, Lega A, BBL,
// LNB Pro A, LKL, İsrail Süper Ligi, VTB, ABA)
const BASKETBALL_DOMESTIC_TOP = [117, 45, 52, 40, 2, 60, 51, 82, 198]
// Avrupa kupaları: EuroLeague'den sonra, ad ile tanınır
const BASKETBALL_EUROPE_CUPS = [/eurocup/i, /champions league/i, /fiba europe cup/i]

// Kadın, alt yaş, yedek ve alt lig adları ülkesinin sonuna
const MINOR = /\b(women|w|wsl|femenin[ao]|féminin|frauen|u\d{2}|youth|junior|reserve|ii|b team|espoirs)\b/i

const indexOr = (list: (string | number)[], value: string | number, fallback: number) => {
  const i = list.indexOf(value)
  return i === -1 ? fallback : i
}

// Küçük değer önce gelir: [grup, grup içi sıra, ülke sırası, yan lig mi, ad]
function rankKey(m: Match): [number, number, number, number, string] {
  const basketball = m.sport === 'basketball'
  const id = Number(m.leagueId.replace(/^bb-/, ''))
  const minor = MINOR.test(m.leagueName) ? 1 : 0
  const pinned = basketball ? BASKETBALL_PINNED : FOOTBALL_PINNED
  const turkey = basketball ? BASKETBALL_TURKEY : FOOTBALL_TURKEY
  const top = basketball ? BASKETBALL_TOP : FOOTBALL_TOP
  const countries = basketball ? BASKETBALL_COUNTRIES : FOOTBALL_COUNTRIES

  if (id === pinned && m.region === 'Türkiye') return [0, 0, 0, 0, m.leagueName]
  if (top.includes(id)) return [1, top.indexOf(id), 0, 0, m.leagueName]
  if (basketball && m.region === 'Avrupa') {
    const cup = BASKETBALL_EUROPE_CUPS.findIndex((re) => re.test(m.leagueName))
    if (cup !== -1) return [1, top.length + cup, 0, 0, m.leagueName]
  }
  const country = countries.indexOf(m.region)
  // Basketbolda ülkenin birinci ligi önce, sonra diğer erkek ligleri, en sonda kadın / alt yaş.
  // Türkiye'de alt ligler kendi sırasıyla (1. Lig, Kupa, 2. Lig...), sonra diğerleri.
  const tier =
    m.region === 'Türkiye'
      ? indexOr(turkey, id, turkey.length + minor)
      : basketball
        ? BASKETBALL_DOMESTIC_TOP.includes(id)
          ? 0
          : 1 + minor
        : minor
  if (country !== -1) return [2, 0, country, tier, m.leagueName]
  return [3, 0, 0, minor, m.region]
}

export function compareLeagues(a: Match, b: Match) {
  const ka = rankKey(a)
  const kb = rankKey(b)
  for (let i = 0; i < 4; i++) if (ka[i] !== kb[i]) return (ka[i] as number) - (kb[i] as number)
  return ka[4].localeCompare(kb[4], 'tr') || a.leagueName.localeCompare(b.leagueName, 'tr')
}
