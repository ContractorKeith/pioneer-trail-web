import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { GameView } from '../../engine-types'

export interface JourneySetup {
  seed: string
  trail_id: string
  era_id: string
  occupation_id: string
  departure_month: number
  party: string[]
  difficulty: 'Easy' | 'Normal' | 'Hard'
}

const months = ['March', 'April', 'May', 'June', 'July']

function unavailable(setup: JourneySetup) {
  if (setup.trail_id === 'mormon' && setup.era_id === '1843')
    return 'The Mormon Trail begins in 1848.'
  if (setup.occupation_id === 'soldier' && setup.era_id !== '1866')
    return 'Soldier is available in 1866.'
  return null
}

export function SetupOverlay({
  view,
  onStart,
}: {
  view: GameView
  onStart: (setup: JourneySetup) => void
}) {
  const [setup, setSetup] = useState<JourneySetup>({
    seed: '1848',
    trail_id: 'oregon',
    era_id: '1848',
    occupation_id: 'banker',
    departure_month: 3,
    party: ['James', 'Margaret', 'Thomas', 'Clara', 'William'],
    difficulty: 'Normal',
  })
  const problem = unavailable(setup)
  const occupation = useMemo(
    () => view.content.occupations.find((candidate) => candidate.id === setup.occupation_id),
    [setup.occupation_id, view.content.occupations],
  )
  const set = <K extends keyof JourneySetup>(key: K, value: JourneySetup[K]) =>
    setSetup((current) => ({ ...current, [key]: value }))

  return (
    <form
      className="setup-overlay"
      onSubmit={(event) => {
        event.preventDefault()
        if (!problem) onStart(setup)
      }}
    >
      <p className="overlay-lede">Choose the people, season, and road. Supplies come next.</p>
      <div className="setup-grid">
        <label>
          <span>Route</span>
          <select value={setup.trail_id} onChange={(event) => set('trail_id', event.target.value)}>
            {view.content.trails.map((trail) => (
              <option key={trail.id} value={trail.id}>
                {trail.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Year</span>
          <select value={setup.era_id} onChange={(event) => set('era_id', event.target.value)}>
            {view.content.eras.map((era) => (
              <option key={era.id} value={era.id}>
                {era.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Occupation</span>
          <select
            value={setup.occupation_id}
            onChange={(event) => set('occupation_id', event.target.value)}
          >
            {view.content.occupations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Leave in</span>
          <select
            value={setup.departure_month}
            onChange={(event) => set('departure_month', Number(event.target.value))}
          >
            {months.map((month, index) => (
              <option key={month} value={index + 3}>
                {month}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Difficulty</span>
          <select
            value={setup.difficulty}
            onChange={(event) =>
              set('difficulty', event.target.value as JourneySetup['difficulty'])
            }
          >
            <option>Easy</option>
            <option>Normal</option>
            <option>Hard</option>
          </select>
        </label>
        <label>
          <span>Journey seed</span>
          <input
            value={setup.seed}
            inputMode="numeric"
            onChange={(event) => set('seed', event.target.value)}
          />
        </label>
      </div>
      <p className="occupation-copy">
        {occupation?.perk ?? 'Every occupation begins with a different stake in the journey.'}
      </p>
      <fieldset className="traveler-list">
        <legend>Your party</legend>
        {setup.party.map((name, index) => (
          <label key={index}>
            <span>Traveler {index + 1}</span>
            <input
              value={name}
              maxLength={30}
              required
              onChange={(event) =>
                set(
                  'party',
                  setup.party.map((value, item) => (item === index ? event.target.value : value)),
                )
              }
            />
          </label>
        ))}
      </fieldset>
      {problem && (
        <p className="overlay-warning" role="alert">
          {problem}
        </p>
      )}
      <button className="primary-action" type="submit" disabled={!!problem}>
        Choose provisions <ArrowRight size={17} />
      </button>
    </form>
  )
}
