import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { GameView } from '../../engine-types'
import { outfitPresets, planOutfit, type OutfitPreset } from '../../outfitting'
import { money } from '../../presentation'

export interface JourneySetup {
  seed: string
  trail_id: string
  era_id: string
  occupation_id: string
  departure_month: number
  party: string[]
  difficulty: 'Easy' | 'Normal' | 'Hard'
  preset: OutfitPreset
}

const months = ['March', 'April', 'May', 'June', 'July']

function journeySeed() {
  const evidenceSeed = new URLSearchParams(window.location.search).get('seed')
  return evidenceSeed ?? String(crypto.getRandomValues(new Uint32Array(1))[0])
}

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
    seed: journeySeed(),
    trail_id: 'oregon',
    era_id: '1848',
    occupation_id: 'banker',
    departure_month: 3,
    party: ['James', 'Margaret', 'Thomas', 'Clara'],
    difficulty: 'Normal',
    preset: 'moderate',
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
      <p className="overlay-lede">Choose the people, season, road, and starting supplies.</p>
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
      <StartingSupplies view={view} preset={setup.preset} onChoose={(preset) => set('preset', preset)} />
      {problem && (
        <p className="overlay-warning" role="alert">
          {problem}
        </p>
      )}
      <button className="primary-action" type="submit" disabled={!!problem}>
        Take the trail <ArrowRight size={17} />
      </button>
    </form>
  )
}

function StartingSupplies({
  view,
  preset,
  onChoose,
}: {
  view: GameView
  preset: OutfitPreset
  onChoose: (preset: OutfitPreset) => void
}) {
  const plan = planOutfit(view, preset)
  return (
    <section className="starting-supplies" aria-labelledby="starting-supplies-title">
      <h3 id="starting-supplies-title">Starting supplies</h3>
      <div className="plan-picker" role="radiogroup" aria-label="Starting supplies">
        {outfitPresets.map((option) => {
          const quote = planOutfit(view, option)
          return (
            <button
              type="button"
              role="radio"
              aria-checked={preset === option}
              className={preset === option ? 'selected' : ''}
              key={option}
              onClick={() => onChoose(option)}
            >
              <strong>{quote.label}</strong>
              <span>{quote.tradeoff}</span>
            </button>
          )
        })}
      </div>
      <div className="plan-quote" aria-live="polite">
        <strong>{plan.tradeoff}</strong>
        <dl>
          <div><dt>Cost</dt><dd>{money(plan.costCents)}</dd></div>
          <div><dt>Cash after</dt><dd>{money(plan.fundsAfterCents)}</dd></div>
          <div><dt>Food</dt><dd>{plan.foodDaysAfter} days</dd></div>
        </dl>
      </div>
    </section>
  )
}
