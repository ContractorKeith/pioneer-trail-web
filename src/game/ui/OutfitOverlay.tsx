import { useMemo, useState } from 'react'
import { ArrowRight, Minus, Plus } from 'lucide-react'
import type { GameCommand, GameView, StoreItem } from '../../engine-types'
import { outfitPresets, planOutfit, type OutfitPreset } from '../../outfitting'
import { money } from '../../presentation'

export function OutfitOverlay({
  view,
  command,
}: {
  view: GameView
  command: (command: GameCommand) => void
}) {
  const [preset, setPreset] = useState<OutfitPreset>('safe')
  const [manual, setManual] = useState(false)
  const plan = useMemo(() => planOutfit(view, preset), [view, preset])
  const foodDays = view.daily_food_lbs
    ? Math.floor((view.inventory.food ?? 0) / view.daily_food_lbs)
    : 0
  const buyPlan = () =>
    plan.purchases.forEach((purchase) =>
      command({ Buy: { item_id: purchase.itemId, quantity: purchase.quantity } }),
    )
  const risk = (view.inventory.oxen ?? 0) < 3 || foodDays < 30 || (view.inventory.medicine ?? 0) < 1

  return (
    <section className="outfit-overlay">
      <div className="resource-strip">
        <Metric label="Cash" value={money(view.cash_cents)} />
        <Metric label="Load" value={`${view.weight_lbs.toLocaleString()} / 2,400 lb`} />
        <Metric label="Food" value={`${foodDays} days`} />
      </div>
      <p className="overlay-lede">
        Pick a starting balance, then refine it if you wish. Three yokes means six oxen.
      </p>
      <div className="plan-picker" role="radiogroup" aria-label="Outfitting plan">
        {outfitPresets.map((option) => {
          const quote = planOutfit(view, option)
          return (
            <button
              type="button"
              role="radio"
              aria-checked={preset === option}
              className={preset === option ? 'selected' : ''}
              key={option}
              onClick={() => setPreset(option)}
            >
              <strong>{quote.label}</strong>
              <span>{quote.tradeoff}</span>
            </button>
          )
        })}
      </div>
      <div className="plan-quote">
        <span>Recommended today</span>
        <strong>
          {plan.purchases.length
            ? plan.purchases
                .map(
                  (item) =>
                    `${item.quantity} ${view.items.find((candidate) => candidate.id === item.itemId)?.name ?? item.itemId}`,
                )
                .join(' · ')
            : 'This wagon already carries that plan.'}
        </strong>
        <dl>
          <div>
            <dt>Cost</dt>
            <dd>{money(plan.costCents)}</dd>
          </div>
          <div>
            <dt>After</dt>
            <dd>{money(plan.fundsAfterCents)}</dd>
          </div>
          <div>
            <dt>Food</dt>
            <dd>{plan.foodDaysAfter} days</dd>
          </div>
        </dl>
      </div>
      <button
        className="primary-action"
        type="button"
        disabled={!plan.purchases.length || !view.can_shop}
        onClick={buyPlan}
      >
        Load this plan <ArrowRight size={17} />
      </button>
      <button
        type="button"
        className="quiet-action"
        onClick={() => setManual((current) => !current)}
      >
        {manual ? 'Hide individual supplies' : 'Adjust individual supplies'}
      </button>
      {manual && (
        <div className="supply-list">
          {view.items.map((item) => (
            <Supply
              key={item.id}
              item={item}
              owned={view.inventory[item.id] ?? 0}
              cash={view.cash_cents}
              onCommand={command}
            />
          ))}
        </div>
      )}
      <div className={`departure-callout ${risk ? 'is-risky' : ''}`}>
        <p>
          {risk
            ? 'This is a hard start: less food, medicine, or pulling power leaves little room for bad weather.'
            : 'The wagon is provisioned for the first stretch of trail.'}
        </p>
        <button
          className="primary-action"
          type="button"
          disabled={!view.can_shop}
          onClick={() => command('Depart')}
        >
          Take the trail <ArrowRight size={17} />
        </button>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
function Supply({
  item,
  owned,
  cash,
  onCommand,
}: {
  item: StoreItem
  owned: number
  cash: number
  onCommand: (command: GameCommand) => void
}) {
  const canBuy = item.price_cents !== null && item.price_cents <= cash
  const canSell = item.sell_price_cents !== null && owned > 0
  return (
    <div className="supply-row">
      <div>
        <strong>{item.name}</strong>
        <span>
          {owned} {item.unit} ·{' '}
          {item.price_cents === null ? 'unavailable' : money(item.price_cents)}
        </span>
      </div>
      <div>
        <button
          aria-label={`Sell one ${item.name}`}
          disabled={!canSell}
          onClick={() => onCommand({ Sell: { item_id: item.id, quantity: 1 } })}
        >
          <Minus size={14} />
        </button>
        <button
          aria-label={`Buy one ${item.name}`}
          disabled={!canBuy}
          onClick={() => onCommand({ Buy: { item_id: item.id, quantity: 1 } })}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
