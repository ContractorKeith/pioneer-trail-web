import { useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import type { EngineResult, GameCommand, GameView } from '../engine-types'
import { outfitPresets, planOutfit, type OutfitPlan, type OutfitPreset } from '../outfitting'
import { isRejected, money, phase } from '../presentation'
import './store.css'

export function Store({
  view,
  command,
}: {
  view: GameView
  command: (command: GameCommand) => EngineResult | undefined
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({ food: 100 })
  const [preset, setPreset] = useState<OutfitPreset>('safe')
  const [manualOpen, setManualOpen] = useState(false)
  const [confirmDeparture, setConfirmDeparture] = useState(false)
  const [planNotice, setPlanNotice] = useState('')
  const [completedPlan, setCompletedPlan] = useState<OutfitPlan | null>(null)
  const outfitting = phase(view) === 'Outfitting'
  const partySize = view.party.filter((person) => person.alive).length
  const foodDays = view.daily_food_lbs
    ? Math.floor((view.inventory.food ?? 0) / view.daily_food_lbs)
    : 0
  const risky =
    (view.inventory.oxen ?? 0) < 3 ||
    foodDays < 30 ||
    (view.inventory.clothing ?? 0) < partySize ||
    (view.inventory.medicine ?? 0) === 0
  const plan = planOutfit(view, preset)
  const fullyPacked = !!completedPlan && !plan.purchases.length && !plan.unfilledItemIds.length
  const planItems = Object.entries(
    plan.purchases.reduce<Record<string, number>>((totals, purchase) => {
      totals[purchase.itemId] = (totals[purchase.itemId] ?? 0) + purchase.quantity
      return totals
    }, {}),
  )

  const outfit = () => {
    setPlanNotice('')
    for (const purchase of plan.purchases) {
      const result = command({ Buy: { item_id: purchase.itemId, quantity: purchase.quantity } })
      if (!result || isRejected(result.outcomes)) {
        setPlanNotice(
          'The store changed before this plan was complete. Review the updated plan before trying again.',
        )
        return
      }
    }
    setCompletedPlan(plan)
  }

  return (
    <>
      <div className="store-summary">
        <div>
          Available funds<strong>{money(view.cash_cents)}</strong>
        </div>
        <div>
          Wagon load
          <strong>
            {view.weight_lbs.toLocaleString()} <small className="small muted">/ 2,400 lb</small>
          </strong>
        </div>
        <div>
          Food on hand
          <strong>
            {foodDays} <small className="small muted">days</small>
          </strong>
        </div>
      </div>
      {outfitting && (
        <section className="outfit-planner" aria-labelledby="outfit-heading">
          <div hidden={fullyPacked}>
            <div className="outfit-planner-heading">
              <div>
                <span className="eyebrow">YOUR FIRST MORNING</span>
                <h3 id="outfit-heading">Outfit your wagon</h3>
                <p>Choose a starting plan, then adjust anything you like.</p>
              </div>
              <span className="outfit-yokes">Yokes are pairs: 3 yokes = 6 oxen.</span>
            </div>
            <div className="outfit-presets" role="radiogroup" aria-label="Outfitting plan">
              {outfitPresets.map((option) => {
                const candidate = planOutfit(view, option)
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={preset === option}
                    className={`outfit-preset ${preset === option ? 'selected' : ''}`}
                    onClick={() => {
                      setPreset(option)
                      setPlanNotice('')
                      setCompletedPlan(null)
                    }}
                  >
                    <strong>{candidate.label}</strong>
                    <span>{candidate.tradeoff}</span>
                  </button>
                )
              })}
            </div>
            <div className="outfit-quote" aria-live="polite">
              <div>
                <span>Today&apos;s plan</span>
                <strong>
                  {planItems.length
                    ? planItems
                        .map(
                          ([itemId, quantity]) =>
                            `${quantity} ${view.items.find((item) => item.id === itemId)?.name ?? itemId}`,
                        )
                        .join(' · ')
                    : plan.unfilledItemIds.length
                      ? 'Everything that fits your current budget is aboard.'
                      : 'You already have this plan.'}
                </strong>
                {plan.unfilledItemIds.length > 0 && (
                  <em>
                    Budget-tailored: the full {plan.label.toLowerCase()} target will need more funds
                    or wagon room.
                  </em>
                )}
              </div>
              <dl>
                <div>
                  <dt>Today&apos;s cost</dt>
                  <dd>{money(plan.costCents)}</dd>
                </div>
                <div>
                  <dt>Wagon after</dt>
                  <dd>{plan.loadAfterLbs.toLocaleString()} / 2,400 lb</dd>
                </div>
                <div>
                  <dt>Cash left</dt>
                  <dd>{money(plan.fundsAfterCents)}</dd>
                </div>
                <div>
                  <dt>Food after</dt>
                  <dd>
                    {plan.foodAfterLbs.toLocaleString()} lb · {plan.foodDaysAfter} days
                  </dd>
                </div>
              </dl>
            </div>
            {planNotice && (
              <p className="note error-note outfit-notice" role="alert">
                {planNotice}
              </p>
            )}
            <button
              className="button outfit-buy"
              disabled={!view.can_shop || !plan.purchases.length}
              onClick={outfit}
            >
              Outfit with recommended supplies
              <ArrowRight size={16} />
            </button>
            <p className="outfit-tradeoff">{plan.tradeoff}</p>
          </div>
          {completedPlan && !plan.purchases.length && !fullyPacked && (
            <p className="outfit-budget-summary" role="status">
              Budget-tailored {completedPlan.label} supplies purchased: {foodDays} days of meals.
              The full target is still out of reach; check your provisions before leaving.
            </p>
          )}
          {fullyPacked && completedPlan && (
            <>
              <h3>Your wagon is packed.</h3>
              <p className="outfit-complete" role="status">
                {completedPlan.label} supplies · {money(completedPlan.costCents)} spent · {foodDays}{' '}
                days of meals. Ready for the road.
              </p>
              <button className="text-button" onClick={() => setCompletedPlan(null)}>
                Review supply plans
              </button>
            </>
          )}
        </section>
      )}
      {outfitting && (
        <details
          className="manual-shop"
          open={manualOpen}
          onToggle={(event) => setManualOpen(event.currentTarget.open)}
        >
          <summary>
            Shop item by item <ChevronDown size={15} />
          </summary>
          <p>Change a quantity, then buy or sell at the live store price.</p>
          <StoreTable
            view={view}
            quantities={quantities}
            setQuantities={setQuantities}
            command={command}
          />
        </details>
      )}
      {!outfitting && (
        <StoreTable
          view={view}
          quantities={quantities}
          setQuantities={setQuantities}
          command={command}
        />
      )}
      {!view.can_shop && (
        <p className="note" style={{ marginTop: 20 }}>
          Your wagon inventory travels with you. Buying and selling are available at an open supply
          stop.
        </p>
      )}
      {outfitting && (
        <>
          <div className="divider" />
          {confirmDeparture && risky && preset !== 'risky' && (
            <p className="note error-note" style={{ marginBottom: 16 }}>
              Your wagon may be underprepared: check oxen, clothing and food. You can still depart
              deliberately.
            </p>
          )}
          <button
            className="button full"
            disabled={(view.inventory.oxen ?? 0) === 0}
            onClick={() => {
              if ((view.inventory.oxen ?? 0) === 0) return
              if (risky && preset !== 'risky' && !confirmDeparture) {
                setConfirmDeparture(true)
                return
              }
              command('Depart')
            }}
          >
            {confirmDeparture && risky
              ? 'Depart with these supplies'
              : `Leave ${view.current_node?.name ?? 'your departure point'}`}
            <ArrowRight size={16} />
          </button>
        </>
      )}
    </>
  )
}

function StoreTable({
  view,
  quantities,
  setQuantities,
  command,
}: {
  view: GameView
  quantities: Record<string, number>
  setQuantities: Dispatch<SetStateAction<Record<string, number>>>
  command: (command: GameCommand) => EngineResult | undefined
}) {
  return (
    <table className="store-table">
      <thead>
        <tr>
          <th>Supplies</th>
          <th>On hand</th>
          <th>Unit price</th>
          <th>Quantity</th>
          <th>
            <span className="sr-only">Trade</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {view.items.map((item) => {
          const quantity = quantities[item.id] ?? 1
          const saleProceeds = item.sell_price_cents === null ? 0 : item.sell_price_cents * quantity
          return (
            <tr key={item.id}>
              <td>
                {item.name}
                <small>{item.unit}</small>
              </td>
              <td>{view.inventory[item.id] ?? 0}</td>
              <td>{item.price_cents === null ? '—' : money(item.price_cents)}</td>
              <td>
                <input
                  aria-label={`${item.name} quantity`}
                  type="number"
                  min={1}
                  max={item.limit}
                  value={quantity}
                  onChange={(event) =>
                    setQuantities((old) => ({
                      ...old,
                      [item.id]: Math.max(1, Math.floor(Number(event.target.value)) || 1),
                    }))
                  }
                />
              </td>
              <td>
                <div className="button-row">
                  <button
                    className="button"
                    disabled={
                      !view.can_shop ||
                      item.price_cents === null ||
                      quantity * item.price_cents > view.cash_cents
                    }
                    onClick={() => command({ Buy: { item_id: item.id, quantity } })}
                  >
                    Buy {item.price_cents !== null ? money(item.price_cents * quantity) : ''}
                  </button>
                  <button
                    className="button secondary sell-button"
                    disabled={
                      !view.can_shop ||
                      item.sell_price_cents === null ||
                      (view.inventory[item.id] ?? 0) < quantity
                    }
                    onClick={() => command({ Sell: { item_id: item.id, quantity } })}
                    aria-label={`Sell ${quantity} ${item.name} for ${money(saleProceeds)}`}
                  >
                    Sell {money(saleProceeds)}
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
