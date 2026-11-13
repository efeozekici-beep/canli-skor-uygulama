import { Fragment, useState } from 'react'
import type { Match, MatchStatus } from '../types/match'
import { addDays, dayLabel, startOfDay } from '../lib/date'
import { useFavorites } from '../hooks/useFavorites'
import { useMatches } from '../hooks/useMatches'
import DateSwitcher from './DateSwitcher'
import StatusFilters from './StatusFilters'
import LeagueGroup from './LeagueGroup'
import MatchRow from './MatchRow'
import LeagueLogo from './common/LeagueLogo'
import { compareLeagues } from '../lib/leagueOrder'
import { t, tn } from '../i18n'

interface Props {
  sport: string
  sportLabel: string
  selectedId: string | null
  onSelectMatch: (id: string) => void
}

interface League {
  id: string
  name: string
  region: string
  logo?: string
  featured: boolean
  matches: Match[]
}

function byKickoff(a: Match, b: Match) {
  return a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
}

// Ligler güç sırasına göre (Süper Lig en üstte, src/lib/leagueOrder.ts), lig içinde maçlar başlama saatine göre.
// Sıralama burada da yapılır: tarayıcıda saklanmış eski sıralı listeler de doğru görünsün.
function groupByLeague(matches: Match[]): League[] {
  const groups = new Map<string, League>()
  for (const m of [...matches].sort(compareLeagues)) {
    let group = groups.get(m.leagueId)
    if (!group) {
      group = { id: m.leagueId, name: m.leagueName, region: m.region, logo: m.leagueLogo, featured: m.featured ?? false, matches: [] }
      groups.set(m.leagueId, group)
    }
    group.matches.push(m)
  }
  for (const g of groups.values()) g.matches.sort(byKickoff)
  return [...groups.values()]
}

const countLive = (matches: Match[]) => matches.filter((m) => m.status === 'live').length

// Lig sayfasının adresi: #/lig/2 (futbol), #/lig/bb-12 (basketbol). ESPN'den gelen, bizde sayfası olmayan
// ligler ("espn-l-…") bağlantısız.
// Lig sayfası sadece futbol (sayı id) ve basketbol ("bb-") liglerinde var
const leagueHref = (leagueId: string) => (/^(\d+|bb-\d+)$/.test(leagueId) ? `#/lig/${encodeURIComponent(leagueId)}` : undefined)

function FavoritesIcon() {
  return (
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-400">
      <svg viewBox="0 0 24 24" className="size-5">
        <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" fill="currentColor" />
      </svg>
    </span>
  )
}

export default function ScoreScreen({ sport, sportLabel, selectedId, onSelectMatch }: Props) {
  const [today] = useState(() => startOfDay(new Date()))
  const [dayOffset, setDayOffset] = useState(0)
  const [filter, setFilter] = useState<MatchStatus | null>(null)

  const date = addDays(today, dayOffset)
  const { matches, loading, error } = useMatches(sport, date)
  const { favorites, toggleFavorite } = useFavorites()

  const visible = filter ? matches.filter((m) => m.status === filter) : matches
  const favoriteMatches = visible.filter((m) => favorites.has(m.id)).sort(byKickoff)

  // Favori maçlar en üstte kendi grubunda; lig gruplarında tekrar gösterilmez.
  const leagues = groupByLeague(visible.filter((m) => !favorites.has(m.id)))
  const showFavoritesGroup = favoriteMatches.length > 0


  const renderRows = (list: Match[]) =>
    list.map((m) => (
      <MatchRow
        key={m.id}
        match={m}
        isFavorite={favorites.has(m.id)}
        isSelected={m.id === selectedId}
        onToggleFavorite={toggleFavorite}
        onSelect={onSelectMatch}
      />
    ))

  let emptyMessage: string | null = null
  if (loading) emptyMessage = t('Maçlar yükleniyor…')
  else if (error) emptyMessage = t(error)
  else if (leagues.length === 0 && !showFavoritesGroup) {
    if (matches.length === 0) emptyMessage = t('Bu tarihte {sport} maçı yok.', { sport: sportLabel })
    else emptyMessage = t('Bu filtreye uyan maç yok.')
  }

  return (
    // Mobilde kart ekran kenarına kadar uzanır (köşesiz, yan çizgisiz); geniş ekranda 750px ortalı kart
    <div className="match-container-card -mx-4 overflow-hidden rounded-none border-x-0 sm:mx-auto sm:rounded-[14px] sm:border-x">
      {/* Tek satır: solda durum filtreleri, sağda tarih seçici (dar ekranda alt alta geçer) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3">
        <StatusFilters active={filter} liveCount={countLive(matches)} onChange={setFilter} />
        <DateSwitcher
          label={dayLabel(Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86_400_000), date)}
          onPrev={() => setDayOffset((d) => d - 1)}
          onNext={() => setDayOffset((d) => d + 1)}
        />
      </div>

      <div className="border-t border-white/10">
        {showFavoritesGroup && (
          <LeagueGroup
            title="Favoriler"
            subtitle={tn(favoriteMatches.length, '{n} maç', '{n} maç')}
            icon={<FavoritesIcon />}
            liveCount={countLive(favoriteMatches)}
            total={favoriteMatches.length}
          >
            {/* Favoriler farklı liglerden olabilir: her ligin küçük başlığı da lig sayfasına gider */}
            {groupByLeague(favoriteMatches).map((league) => {
              const href = leagueHref(league.id)
              const label = (
                <>
                  <LeagueLogo name={league.name} logo={league.logo} size="sm" />
                  {league.name}
                </>
              )
              const className = 'flex items-center gap-2 border-t border-white/5 px-4 pt-2.5 pb-1 text-xs font-semibold text-white/55'
              return (
                <Fragment key={league.id}>
                  {href ? (
                    <a href={href} className={`${className} transition-colors duration-150 hover:text-accent`}>
                      {label}
                    </a>
                  ) : (
                    <p className={className}>{label}</p>
                  )}
                  {renderRows(league.matches)}
                </Fragment>
              )
            })}
          </LeagueGroup>
        )}

        {leagues.map((league) => (
          <LeagueGroup
            key={league.id}
            title={league.name}
            subtitle={t(league.region)}
            icon={<LeagueLogo name={league.name} logo={league.logo} />}
            liveCount={countLive(league.matches)}
            total={league.matches.length}
            href={leagueHref(league.id)}
          >
            {renderRows(league.matches)}
          </LeagueGroup>
        ))}

        {emptyMessage && <p className="px-6 py-14 text-center text-white/60">{emptyMessage}</p>}
      </div>
    </div>
  )
}
