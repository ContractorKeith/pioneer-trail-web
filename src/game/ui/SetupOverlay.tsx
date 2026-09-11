import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { GameCommand, GameView } from '../../engine-types'
import { TrailEngine } from '../../engine'
import { outfitPresets, planOutfit, type OutfitPlan, type OutfitPreset } from '../../outfitting'
import { isRejected, money } from '../../presentation'

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
  if (setup.occupation_id === 'soldier' && setup.era_id !== '1866')
    return 'Soldier is available in 1866.'
  return null
}

function partyProblem(party: string[]) {
  const names = party.map((name) => name.trim())
  if (names.some((name) => !name)) return 'Every traveler needs a name.'
  if (names.some((name) => [...name].length > 24)) return 'Names must be 24 characters or fewer.'
  if (names.some((name) => /\p{Cc}/u.test(name)))
    return 'Names can only use letters, spaces and punctuation.'
  if (new Set(names).size !== names.length) return 'Traveler names must be unique.'
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
  const namesProblem = partyProblem(setup.party)
  const occupation = useMemo(
    () => view.content.occupations.find((candidate) => candidate.id === setup.occupation_id),
    [setup.occupation_id, view.content.occupations],
  )
  const quoteState = useSetupQuotes(setup, namesProblem)
  const problem = unavailable(setup) ?? namesProblem ?? quoteState.error
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
              maxLength={24}
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
        quotes={quoteState.quotes}
        pending={quoteState.pending}
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
        disabled={!!problem || !quoteState.quotes[setup.preset]}
      >
        Take the trail <ArrowRight size={17} />
      </button>
    </form>
  )
}

function StartingSupplies({
  quotes,
  pending,
  preset,
  onChoose,
}: {
  quotes: Partial<Record<OutfitPreset, OutfitPlan>>
  pending: boolean
  preset: OutfitPreset
  onChoose: (preset: OutfitPreset) => void
}) {
  const plan = quotes[preset]
  return (
    <section className="starting-supplies" aria-labelledby="starting-supplies-title">
      <h3 id="starting-supplies-title">Starting supplies</h3>
      <div className="plan-picker" role="radiogroup" aria-label="Starting supplies">
        {outfitPresets.map((option) => {
          const quote = quotes[option]
          return (
            <button
              type="button"
              role="radio"
              aria-checked={preset === option}
              className={preset === option ? 'selected' : ''}
              key={option}
              onClick={() => onChoose(option)}
            >
              <strong>{quote?.label ?? `${option[0]!.toUpperCase()}${option.slice(1)}`}</strong>
              <span>{quote?.tradeoff ?? (pending ? 'Calculating supplies…' : 'Fix traveler names.')}</span>
            </button>
          )
        })}
      </div>
      <div className="plan-quote" aria-live="polite" aria-busy={pending}>
        <strong>{plan?.tradeoff ?? (pending ? 'Calculating your wagon…' : 'Supplies unavailable.')}</strong>
        <dl>
          <div>
            <dt>Cost</dt>
            <dd>{plan ? money(plan.costCents) : '…'}</dd>
          </div>
          <div>
            <dt>Cash after</dt>
            <dd>{plan ? money(plan.fundsAfterCents) : '…'}</dd>
          </div>
          <div>
            <dt>Food</dt>
            <dd>{plan ? `${plan.foodDaysAfter} days` : '…'}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

/** Quotes configured store prices without changing the live campaign. */
function useSetupQuotes(setup: JourneySetup, namesProblem: string | null) {
  const [resolved, setResolved] = useState<{
    key: string
    quotes: Partial<Record<OutfitPreset, OutfitPlan>>
    error: string | null
  }>({ key: '', quotes: {}, error: null })
  const setupKey = `${setup.trail_id}/${setup.era_id}/${setup.occupation_id}/${setup.departure_month}/${setup.party.length}`
  useEffect(() => {
    let cancelled = false
    let engine: TrailEngine | null = null
    if (namesProblem) return
    void (async () => {
      engine = await TrailEngine.create('1848')
      if (cancelled) return
      const command: GameCommand = {
        Configure: {
          trail_id: setup.trail_id,
          era_id: setup.era_id,
          occupation_id: setup.occupation_id,
          departure_month: setup.departure_month,
          party: Array.from({ length: setup.party.length }, (_, index) => `Traveler ${index + 1}`),
        },
      }
      const result = engine.apply(command)
      if (cancelled) return
      if (isRejected(result.outcomes)) {
        setResolved({
          key: setupKey,
          quotes: {},
          error: 'That setup is not available. Check the route, occupation, and departure month.',
        })
        return
      }
      const configured = engine.view()
      const next = Object.fromEntries(
        outfitPresets.map((option) => [option, planOutfit(configured, option)]),
      ) as Record<OutfitPreset, OutfitPlan>
      if (!cancelled) setResolved({ key: setupKey, quotes: next, error: null })
    })().catch(() => {
      if (!cancelled)
        setResolved({
          key: setupKey,
          quotes: {},
          error: 'Unable to prepare this journey. Please try again.',
        })
    }).finally(() => {
      engine?.dispose()
    })
    return () => {
      cancelled = true
      engine?.dispose()
    }
  }, [
    setup.departure_month,
    setup.era_id,
    setup.occupation_id,
    setup.party.length,
    setup.trail_id,
    setupKey,
    namesProblem,
  ])
  const matchesSetup = resolved.key === setupKey
  if (namesProblem)
    return { quotes: matchesSetup ? resolved.quotes : {}, error: null, pending: false }
  if (matchesSetup)
    return {
      quotes: resolved.quotes,
      error: resolved.error,
      pending: !resolved.error && Object.keys(resolved.quotes).length === 0,
    }
  return { quotes: {}, error: null, pending: true }
}
