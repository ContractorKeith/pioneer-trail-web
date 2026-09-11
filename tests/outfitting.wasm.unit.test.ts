import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import init, { TrailEngine } from '../public/wasm/pioneer_trail_web_engine.js'
import type { EngineResult, GameCommand, GameView } from '../src/engine-types'
import { isRejected } from '../src/presentation'
import { outfitPresets, planOutfit } from '../src/outfitting'

const wasm = await readFile(
  new URL('../public/wasm/pioneer_trail_web_engine_bg.wasm', import.meta.url),
)
await init({ module_or_path: wasm })

function apply(engine: TrailEngine, command: GameCommand): EngineResult {
  return JSON.parse(engine.apply(JSON.stringify(command))) as EngineResult
}

function configured(occupationId: string) {
  const seed = `outfit-${occupationId}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  for (const [trailId, eraId] of [
    ['oregon', '1843'],
    ['oregon', '1848'],
    ['oregon', '1852'],
    ['oregon', '1866'],
    ['california', '1843'],
    ['mormon', '1848'],
  ]) {
    const engine = new TrailEngine(seed.toString())
    const result = apply(engine, {
      Configure: {
        trail_id: trailId,
        era_id: eraId,
        occupation_id: occupationId,
        departure_month: 3,
        party: ['Ada', 'James', 'Ruth', 'Thomas', 'Clara'],
      },
    })
    if (!isRejected(result.outcomes)) return engine
  }
  throw new Error(`${occupationId} has no legal setup in shipped content`)
}

function configuredAt(occupationId: string, departureMonth: number) {
  const seed = `setup-quote-${occupationId}-${departureMonth}`
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  for (const [trailId, eraId] of [
    ['oregon', '1843'],
    ['oregon', '1848'],
    ['oregon', '1852'],
    ['oregon', '1866'],
    ['california', '1843'],
    ['mormon', '1848'],
  ]) {
    const engine = new TrailEngine(seed.toString())
    const result = apply(engine, {
      Configure: {
        trail_id: trailId,
        era_id: eraId,
        occupation_id: occupationId,
        departure_month: departureMonth,
        party: ['Ada', 'James', 'Ruth', 'Thomas'],
      },
    })
    if (!isRejected(result.outcomes)) return engine
  }
  throw new Error(`${occupationId} has no legal setup in shipped content`)
}

describe('shipped WebAssembly outfitting plans', () => {
  const catalog = JSON.parse(configured('banker').view()) as GameView
  for (const occupation of catalog.content.occupations)
    it(`quotes and purchases every preset for ${occupation.id}`, () => {
    let cases = 0
      for (const preset of outfitPresets) {
        const engine = configured(occupation.id)
        const before = JSON.parse(engine.view()) as GameView
        const plan = planOutfit(before, preset)
        for (const purchase of plan.purchases) {
          const result = apply(engine, {
            Buy: { item_id: purchase.itemId, quantity: purchase.quantity },
          })
          expect(isRejected(result.outcomes), `${occupation.id}/${preset}/${purchase.itemId}`).toBe(
            false,
          )
        }
        const after = JSON.parse(engine.view()) as GameView
        expect(before.cash_cents - after.cash_cents).toBe(plan.costCents)
        expect(after.weight_lbs - before.weight_lbs).toBe(plan.addedWeightLbs)
        expect(after.weight_lbs).toBeLessThanOrEqual(2400)
        expect(planOutfit(after, preset).purchases).toEqual([])
        expect(
          isRejected(apply(engine, 'Depart').outcomes),
          `${occupation.id}/${preset} should depart`,
        ).toBe(false)
        cases += 1
      }
      expect(cases).toBe(outfitPresets.length)
    })

  it('gives the cash-constrained farmer a safe base wagon before upgrades', () => {
    const engine = configured('farmer')
    const before = JSON.parse(engine.view()) as GameView
    const plan = planOutfit(before, 'safe')
    expect(plan.foodDaysAfter).toBeGreaterThanOrEqual(30)
    for (const itemId of ['wheel', 'axle', 'tongue']) {
      expect(
        plan.purchases.find((purchase) => purchase.itemId === itemId)?.quantity,
      ).toBeGreaterThanOrEqual(1)
    }
    for (const purchase of plan.purchases) {
      expect(
        isRejected(
          apply(engine, { Buy: { item_id: purchase.itemId, quantity: purchase.quantity } })
            .outcomes,
        ),
      ).toBe(false)
    }
    const after = JSON.parse(engine.view()) as GameView
    expect(Math.floor((after.inventory.food ?? 0) / after.daily_food_lbs)).toBeGreaterThanOrEqual(
      30,
    )
    expect(after.inventory.wheel).toBeGreaterThanOrEqual(1)
    expect(after.inventory.axle).toBeGreaterThanOrEqual(1)
    expect(after.inventory.tongue).toBeGreaterThanOrEqual(1)
  })

  for (const occupation of catalog.content.occupations)
    it(`matches scratch setup quotes to configured purchases for ${occupation.id}`, () => {
    let cases = 0
      for (let month = 3; month <= 7; month++)
        for (const preset of outfitPresets) {
          const engine = configuredAt(occupation.id, month)
          const before = JSON.parse(engine.view()) as GameView
          const preview = planOutfit(before, preset)
          for (const purchase of preview.purchases)
            expect(
              isRejected(
                apply(engine, { Buy: { item_id: purchase.itemId, quantity: purchase.quantity } })
                  .outcomes,
              ),
            ).toBe(false)
          const after = JSON.parse(engine.view()) as GameView
          expect(preview.costCents).toBe(before.cash_cents - after.cash_cents)
          expect(preview.fundsAfterCents).toBe(after.cash_cents)
          expect(preview.foodDaysAfter).toBe(
            Math.floor((after.inventory.food ?? 0) / after.daily_food_lbs),
          )
          cases += 1
        }
      expect(cases).toBe(5 * outfitPresets.length)
    })
})
