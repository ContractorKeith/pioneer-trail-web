import { describe, expect, it } from 'vitest'
import type { GameView, StoreItem } from './engine-types'
import { planOutfit, outfitPresets } from './outfitting'

const items: StoreItem[] = [
  ['oxen', 'Oxen', 'yoke', 4000, 0, 9],
  ['food', 'Food', 'lb', 20, 1, 2000],
  ['clothing', 'Clothing', 'set', 1000, 2, 99],
  ['ammunition', 'Ammunition', 'box of 20', 200, 1, 99],
  ['wheel', 'Wagon wheel', 'each', 1000, 30, 3],
  ['axle', 'Wagon axle', 'each', 1000, 40, 3],
  ['tongue', 'Wagon tongue', 'each', 1000, 25, 3],
  ['medicine', 'Medicine', 'kit', 1500, 2, 5],
  ['tools', 'Tools', 'set', 2500, 15, 1],
].map(([id, name, unit, price_cents, weight_lbs, limit]) => ({
  id,
  name,
  unit,
  price_cents,
  sell_price_cents: Math.floor(Number(price_cents) / 2),
  weight_lbs,
  limit,
})) as StoreItem[]

function view(
  cash_cents: number,
  inventory: Record<string, number> = {},
  weight_lbs = 0,
): GameView {
  return {
    seed: '1',
    status: 'Outfitting',
    day: 0,
    date: { year: 1848, month: 3, day: 1 },
    trail_id: 'oregon',
    era_id: '1848',
    occupation_id: 'banker',
    difficulty: 'Normal',
    content: { eras: [], trails: [], occupations: [], items, ailments: [] },
    miles: 0,
    weather: 'Clear',
    terrain: 'Plains',
    pace: 'Steady',
    rations: 'Filling',
    cash_cents,
    weight_lbs,
    daily_food_lbs: 15,
    score: 0,
    party: Array.from({ length: 5 }, (_, index) => ({
      name: `Pioneer ${index}`,
      alive: true,
      health: 100,
      morale: 100,
      ailments: [],
    })),
    inventory,
    current_node: null,
    target_node_id: null,
    route_miles_remaining: 0,
    routes: [],
    river: null,
    can_shop: true,
    can_repair: false,
    items,
    speakers: [],
    offered_letter: null,
    active_letter: null,
    can_deliver_letter: false,
    pending_event: null,
    pending_counteroffer: null,
    npcs: [],
    active_minigame: null,
    journal: [],
    visited_landmarks: [],
    has_fresh_food: false,
    available_party_slots: 0,
    can_camp: false,
    can_hunt: false,
    can_fish: false,
  }
}

const occupations = {
  merchant: 140000,
  doctor: 120000,
  blacksmith: 90000,
  carpenter: 80000,
  hunter: 60000,
  preacher: 50000,
  farmer: 40000,
  soldier: 70000,
}

describe('outfitting plans', () => {
  it('keeps every real occupation inside cash, capacity, and item limits', () => {
    for (const startingCash of Object.values(occupations))
      for (const preset of outfitPresets) {
        const current = view(startingCash)
        const plan = planOutfit(current, preset)
        expect(plan.costCents).toBe(
          plan.purchases.reduce((total, purchase) => total + purchase.costCents, 0),
        )
        expect(plan.loadAfterLbs).toBeLessThanOrEqual(2400)
        expect(plan.fundsAfterCents).toBeGreaterThanOrEqual(
          preset === 'risky' ? 0 : Math.min(startingCash, 5000),
        )
        for (const purchase of plan.purchases) {
          const item = items.find((entry) => entry.id === purchase.itemId)!
          expect(purchase.quantity).toBeGreaterThan(0)
          expect((current.inventory[purchase.itemId] ?? 0) + purchase.quantity).toBeLessThanOrEqual(
            item.limit,
          )
          expect(purchase.costCents).toBe(item.price_cents! * purchase.quantity)
        }
      }
  })

  it('makes the safe plan materially more prepared than the risky plan', () => {
    const safe = planOutfit(view(80000), 'safe')
    const risky = planOutfit(view(80000), 'risky')
    const quantities = (plan: typeof safe, item: string) =>
      plan.purchases.find((purchase) => purchase.itemId === item)?.quantity ?? 0
    expect(quantities(safe, 'food')).toBeGreaterThan(quantities(risky, 'food'))
    expect(quantities(safe, 'wheel')).toBeGreaterThan(0)
    expect(quantities(risky, 'wheel')).toBe(0)
    expect(quantities(safe, 'oxen')).toBe(3)
    expect(quantities(risky, 'oxen')).toBe(2)
    const foodIndex = safe.purchases.findIndex((purchase) => purchase.itemId === 'food')
    for (const itemId of ['ammunition', 'wheel', 'axle', 'tongue']) {
      expect(safe.purchases.findIndex((purchase) => purchase.itemId === itemId)).toBeLessThan(
        foodIndex,
      )
    }
  })

  it('marks a constrained safe plan as budget-tailored instead of claiming its full target', () => {
    expect(planOutfit(view(40_000), 'safe').unfilledItemIds).not.toEqual([])
  })

  it('quotes setup supplies with the configured party and ration values', () => {
    for (const preset of outfitPresets) {
      const configured = planOutfit(view(80_000), preset)
      const setupPreview = planOutfit(view(0), preset, {
        cashCents: 80_000,
        partySize: 5,
        dailyFoodLbs: 15,
      })
      expect(setupPreview).toMatchObject({
        costCents: configured.costCents,
        fundsAfterCents: configured.fundsAfterCents,
        foodDaysAfter: configured.foodDaysAfter,
      })
    }
  })

  it('only quotes the missing portions of supplies already owned', () => {
    const current = view(
      80000,
      {
        oxen: 3,
        clothing: 5,
        medicine: 1,
        food: 1200,
        ammunition: 10,
        wheel: 1,
        axle: 1,
        tongue: 1,
      },
      1287,
    )
    const moderate = planOutfit(current, 'moderate')
    expect(moderate.purchases).toEqual([])
    expect(moderate.costCents).toBe(0)
  })
})
