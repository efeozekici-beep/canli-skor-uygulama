// Hash yönlendirmesiyle bir sayfaya git: navigateTo('#/lig/2') veya navigateTo('/lig/2')
export function navigateTo(href: string) {
  window.location.hash = href.startsWith('#') ? href.slice(1) : href
}

// Takım sayfası adresi. API-Football id'si (sayı) varsa onunla; yoksa (ESPN / football-data tablosu) adıyla.
// lig: puan durumu ve maçlar bu ligden gelsin; ulke: aynı adlı takımlar arasından doğrusunu seçmek için.
export function teamHref(team: { id?: string | null; name: string }, leagueId?: string | null, region?: string | null) {
  const ref = team.id && /^\d+$/.test(team.id) ? team.id : `ad/${encodeURIComponent(team.name)}`
  const query = new URLSearchParams()
  if (leagueId) query.set('lig', leagueId)
  if (region) query.set('ulke', region)
  const qs = query.toString()
  return `#/takim/${ref}${qs ? `?${qs}` : ''}`
}

// Oyuncu sayfası adresi. takim: oyuncunun takımı (ESPN'de aynı soyadlı oyuncular arasından doğrusunu seçmek için)
export function playerHref(id: string, teamName?: string | null) {
  return `#/oyuncu/${encodeURIComponent(id)}${teamName ? `?takim=${encodeURIComponent(teamName)}` : ''}`
}

// Basketbol takım sayfası (NBA, EuroLeague, EuroCup): id varsa onunla (ESPN takım id'si / kulüp kodu), yoksa adıyla
export function basketballTeamHref(leagueId: string, team: { id?: string | null; name: string }) {
  const ref = team.id ? `id/${encodeURIComponent(team.id)}` : `ad/${encodeURIComponent(team.name)}`
  return `#/takim/bb/${leagueId}/${ref}`
}

// Basketbol oyuncu sayfası: NBA'de ESPN oyuncu id'si, EuroLeague / EuroCup'ta oyuncu kodu
export const basketballPlayerHref = (leagueId: string, playerId: string) => `#/oyuncu/bb/${leagueId}/${encodeURIComponent(playerId)}`
