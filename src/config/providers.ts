// Veri kaynakları (provider) ayarları. Her kaynağın adresi, mock kullanıp kullanmadığı
// ve önbellek süreleri burada; süreleri değiştirmek için sadece bu dosyayı düzenlemek yeterli.

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// .env'de "false" yazmadıkça mock kullanılır
const mock = (value: string | undefined) => value !== 'false'

export const PROVIDERS = {
  // API-Basketball: basketbol sekmesindeki bütün ligler, maç listesi, canlı skor, puan durumu (NBA dahil)
  apiBasketball: {
    label: 'API-Basketball',
    baseUrl: '/api/basketball',
    useMock: mock(import.meta.env.VITE_API_BASKETBALL_MOCK),
    ttl: {
      gamesToday: 60 * SECOND, // canlı skorlar değiştiği için kısa
      gamesOtherDay: 30 * MINUTE,
      standings: HOUR,
      gameStatsLive: MINUTE, // takım / oyuncu istatistikleri: canlı maçta sık
      gameStatsFinished: 7 * DAY, // biten maçta değişmez
    },
  },
  // API-NBA: sadece NBA maç detayı (box score, oyuncu istatistikleri, oyuncu profili)
  apiNba: {
    label: 'API-NBA',
    baseUrl: '/api/nba',
    useMock: mock(import.meta.env.VITE_API_NBA_MOCK),
    ttl: {
      games: 10 * MINUTE, // eşleştirme için o günün NBA maç listesi
      boxScoreLive: MINUTE,
      boxScoreFinished: 7 * DAY,
      player: 7 * DAY,
    },
  },
} as const
