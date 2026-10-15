import { SPORTS } from '../sports'

interface Props {
  active: string
}

// Every sport's texture stays mounted; switching only flips opacity,
// so the CSS transition cross-fades the old and new layers.
export default function SportBackground({ active }: Props) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {SPORTS.map((sport) => (
        <div
          key={sport.id}
          className={`sport-bg sport-bg--${sport.id}`}
          style={{ opacity: sport.id === active ? 1 : 0 }}
        >
          {sport.id === 'tennis' && <div className="tennis-court" />}
          {sport.id === 'f1' && (
            <>
              <div className="f1-kerb f1-kerb--top" />
              <div className="f1-kerb f1-kerb--bottom" />
            </>
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-black/40" />
    </div>
  )
}
