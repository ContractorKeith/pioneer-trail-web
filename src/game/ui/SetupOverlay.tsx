import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { GameCommand, GameView } from '../../engine-types'
import { TrailEngine } from '../../engine'
import { outfitPresets, planOutfit, type OutfitPlan, type OutfitPreset } from '../../outfitting'
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
  const parameters = new URLSearchParams(window.location.search)
  const evidenceSeed =
    import.meta.env.DEV || parameters.get('evidence') === '1' ? parameters.get('seed') : null
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
  const quotes = useSetupQuotes(setup)
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
      <StartingSupplies
        view={view}
        quotes={quotes}
        preset={setup.preset}
        onChoose={(preset) => set('preset', preset)}
      />
      {problem && (
        <p className="overlay-warning" role="alert">
          {problem}
        </p>
      )}
      <button
        className="primary-action"
        type="submit"
        disabled={!!problem || (setup.party.every((name) => name.trim()) && !quotes[setup.preset])}
      >
        Take the trail <ArrowRight size={17} />
      </button>
    </form>
  )
}

function StartingSupplies({
  view,
  quotes,
  preset,
  onChoose,
}: {
  view: GameView
  quotes: Partial<Record<OutfitPreset, OutfitPlan>>
  preset: OutfitPreset
  onChoose: (preset: OutfitPreset) => void
}) {
  const plan = quotes?.[preset] ?? planOutfit(view, preset)
  return (
    <section className="starting-supplies" aria-labelledby="starting-supplies-title">
      <h3 id="starting-supplies-title">Starting supplies</h3>
      <div className="plan-picker" role="radiogroup" aria-label="Starting supplies">
        {outfitPresets.map((option) => {
          const quote = quotes?.[option] ?? planOutfit(view, option)
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
          <div>
            <dt>Cost</dt>
            <dd>{money(plan.costCents)}</dd>
          </div>
          <div>
            <dt>Cash after</dt>
            <dd>{money(plan.fundsAfterCents)}</dd>
          </div>
          <div>
            <dt>Food</dt>
            <dd>{plan.foodDaysAfter} days</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

/** Quotes configured store prices without changing the live campaign. */
function useSetupQuotes(setup: JourneySetup) {
  const [resolved, setResolved] = useState<{
    key: string
    quotes: Partial<Record<OutfitPreset, OutfitPlan>>
  }>({ key: '', quotes: {} })
  const setupKey = `${setup.seed}/${setup.trail_id}/${setup.era_id}/${setup.occupation_id}/${setup.departure_month}/${setup.party.join('/')}`
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const engine = await TrailEngine.create(setup.seed)
      const command: GameCommand = {
        Configure: {
          trail_id: setup.trail_id,
          era_id: setup.era_id,
          occupation_id: setup.occupation_id,
          departure_month: setup.departure_month,
          party: setup.party,
        },
      }
      const result = engine.apply(command)
      if (
        cancelled ||
        result.outcomes.some((outcome) => typeof outcome === 'object' && 'Rejected' in outcome)
      )
        return
      const configured = engine.view()
      const next = Object.fromEntries(
        outfitPresets.map((option) => [option, planOutfit(configured, option)]),
      ) as Record<OutfitPreset, OutfitPlan>
      if (!cancelled) setResolved({ key: setupKey, quotes: next })
    })().catch(() => {
      if (!cancelled) setResolved({ key: setupKey, quotes: {} })
    })
    return () => {
      cancelled = true
    }
  }, [
    setup.departure_month,
    setup.era_id,
    setup.occupation_id,
    setup.party,
    setup.seed,
    setup.trail_id,
    setupKey,
  ])
  return resolved.key === setupKey ? resolved.quotes : {}
}
