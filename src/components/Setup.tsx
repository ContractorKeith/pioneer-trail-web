import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { GameView } from '../engine-types'
import { money } from '../presentation'

export interface JourneySetup {
  seed: string
  trail_id: string
  era_id: string
  occupation_id: string
  departure_month: number
  party: string[]
  difficulty: 'Easy' | 'Normal' | 'Hard'
}

// Mirrors the two configuration constraints enforced by pioneer-sim::GameState::configure.
function setupProblem(setup: JourneySetup) {
  if (setup.trail_id === 'mormon' && setup.era_id === '1843')
    return 'The Mormon Trail is available from 1848.'
  if (setup.occupation_id === 'soldier' && setup.era_id !== '1866')
    return 'Soldier is available only in the 1866 era.'
  return null
}

export function Setup({
  view,
  onStart,
}: {
  view: GameView
  onStart: (setup: JourneySetup) => Promise<void>
}) {
  const [setup, setSetup] = useState<JourneySetup>(() => ({
    seed: `${Date.now()}`,
    trail_id: 'oregon',
    era_id: '1848',
    occupation_id: 'banker',
    departure_month: 3,
    party: ['James', 'Margaret', 'Thomas', 'Clara', 'William'],
    difficulty: 'Normal',
  }))
  const [busy, setBusy] = useState(false)
  const occupation = view.content.occupations.find((item) => item.id === setup.occupation_id)
  const problem = setupProblem(setup)
  const field = (key: keyof JourneySetup, value: string | number | string[]) =>
    setSetup((current) => ({ ...current, [key]: value }))
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        if (problem) return
        setBusy(true)
        try {
          await onStart(setup)
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="setup-intro">
        A wagon. Five travelers. A new life somewhere beyond the horizon. Choose the people and the
        path that will make this journey yours.
      </p>
      <div className="form-grid">
        <label className="field">
          <span>Your trail</span>
          <select
            value={setup.trail_id}
            onChange={(event) => field('trail_id', event.target.value)}
          >
            {view.content.trails.map((trail) => (
              <option key={trail.id} value={trail.id}>
                {trail.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>The year</span>
          <select value={setup.era_id} onChange={(event) => field('era_id', event.target.value)}>
            {view.content.eras.map((era) => (
              <option
                key={era.id}
                value={era.id}
                disabled={setup.trail_id === 'mormon' && era.id === '1843'}
              >
                {era.name}
                {setup.trail_id === 'mormon' && era.id === '1843'
                  ? ' · unavailable on this trail'
                  : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Your occupation</span>
          <select
            value={setup.occupation_id}
            onChange={(event) => field('occupation_id', event.target.value)}
          >
            {view.content.occupations.map((item) => (
              <option
                key={item.id}
                value={item.id}
                disabled={item.id === 'soldier' && setup.era_id !== '1866'}
              >
                {item.name} · {money(item.starting_cash_cents)}
                {item.id === 'soldier' && setup.era_id !== '1866' ? ' · available in 1866' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Departure month</span>
          <select
            value={setup.departure_month}
            onChange={(event) => field('departure_month', Number(event.target.value))}
          >
            {['March', 'April', 'May', 'June', 'July'].map((name, index) => (
              <option key={name} value={index + 3}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="occupation-note span-full">
          {occupation?.perk}{' '}
          {setup.occupation_id === 'banker' &&
            'A banker leaving in March is a forgiving first journey.'}
        </p>
        <div className="field span-full">
          <span>Your traveling party</span>
          <div className="party-names">
            {setup.party.map((name, index) => (
              <input
                key={index}
                aria-label={`Traveler ${index + 1} name`}
                value={name}
                maxLength={30}
                required
                onChange={(event) =>
                  field(
                    'party',
                    setup.party.map((old, i) => (i === index ? event.target.value : old)),
                  )
                }
              />
            ))}
          </div>
        </div>
        <label className="field">
          <span>Difficulty</span>
          <select
            value={setup.difficulty}
            onChange={(event) => field('difficulty', event.target.value)}
          >
            <option>Easy</option>
            <option>Normal</option>
            <option>Hard</option>
          </select>
        </label>
        <label className="field">
          <span>Journey seed · repeatable adventure</span>
          <input
            value={setup.seed}
            onChange={(event) => field('seed', event.target.value)}
            inputMode="numeric"
            pattern="[0-9]+"
            maxLength={20}
            required
          />
        </label>
      </div>
      {problem && (
        <p className="note" role="alert">
          {problem} Choose an available year or occupation to continue.
        </p>
      )}
      <div className="divider" />
      <p className="small muted">
        Starting a new journey replaces the current browser save. Export it from Settings first if
        you want to keep it.
      </p>
      <div className="button-row" style={{ marginTop: 22 }}>
        <button className="button full" disabled={busy || !!problem} type="submit">
          {busy ? 'Preparing your wagon…' : 'Outfit your wagon'}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  )
}
