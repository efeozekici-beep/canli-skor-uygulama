// Lig sayfası verisinin nereden geleceği. Anahtar: API-Football lig id'si (ana listedeki leagueId).
//  - espn: ESPN lig kodu → puan durumu (bölge renkleri dahil), gol/asist krallığı, son/gelecek 7 günün maçları
//  - footballData: football-data.org kodu (büyük 12 lig) → bütün sezon fikstürü; ev/deplasman tablosu ve form
//    da bu maçlardan hesaplanır
// Listede olmayan ligler örnek (mock) veriyle açılır ve sayfada "Örnek veri" yazar.

export interface LeagueSource {
  name: string
  region: string
  espn: string
  footballData?: string
}

export const LEAGUE_SOURCES: Record<string, LeagueSource> = {
  '2': { name: 'UEFA Champions League', region: 'Avrupa', espn: 'uefa.champions', footballData: 'CL' },
  '3': { name: 'UEFA Europa League', region: 'Avrupa', espn: 'uefa.europa' },
  '848': { name: 'UEFA Conference League', region: 'Avrupa', espn: 'uefa.europa.conf' },
  '203': { name: 'Süper Lig', region: 'Türkiye', espn: 'tur.1' },
  '39': { name: 'Premier League', region: 'İngiltere', espn: 'eng.1', footballData: 'PL' },
  '40': { name: 'Championship', region: 'İngiltere', espn: 'eng.2', footballData: 'ELC' },
  '140': { name: 'La Liga', region: 'İspanya', espn: 'esp.1', footballData: 'PD' },
  '141': { name: 'La Liga 2', region: 'İspanya', espn: 'esp.2' },
  '78': { name: 'Bundesliga', region: 'Almanya', espn: 'ger.1', footballData: 'BL1' },
  '79': { name: '2. Bundesliga', region: 'Almanya', espn: 'ger.2' },
  '135': { name: 'Serie A', region: 'İtalya', espn: 'ita.1', footballData: 'SA' },
  '136': { name: 'Serie B', region: 'İtalya', espn: 'ita.2' },
  '61': { name: 'Ligue 1', region: 'Fransa', espn: 'fra.1', footballData: 'FL1' },
  '62': { name: 'Ligue 2', region: 'Fransa', espn: 'fra.2' },
  '88': { name: 'Eredivisie', region: 'Hollanda', espn: 'ned.1', footballData: 'DED' },
  '94': { name: 'Primeira Liga', region: 'Portekiz', espn: 'por.1', footballData: 'PPL' },
  '144': { name: 'Jupiler Pro League', region: 'Belçika', espn: 'bel.1' },
  '179': { name: 'Premiership', region: 'İskoçya', espn: 'sco.1' },
  '197': { name: 'Super League', region: 'Yunanistan', espn: 'gre.1' },
  '218': { name: 'Bundesliga', region: 'Avusturya', espn: 'aut.1' },
  '119': { name: 'Superliga', region: 'Danimarka', espn: 'den.1' },
  '103': { name: 'Eliteserien', region: 'Norveç', espn: 'nor.1' },
  '113': { name: 'Allsvenskan', region: 'İsveç', espn: 'swe.1' },
  '307': { name: 'Saudi Pro League', region: 'Suudi Arabistan', espn: 'ksa.1' },
  '71': { name: 'Serie A', region: 'Brezilya', espn: 'bra.1', footballData: 'BSA' },
  '128': { name: 'Liga Profesional', region: 'Arjantin', espn: 'arg.1' },
  '262': { name: 'Liga MX', region: 'Meksika', espn: 'mex.1' },
  '253': { name: 'MLS', region: 'ABD', espn: 'usa.1' },
  // Milli takım turnuvaları (gruplu tablolar) ve kupalar (eleme usulü: tablo yok, krallık ve maçlar var)
  '1': { name: 'Dünya Kupası', region: 'Dünya', espn: 'fifa.world' },
  '4': { name: 'EURO', region: 'Avrupa', espn: 'uefa.euro' },
  '5': { name: 'UEFA Uluslar Ligi', region: 'Avrupa', espn: 'uefa.nations' },
  '9': { name: 'Copa América', region: 'Güney Amerika', espn: 'conmebol.america' },
  '10': { name: 'Hazırlık Maçları', region: 'Dünya', espn: 'fifa.friendly' },
  '15': { name: 'Kulüpler Dünya Kupası', region: 'Dünya', espn: 'fifa.cwc' },
  '32': { name: 'Dünya Kupası Elemeleri (Avrupa)', region: 'Avrupa', espn: 'fifa.worldq.uefa' },
  '34': { name: 'Dünya Kupası Elemeleri (Güney Amerika)', region: 'Güney Amerika', espn: 'fifa.worldq.conmebol' },
  '31': { name: 'Dünya Kupası Elemeleri (Kuzey Amerika)', region: 'Kuzey Amerika', espn: 'fifa.worldq.concacaf' },
  '30': { name: 'Dünya Kupası Elemeleri (Asya)', region: 'Asya', espn: 'fifa.worldq.afc' },
  '29': { name: 'Dünya Kupası Elemeleri (Afrika)', region: 'Afrika', espn: 'fifa.worldq.caf' },
  '13': { name: 'Copa Libertadores', region: 'Güney Amerika', espn: 'conmebol.libertadores' },
  '11': { name: 'Copa Sudamericana', region: 'Güney Amerika', espn: 'conmebol.sudamericana' },
  '531': { name: 'UEFA Süper Kupa', region: 'Avrupa', espn: 'uefa.super_cup' },
  '45': { name: 'FA Cup', region: 'İngiltere', espn: 'eng.fa' },
  '48': { name: 'Lig Kupası', region: 'İngiltere', espn: 'eng.league_cup' },
  '143': { name: 'Copa del Rey', region: 'İspanya', espn: 'esp.copa_del_rey' },
  '137': { name: 'Coppa Italia', region: 'İtalya', espn: 'ita.coppa_italia' },
  '81': { name: 'DFB-Pokal', region: 'Almanya', espn: 'ger.dfb_pokal' },
  '66': { name: 'Fransa Kupası', region: 'Fransa', espn: 'fra.coupe_de_france' },
}

// Eski kısa adresler (#/lig/tsl gibi) de çalışsın
const ALIASES: Record<string, string> = { ucl: '2', tsl: '203', pl: '39' }

export const leagueSourceFor = (leagueId: string): LeagueSource | null => LEAGUE_SOURCES[ALIASES[leagueId] ?? leagueId] ?? null
export const apiLeagueId = (leagueId: string) => ALIASES[leagueId] ?? leagueId
