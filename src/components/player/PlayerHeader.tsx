import type { PlayerProfile } from '../../types/player'
import TeamLogo from '../TeamLogo'
import PlayerAvatar from '../common/PlayerAvatar'
import { teamHref } from '../../lib/navigation'
import { locale, t } from '../../i18n'

// Ad, takım ve kişisel bilgiler (yaş, uyruk, boy, kilo, doğum tarihi). Sadece bilinenler gösterilir.
export default function PlayerHeader({ profile }: { profile: PlayerProfile }) {
  const birth = profile.birthDate ? new Date(profile.birthDate).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const facts: [string, string | null][] = [
    ['Yaş', profile.age !== null ? String(profile.age) : null],
    ['Uyruk', profile.nationality],
    ['Boy', profile.height],
    ['Kilo', profile.weight],
    ['Doğum tarihi', birth],
  ]
  const known = facts.filter((f): f is [string, string] => f[1] !== null)

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="flex items-center gap-4">
        <PlayerAvatar photo={profile.photo} name={profile.name} size="2xl" className="ring-2 ring-white/15" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{profile.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
            {profile.team && (
              // Örnek veride takım sayfası yok; gerçek oyuncuda takım adından takım sayfası açılır
              <a href={profile.isMock ? undefined : teamHref({ name: profile.team.name })} className="flex items-center gap-1.5 hover:text-accent">
                <TeamLogo name={profile.team.name} logo={profile.team.logo} />
                {profile.team.name}
              </a>
            )}
            {profile.number !== null && <span className="font-semibold text-white">#{profile.number}</span>}
            {profile.position && <span>{profile.position}</span>}
            {profile.isMock && (
              <span title={t('Bu oyuncu için şimdilik örnek veri gösteriliyor')} className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                {t('Örnek veri')}
              </span>
            )}
          </div>
        </div>
      </div>

      {known.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {known.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-white/5 px-3 py-2">
              <dt className="text-xs text-white/50">{t(label)}</dt>
              <dd className="truncate text-sm font-semibold">{t(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
