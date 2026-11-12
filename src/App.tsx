import { useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import ScoreScreen from './components/ScoreScreen'
import MatchDetailPanel from './components/match-detail/MatchDetailPanel'
import BasketballDetailPanel from './components/basketball/BasketballDetailPanel'
import BasicMatchPanel from './components/match-detail/BasicMatchPanel'
import LeaguePage from './pages/LeaguePage'
import PlayerPage from './pages/PlayerPage'
import { useHashRoute } from './hooks/useHashRoute'
import { PAGES, SPORTS } from './sports'
import TeamPage from './pages/TeamPage'
import BasketballLeaguePage from './pages/BasketballLeaguePage'
import BasketballTeamPage from './pages/BasketballTeamPage'
import BasketballPlayerPage from './pages/BasketballPlayerPage'

// Ana liste sayfası mı? (#/ ya da boş hash)
const isListPath = (path: string) => path === '/' || path === ''

function App() {
  const [sport, setSport] = useState(SPORTS[0].id)
  const path = useHashRoute()
  const page = PAGES.find((p) => p.path === path)
  // Maç sayfası: #/mac/123 — lig sayfası: #/lig/2
  const matchPageId = /^\/mac\/([^/]+)$/.exec(path)?.[1] ?? null
  const leaguePageId = /^\/lig\/([^/]+)$/.exec(path)?.[1] ?? null
  const leagueId = leaguePageId ? decodeURIComponent(leaguePageId) : null
  // Oyuncu sayfası: #/oyuncu/1100?takim=Manchester%20City (örnek oyuncular: #/oyuncu/p-yamal)
  // Basketbol oyuncusu: #/oyuncu/bb/bb-12/3112335
  const bbPlayerRoute = /^\/oyuncu\/bb\/(bb-\d+)\/([^/?]+)$/.exec(path)
  const playerRoute = /^\/oyuncu\/([^/?]+)(?:\?(.*))?$/.exec(path)
  const playerId = playerRoute ? decodeURIComponent(playerRoute[1]) : null
  const playerTeam = new URLSearchParams(playerRoute?.[2] ?? '').get('takim')
  // Takım sayfası: #/takim/611?lig=203 (API-Football id) ya da #/takim/ad/Fenerbahce?lig=203 (adıyla)
  // Basketbol takımı: #/takim/bb/bb-12/id/2 ya da #/takim/bb/bb-120/ad/Panathinaikos
  const bbTeamRoute = /^\/takim\/bb\/(bb-\d+)\/(id|ad)\/([^?]+)$/.exec(path)
  const teamRoute = bbTeamRoute ? null : /^\/takim\/([^?]+)(?:\?(.*))?$/.exec(path)
  const teamRef = teamRoute?.[1] ?? null
  const teamQuery = new URLSearchParams(teamRoute?.[2] ?? '')
  const teamPageId = teamRef && !teamRef.startsWith('ad/') ? decodeURIComponent(teamRef) : null
  const teamPageName = teamRef?.startsWith('ad/') ? decodeURIComponent(teamRef.slice(3)) : null
  const activeSport = SPORTS.find((s) => s.id === sport) ?? SPORTS[0]
  // Son açılan maç listede vurgulu kalsın
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null)
  const listScroll = useRef(0)
  // Uygulama içinde kaç sayfa gezildi: geri butonu tarayıcı geçmişini mi kullansın, ana sayfaya mı gitsin
  const inAppNavigations = useRef(0)
  const pathRef = useRef(path)

  useEffect(() => {
    pathRef.current = path
  }, [path])

  // Listeden başka bir sayfaya geçerken listenin kaydırma konumunu sakla.
  // (hashchange, React yeni sayfayı çizmeden önce çalışır; konum henüz bozulmamıştır.)
  useEffect(() => {
    const onHashChange = () => {
      inAppNavigations.current++
      if (isListPath(pathRef.current)) listScroll.current = window.scrollY
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const handleSportChange = (id: string) => {
    setSport(id)
    if (!isListPath(path)) window.location.hash = '/'
  }

  const openMatch = (id: string) => {
    setLastOpenedId(id)
    window.location.hash = `/mac/${id}`
  }

  // Geri: uygulama içinden gelindiyse önceki sayfa (ör. lig sayfası), doğrudan açıldıysa ana liste
  const goBack = () => {
    if (inAppNavigations.current > 0) window.history.back()
    else window.location.hash = '/'
  }

  // Yeni sayfa en üstten başlasın; listeye dönünce kalınan yere geri kaydır
  useEffect(() => {
    window.scrollTo(0, isListPath(path) ? listScroll.current : 0)
  }, [path])

  // Arka plan: basketbolda (ve basketbol maç sayfasında) salon parkesi, diğerlerinde çim.
  // Parke fotoğrafı ancak basketbola ilk geçilince yüklenir (futbolcu ziyaretçi boşuna indirmesin),
  // sonra ekranda kalır ki geri dönüşlerde yumuşakça geçiş olsun.
  const onCourt = sport === 'basketball' || Boolean(matchPageId && /^(bb-|espn-nba-|el-)/.test(matchPageId))
  const [courtSeen, setCourtSeen] = useState(onCourt)
  if (onCourt && !courtSeen) setCourtSeen(true)

  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      {/* Tüm sitenin sabit arka planı (index.css → .cinematic-bg) */}
      <div aria-hidden="true" className="cinematic-bg">
        <span className="cinematic-bg__photo cinematic-bg__photo--grass" />
        {courtSeen && <span className={`cinematic-bg__photo cinematic-bg__photo--court ${onCourt ? 'is-active' : ''}`} />}
      </div>
      <Header path={path} sport={sport} onSportChange={handleSportChange} />

      {page && (
        <main className="mx-auto grid w-full max-w-7xl flex-1 place-items-center px-4 py-16 sm:px-6">
          <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-pitch-950/55 p-8 text-center shadow-2xl backdrop-blur-sm sm:p-12">
            <span className="inline-block rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">
              Yakında
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{page.label}</h1>
            <p className="mt-3 text-white/70">Bu sayfa hazırlanıyor.</p>
          </section>
        </main>
      )}

      {matchPageId && (
        <main className="mx-auto w-full max-w-4xl flex-1 pb-12 sm:px-6 sm:pt-8">
          <h1 className="sr-only">Maç detayı</h1>
          {/* Liste kartıyla aynı renk ve gölge; ama tam genişlik ve iç boşluksuz */}
          <div className="match-container-card m-0 max-w-none overflow-hidden rounded-none border-x-0 p-0 sm:rounded-[14px] sm:border-x">
            {/* Basketbol maçları (id "bb-" ile başlar) kendi detay panelini kullanır */}
            {/^(espn|el)-/.test(matchPageId) ? (
              <BasicMatchPanel key={matchPageId} matchId={matchPageId} onClose={goBack} />
            ) : matchPageId.startsWith('bb-') ? (
              <BasketballDetailPanel key={matchPageId} matchId={matchPageId} onClose={goBack} />
            ) : (
              <MatchDetailPanel key={matchPageId} matchId={matchPageId} variant="page" onClose={goBack} />
            )}
          </div>
        </main>
      )}

      {bbPlayerRoute && (
        <main className="mx-auto w-full max-w-5xl flex-1 pb-12 sm:px-6 sm:pt-8">
          <div className="match-container-card m-0 max-w-none overflow-hidden rounded-none border-x-0 p-0 sm:rounded-[14px] sm:border-x">
            <BasketballPlayerPage key={path} leagueId={bbPlayerRoute[1]} playerId={decodeURIComponent(bbPlayerRoute[2])} onBack={goBack} />
          </div>
        </main>
      )}

      {bbTeamRoute && (
        <main className="mx-auto w-full max-w-5xl flex-1 pb-12 sm:px-6 sm:pt-8">
          <div className="match-container-card m-0 max-w-none overflow-hidden rounded-none border-x-0 p-0 sm:rounded-[14px] sm:border-x">
            <BasketballTeamPage
              key={path}
              leagueId={bbTeamRoute[1]}
              teamId={bbTeamRoute[2] === 'id' ? decodeURIComponent(bbTeamRoute[3]) : null}
              teamName={bbTeamRoute[2] === 'ad' ? decodeURIComponent(bbTeamRoute[3]) : null}
              onBack={goBack}
            />
          </div>
        </main>
      )}

      {teamRef && (
        <main className="mx-auto w-full max-w-5xl flex-1 pb-12 sm:px-6 sm:pt-8">
          <div className="match-container-card m-0 max-w-none overflow-hidden rounded-none border-x-0 p-0 sm:rounded-[14px] sm:border-x">
            <TeamPage
              key={path}
              teamId={teamPageId}
              teamName={teamPageName}
              leagueHint={teamQuery.get('lig')}
              regionHint={teamQuery.get('ulke')}
              onBack={goBack}
              onSelectMatch={openMatch}
            />
          </div>
        </main>
      )}

      {leagueId && (
        // Mobilde tam ekran, masaüstünde ortalanmış geniş kart
        <main className="mx-auto w-full max-w-5xl flex-1 pb-12 sm:px-6 sm:pt-8">
          <div className="match-container-card m-0 max-w-none overflow-hidden rounded-none border-x-0 p-0 sm:rounded-[14px] sm:border-x">
            {leagueId.startsWith('bb-') ? (
              <BasketballLeaguePage key={leagueId} leagueId={leagueId} onBack={goBack} onSelectMatch={openMatch} />
            ) : (
              <LeaguePage key={leagueId} leagueId={leagueId} onBack={() => (window.location.hash = '/')} onSelectMatch={openMatch} />
            )}
          </div>
        </main>
      )}

      {playerId && (
        // Mobilde tam ekran, masaüstünde ortalanmış kart
        <main className="mx-auto w-full max-w-4xl flex-1 pb-12 sm:px-6 sm:pt-8">
          <div className="match-container-card m-0 max-w-none overflow-hidden rounded-none border-x-0 p-0 sm:rounded-[14px] sm:border-x">
            <PlayerPage key={path} playerId={playerId} teamHint={playerTeam} onBack={goBack} />
          </div>
        </main>
      )}

      {/* Skor listesi: maç/lig/oyuncu sayfası açıkken sadece gizlenir, böylece geri dönünce gün/filtre seçimi kaybolmaz */}
      {!page && (
        <main className={`mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-12 sm:px-6 sm:pt-8 ${matchPageId || leagueId || playerId || teamRef || bbTeamRoute || bbPlayerRoute ? 'hidden' : ''}`}>
          <h1 className="sr-only">{activeSport.label} canlı skorlar</h1>
          <ScoreScreen sport={sport} sportLabel={activeSport.label} selectedId={lastOpenedId} onSelectMatch={openMatch} />
        </main>
      )}
    </div>
  )
}

export default App
