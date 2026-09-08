import { readFile } from 'node:fs/promises'
import init, { TrailEngine } from '../public/wasm/pioneer_trail_web_engine.js'
import type { EngineResult, GameCommand, GameView } from '../src/engine-types'
import type { SpatialState, WorldSave } from '../src/game/persistence'

type RareCheckpoint = 'illness' | 'letter'

const ready = init({
  module_or_path: await readFile('public/wasm/pioneer_trail_web_engine_bg.wasm'),
})
const cache = new Map<RareCheckpoint, { raw: string; view: GameView }>()

/** Advance the browser-accepted letter to its destination; acceptance/delivery stay UI actions. */
export async function letterDeliveryCheckpoint(acceptedRaw: string) {
  await ready
  const outer = JSON.parse(acceptedRaw) as WorldSave
  const engine = new TrailEngine('1')
  try {
    engine.load(outer.campaign)
    const accepted = (JSON.parse(engine.view()) as GameView).active_letter
    if (!accepted) throw new Error('Letter arrival requires the browser-accepted letter save')
    const apply = (command: GameCommand) => {
      const result = JSON.parse(engine.apply(JSON.stringify(command))) as EngineResult
      const rejected = result.outcomes.find(
        (outcome) => typeof outcome === 'object' && 'Rejected' in outcome,
      )
      if (rejected)
        throw new Error(`Letter arrival command rejected: ${JSON.stringify({ command, rejected })}`)
    }
    for (let step = 0; step < 500; step++) {
      const view = JSON.parse(engine.view()) as GameView
      const status = typeof view.status === 'string' ? view.status : Object.keys(view.status)[0]
      if (JSON.stringify(view.active_letter) !== JSON.stringify(accepted))
        throw new Error('Letter arrival changed the accepted letter before UI delivery')
      if (view.can_deliver_letter) {
        const spatial: SpatialState = {
          regionId: view.current_node!.id,
          terrain: view.terrain,
          regionIndex: outer.spatial.regionIndex + 1,
          wagon: { x: 0, z: 20, yaw: 0, speed: 0 },
          player: { x: -3, z: 20, yaw: 0, pitch: 0 },
          mode: 'riding',
          frontierZ: 20,
          travelRemainder: 0,
          activity: null,
        }
        return {
          raw: JSON.stringify({ ...outer, campaign: engine.save(), spatial }),
          view,
        }
      }
      if (status === 'Arrived' || status === 'Failed') break
      if (view.pending_event) {
        apply({
          Respond: {
            event_id: view.pending_event.id,
            choice_id: view.pending_event.choices.find((choice) => choice.available)!.id,
          },
        })
      } else if (status === 'AwaitingRiver') {
        apply({ CrossRiver: { method: view.river?.ferry_cost_cents != null ? 'Ferry' : 'Caulk' } })
      } else if (status === 'AwaitingFork') {
        apply({
          ChooseRoute: {
            route_id: view.routes.find(
              (route) => route.available !== false && route.id !== 'columbia',
            )!.id,
          },
        })
      } else if (view.inventory.food < 120 && view.can_camp) {
        apply('Forage')
      } else {
        apply(status === 'AtLandmark' ? 'Continue' : 'TravelDay')
      }
    }
    throw new Error('The accepted letter did not reach a deliverable destination')
  } finally {
    engine.free()
  }
}

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
