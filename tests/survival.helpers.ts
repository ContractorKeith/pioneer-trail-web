import { readFile } from 'node:fs/promises'
import init, { TrailEngine } from '../public/wasm/pioneer_trail_web_engine.js'
import type { GameView } from '../src/engine-types'
import type { SpatialState } from '../src/game/persistence'

type RareCheckpoint = 'illness' | 'letter'

const ready = init({
  module_or_path: await readFile('public/wasm/pioneer_trail_web_engine_bg.wasm'),
})
const cache = new Map<RareCheckpoint, { raw: string; view: GameView }>()

/** Generate deterministic campaign states with real WASM commands for UI-only rare states. */
export async function rareCheckpoint(kind: RareCheckpoint) {
  const cached = cache.get(kind)
  if (cached) return cached
  await ready
  const seed = kind === 'illness' ? 16 : 1
  const engine = new TrailEngine(String(seed))
  const apply = (command: unknown) => JSON.parse(engine.apply(JSON.stringify(command)))
  const view = () => JSON.parse(engine.view()) as GameView

  apply({ SetDifficulty: 'Hard' })
  apply({
    Configure: {
      trail_id: 'oregon',
      era_id: '1848',
      occupation_id: 'banker',
      party: ['Ada', 'James', 'Ruth', 'Thomas', 'Clara'],
      departure_month: 3,
    },
  })
  for (const [item_id, quantity] of [
    ['oxen', 3],
    // Leave capacity for actual medicine; the checkpoint must exercise treatment, not a doctor perk.
    ['food', 1000],
    ['clothing', 5],
    ['medicine', 3],
    ['ammunition', 10],
    ['wheel', 2],
    ['axle', 2],
    ['tongue', 2],
  ])
    apply({ Buy: { item_id, quantity } })
  apply('Depart')

  for (let step = 0; step < 80; step++) {
    const current = view()
    const status =
      typeof current.status === 'string' ? current.status : Object.keys(current.status)[0]
    const settled = !current.pending_event && status !== 'AwaitingFork'
    const found =
      settled &&
      ((kind === 'illness' &&
        current.can_camp &&
        (current.inventory.medicine ?? 0) > 0 &&
        current.party.some((member) => member.alive && member.ailments.length > 0)) ||
        (kind === 'letter' &&
          status === 'AtLandmark' &&
          current.can_shop &&
          current.offered_letter !== null))
    if (found) {
      const spatial: SpatialState = {
        regionId: current.current_node?.id ?? 'independence',
        terrain: current.terrain,
        regionIndex: 0,
        wagon: { x: 0, z: 20, yaw: 0, speed: 0 },
        player: { x: -3, z: 20, yaw: 0, pitch: 0 },
        mode: 'riding',
        frontierZ: 20,
        travelRemainder: 0,
        activity: null,
      }
      const checkpoint = {
        raw: JSON.stringify({
          version: 2,
          campaign: engine.save(),
          spatial,
          savedAt: new Date().toISOString(),
        }),
        view: current,
      }
      cache.set(kind, checkpoint)
      return checkpoint
    }
    if (status === 'Arrived' || status === 'Failed') break
    if (current.pending_event) {
      apply({
        Respond: {
          event_id: current.pending_event.id,
          choice_id: current.pending_event.choices.find((choice) => choice.available)!.id,
        },
      })
    } else if (status === 'AwaitingRiver') {
      apply({
        CrossRiver: { method: current.river?.ferry_cost_cents !== null ? 'Ferry' : 'Caulk' },
      })
    } else if (status === 'AwaitingFork') {
      apply({
        ChooseRoute: {
          route_id: current.routes.find(
            (route) => route.available !== false && route.id !== 'columbia',
          )!.id,
        },
      })
    } else if (current.inventory.food < 120 && current.can_camp) {
      apply('Forage')
    } else {
      apply(status === 'AtLandmark' ? 'Continue' : 'TravelDay')
    }
  }
  throw new Error(`No command-generated ${kind} checkpoint found for seed ${seed}`)
}
