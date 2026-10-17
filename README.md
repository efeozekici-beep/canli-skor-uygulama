# CanlıSkor

Futbol ve basketbol için canlı skor sitesi. Maçlar, canlı skorlar, maç detayları, lig tabloları ve oyuncu istatistikleri tek yerde.

**Canlı site:** https://canli-skor-uygulama.vercel.app

## Özellikler

### Ana sayfa
- Günün bütün maçları, lig lig gruplu. Canlı / Bitti / Yaklaşan filtreleri ve gün seçici.
- **Canlı skor sayfayı yenilemeden güncellenir** (30 saniyede bir). Gol olunca skor kutusunda top yuvarlanır, satır hafifçe parlar.
- Ligler güç sıralamasına göre dizilir: Süper Lig her zaman en üstte, sonra büyük ligler (Premier League, La Liga, Serie A…), sonra diğer ülkeler. Basketbolda Basketbol Süper Ligi, NBA, EuroLeague.
- Favori maçlar (tarayıcıda saklanır), arama (Ctrl+K), spora göre arka plan (futbolda çim, basketbolda salon parkesi).

### Futbol maç sayfası
- **Ayrıntılar:** goller, kartlar, oyuncu değişiklikleri (gol, kendi kalesine gol ve kaçan penaltı simgeleriyle).
- **Kadrolar:** iki takım tek sahada (ya da tek takım), oyuncu fotoğrafları, reytingler, yedekler, teknik direktörler.
- **İstatistikler:** topla oynama, xG, şut, pas isabeti, kazanılan ikili mücadele, top kapma, araya girme, çalım, kilit pas. Altında **oyuncu karşılaştırma radarı**.
- **Puan durumu** (maçın iki takımı vurgulu), iki takımın geçmiş maçları, maçın oyuncusu.

### Basketbol
- Çeyrek skorları, takım istatistikleri, box score (NBA'da ayrıntılı), puan durumu.
- Oyuncu fotoğrafları: NBA'de ESPN, EuroLeague'de resmi API, diğerlerinde Wikipedia.

### Lig sayfaları (29 lig)
- Bu sezonun puan durumu ve bölge renkleri (Şampiyonlar Ligi, düşme…), büyük liglerde ev sahibi / deplasman tablosu ve son 5 maç formu.
- Gol ve asist krallığı (fotoğraflı), fikstür ve sonuçlar.

## Nasıl çalışıyor

```
Tarayıcı (React)  ──►  Kendi backend'imiz (Vercel fonksiyonları)  ──►  Veri kaynakları
                         • API anahtarları burada, tarayıcıya gitmez
                         • Cevaplar Upstash Redis'te saklanır: aynı veriyi
                           isteyen bütün ziyaretçiler tek istek harcar
```

| Kaynak | Ne için | Kota |
|---|---|---|
| [API-Football](https://www.api-football.com/) | Günün maçları, maç detayı (olaylar, kadrolar, istatistikler, reytingler) | Günde 100 istek |
| API-Basketball, API-NBA | Basketbol maçları, istatistikler, box score | Her biri günde 100 istek |
| [football-data.org](https://www.football-data.org/) | Büyük 12 ligin bu sezonki tablosu ve fikstürü | Dakikada 10 istek |
| ESPN (herkese açık) | Canlı skor katmanı, Süper Lig ve diğer liglerin tabloları, krallıklar, NBA fotoğrafları | Yok |
| EuroLeague resmi API, Wikipedia | Oyuncu ve teknik direktör fotoğrafları | Yok |

**Kotayı korumak için:** canlı skor ve dakika ESPN'den gelir (kota harcamaz). API-Football'un günlük listesi 10 dakikada bir yenilenir; maç sayfası ise sadece gol olunca, maç bitince ya da 10 dakikada bir yenilenir. Biten maçın verisi 7 gün saklanır.

### Klasörler

| Klasör | İçerik |
|---|---|
| `api/` | Backend: `proxy.ts` (veri kaynaklarına anahtarla istek + önbellek), `live.ts` (canlı skor), `photos.ts` (oyuncu fotoğrafı bulucu), `_lib/cache.ts` (Redis) |
| `src/services/` | Veri kapıları (bileşenler sadece bunları çağırır) ve `providers/` altında her kaynağın dönüştürücüsü |
| `src/components/`, `src/pages/` | Ekranlar |
| `src/config/leagueSources.ts` | Hangi ligin verisi hangi kaynaktan gelir |
| `src/lib/leagueOrder.ts` | Liglerin listedeki sırası |

## Kendi bilgisayarında çalıştırma

1. `.env.example` dosyasını `.env.local` adıyla kopyala ve anahtarları doldur:
   - `API_FOOTBALL_KEY`, `API_BASKETBALL_KEY`, `API_NBA_KEY` ([dashboard.api-football.com](https://dashboard.api-football.com), tek hesap)
   - `FOOTBALL_DATA_KEY` ([football-data.org](https://www.football-data.org/client/register), ücretsiz)
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (isteğe bağlı; yoksa önbellek bellekte tutulur)
2. `npm install`
3. `npm run dev` → http://localhost:5173 (backend de aynı sunucuda çalışır)

`.env.local` GitHub'a yüklenmez; anahtarlar canlı sitede Vercel'in **Environment Variables** ayarındadır. `main` dalına gönderilen her değişiklik Vercel'de otomatik yayınlanır.

## Sınırlar

- Ücretsiz planlar: API-Football bu sezonun lig verisini vermiyor (bu yüzden ESPN / football-data kullanılıyor); sarı/kırmızı kart krallığı ve sezon boyu oyuncu istatistikleri yok.
- ESPN'in kapsamadığı küçük liglerde canlı skor en fazla 10 dakika gecikebilir.
- Isı haritası, şut haritası gibi konum verisi gerektiren grafikler ücretsiz kaynaklarda yok.
- Oyuncu fotoğraflarının hakları sahiplerine (NBA, ESPN, EuroLeague, Wikimedia katkıcıları) aittir; site kişisel ve ticari olmayan bir projedir.

## Görseller

- Çim arka planı: Pexels (ücretsiz lisans)
- Basketbol salonu arka planı: WordPress Photo Directory (CC0)

## Teknolojiler

React 19, TypeScript, Vite, Tailwind CSS 4, Vercel (fonksiyonlar + yayın), Upstash Redis.
