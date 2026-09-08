import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { EngineResult, GameCommand, GameView } from '../engine-types'
import { money, phase } from '../presentation'

const CASH_RESERVE_CENTS = 5_000
const WAGON_CAPACITY_LBS = 2_400
const FOOD_TARGET_LBS = 1_200
const FOOD_STEP_LBS = 100
export function Store({
  view,
  command,
}: {
  view: GameView
  command: (command: GameCommand) => EngineResult | undefined
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({ food: 100 })
  const [confirmDeparture, setConfirmDeparture] = useState(false)
  const outfitting = phase(view) === 'Outfitting'
  const partySize = view.party.filter((person) => person.alive).length
  const capacityFor = (current: GameView, item: { weight_lbs: number }) =>
    item.weight_lbs
      ? Math.max(0, Math.floor((WAGON_CAPACITY_LBS - current.weight_lbs) / item.weight_lbs))
      : Number.MAX_SAFE_INTEGER
  const foodTarget = (current: GameView) => {
    const item = current.items.find((entry) => entry.id === 'food')
    if (!item?.price_cents) return current.inventory.food ?? 0
    const onHand = current.inventory.food ?? 0
    const affordable = Math.max(
      0,
      Math.floor((current.cash_cents - CASH_RESERVE_CENTS) / item.price_cents),
    )
    const addition = Math.min(
      FOOD_TARGET_LBS - onHand,
      affordable,
      capacityFor(current, item),
      Math.max(0, item.limit - onHand),
    )
    return onHand + Math.max(0, Math.floor(addition / FOOD_STEP_LBS) * FOOD_STEP_LBS)
  }
  const foodDays = view.daily_food_lbs
    ? Math.floor((view.inventory.food ?? 0) / view.daily_food_lbs)
    : 0
  const targetFood = foodTarget(view)
  const risky =
    (view.inventory.oxen ?? 0) < 3 ||
    foodDays < 30 ||
    (view.inventory.clothing ?? 0) < partySize ||
    (view.inventory.medicine ?? 0) === 0
  const buyStarterSupplies = () => {
    const essentials: Array<[string, number]> = [
      ['oxen', 3],
      ['clothing', partySize],
      ['ammunition', 10],
      ['wheel', 1],
      ['axle', 1],
      ['tongue', 1],
      ['medicine', 1],
    ]
    const staged = { ...view, inventory: { ...view.inventory } }
    for (const [itemId, target] of essentials) {
      const quantity = Math.max(0, target - (staged.inventory[itemId] ?? 0))
      if (!quantity) continue
      const item = staged.items.find((entry) => entry.id === itemId)
      if (!item || item.price_cents === null) continue
      command({ Buy: { item_id: itemId, quantity } })
      staged.inventory[itemId] = (staged.inventory[itemId] ?? 0) + quantity
      staged.cash_cents -= item.price_cents * quantity
      staged.weight_lbs += item.weight_lbs * quantity
    }
    const food = Math.max(0, foodTarget(staged) - (staged.inventory.food ?? 0))
    if (food) command({ Buy: { item_id: 'food', quantity: food } })
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
        <div className="note" style={{ marginBottom: 20 }}>
          Starter target: 3 yokes (6 oxen), {targetFood.toLocaleString()} lb food, {partySize}{' '}
          clothing sets, 10 ammunition boxes, one wheel, axle, tongue and medicine kit. Essentials
          come first; food is rounded to 100 lb and leaves a $50 reserve when possible.
          <div className="button-row" style={{ marginTop: 12 }}>
            <button
              className="button secondary"
              disabled={!view.can_shop}
              onClick={buyStarterSupplies}
            >
              Buy starter supplies
            </button>
          </div>
        </div>
      )}
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
            const saleProceeds =
              item.sell_price_cents === null ? 0 : item.sell_price_cents * quantity
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
      {!view.can_shop && (
        <p className="note" style={{ marginTop: 20 }}>
          Your wagon inventory travels with you. Buying and selling are available at an open supply
          stop.
        </p>
      )}
      {outfitting && (
        <>
          <div className="divider" />
          {confirmDeparture && risky && (
            <p className="note error-note" style={{ marginBottom: 16 }}>
              Your wagon may be underprepared: check oxen, clothing and food. You can still depart
              deliberately.
            </p>
          )}
          <button
            className="button full"
            onClick={() => {
              if (risky && !confirmDeparture) {
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
