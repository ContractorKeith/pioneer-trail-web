import type { GameView, StoreItem } from './engine-types'

export type OutfitPreset = 'safe' | 'moderate' | 'risky'

export interface PlannedPurchase {
  itemId: string
  quantity: number
  costCents: number
  weightLbs: number
}

export interface OutfitPlan {
  preset: OutfitPreset
  label: string
  tradeoff: string
  purchases: PlannedPurchase[]
  costCents: number
  addedWeightLbs: number
  fundsAfterCents: number
  loadAfterLbs: number
  foodAfterLbs: number
  foodDaysAfter: number
  unfilledItemIds: string[]
}

const WAGON_CAPACITY_LBS = 2_400

const presets: Record<
  OutfitPreset,
  {
    label: string
    tradeoff: string
    reserveCents: number
    targets: (partySize: number) => Array<[string, number]>
  }
> = {
  safe: {
    label: 'Safe',
    tradeoff: 'More food, spare parts, and medicine; leaves less cash for the road.',
    reserveCents: 5_000,
    targets: (partySize) => [
      ['oxen', 3],
      ['clothing', partySize],
      ['medicine', 1],
      ['ammunition', 5],
      ['wheel', 1],
      ['axle', 1],
      ['tongue', 1],
      ['food', 600],
      ['food', 1_800],
      ['medicine', 2],
      ['ammunition', 20],
      ['wheel', 2],
      ['axle', 2],
      ['tongue', 2],
      ['tools', 1],
    ],
  },
  moderate: {
    label: 'Moderate',
    tradeoff: 'A balanced wagon with cash left for ferries, repairs, and trail stops.',
    reserveCents: 5_000,
    targets: (partySize) => [
      ['oxen', 3],
      ['clothing', partySize],
      ['medicine', 1],
      ['ammunition', 10],
      ['wheel', 1],
      ['axle', 1],
      ['tongue', 1],
      ['food', 1_200],
    ],
  },
  risky: {
    label: 'Risky',
    tradeoff: 'A lighter, cheaper start: fewer meals, only two yokes, and no spare wagon parts.',
    reserveCents: 0,
    targets: (partySize) => [
      ['oxen', 2],
      ['clothing', partySize],
      ['medicine', 1],
      ['ammunition', 5],
      ['food', 500],
    ],
  },
}

function availableQuantity(
  item: StoreItem,
  cashCents: number,
  freeWeightLbs: number,
  reserveCents: number,
) {
  const byCash =
    item.price_cents === null
      ? 0
      : Math.max(0, Math.floor((cashCents - reserveCents) / item.price_cents))
  const byWeight =
    item.weight_lbs === 0
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, Math.floor(freeWeightLbs / item.weight_lbs))
  return Math.min(byCash, byWeight)
}

/** Quotes the live store catalogue only; the Rust engine remains the purchase authority. */
export function planOutfit(
  view: GameView,
  preset: OutfitPreset,
): OutfitPlan {
  const definition = presets[preset]
  const inventory = { ...view.inventory }
  const startingCashCents = view.cash_cents
  let cashCents = startingCashCents
  let loadLbs = view.weight_lbs
  const purchases: PlannedPurchase[] = []
  const partySize = view.party.filter((person) => person.alive).length
  const dailyFoodLbs = view.daily_food_lbs

  for (const [itemId, target] of definition.targets(partySize)) {
    const item = view.items.find((entry) => entry.id === itemId)
    if (!item || item.price_cents === null) continue
    const owned = inventory[itemId] ?? 0
    const wanted = Math.max(0, Math.min(item.limit, target) - owned)
    const maximum = Math.min(
      wanted,
      availableQuantity(item, cashCents, WAGON_CAPACITY_LBS - loadLbs, definition.reserveCents),
    )
    const quantity = itemId === 'food' ? Math.floor(maximum / 100) * 100 : maximum
    if (!quantity) continue
    const costCents = item.price_cents * quantity
    const weightLbs = item.weight_lbs * quantity
    purchases.push({ itemId, quantity, costCents, weightLbs })
    inventory[itemId] = owned + quantity
    cashCents -= costCents
    loadLbs += weightLbs
  }

  const mergedPurchases = purchases.reduce<PlannedPurchase[]>((merged, purchase) => {
    const existing = merged.find((candidate) => candidate.itemId === purchase.itemId)
    if (existing) {
      existing.quantity += purchase.quantity
      existing.costCents += purchase.costCents
      existing.weightLbs += purchase.weightLbs
    } else {
      merged.push({ ...purchase })
    }
    return merged
  }, [])
  const foodAfterLbs = inventory.food ?? 0
  const targets = new Map<string, number>()
  for (const [itemId, target] of definition.targets(partySize)) targets.set(itemId, target)
  const unfilledItemIds = [...targets].flatMap(([itemId, target]) =>
    (inventory[itemId] ?? 0) < target ? [itemId] : [],
  )
  return {
    preset,
    label: definition.label,
    tradeoff: definition.tradeoff,
    purchases: mergedPurchases,
    costCents: startingCashCents - cashCents,
    addedWeightLbs: loadLbs - view.weight_lbs,
    fundsAfterCents: cashCents,
    loadAfterLbs: loadLbs,
    foodAfterLbs,
    foodDaysAfter: dailyFoodLbs ? Math.floor(foodAfterLbs / dailyFoodLbs) : 0,
    unfilledItemIds,
  }
}

export const outfitPresets = Object.keys(presets) as OutfitPreset[]
