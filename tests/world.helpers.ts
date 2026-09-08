import { readFile } from 'node:fs/promises'
import { expect, type Page } from '@playwright/test'
import init, { TrailEngine } from '../public/wasm/pioneer_trail_web_engine.js'
import type { GameView } from '../src/engine-types'
import type { RuntimeSnapshot } from '../src/game/contracts'
import type { SpatialState } from '../src/game/persistence'

const ready = init({
  module_or_path: await readFile('public/wasm/pioneer_trail_web_engine_bg.wasm'),
})
export const WORLD_KEY = 'pioneer-trail:world:v2'
export const initial = (): SpatialState => ({
  regionId: 'independence',
  terrain: 'Plains',
  regionIndex: 0,
  wagon: { x: 0, z: 20, yaw: 0, speed: 0 },
  player: { x: -3, z: 20, yaw: 0, pitch: 0 },
  mode: 'riding',
  frontierZ: 20,
  travelRemainder: 0,
  activity: null,
})
export type FixtureKind =
  | 'camp'
  | 'river'
  | 'trader'
  | 'fork'
  | 'event'
  | 'repair'
  | 'ending'
  | 'failure'
  | 'raft'
  | 'rain'
  | 'snow'
  | 'mountains'
  | 'fog'
  | 'river-daylight'
  | 'finale-fork'
  | 'fork-event'
  | 'before-fork-event'
const cache = new Map<string, { raw: string; view: GameView }>()
export async function fixture(kind: FixtureKind) {
  if (cache.has(kind)) return cache.get(kind)!
  await ready
  for (let seed = 11; seed < 50; seed++) {
    const engine = new TrailEngine(String(seed))
    const apply = (command: unknown) => JSON.parse(engine.apply(JSON.stringify(command)))
    apply({
      Configure: {
        trail_id: 'oregon',
        era_id: '1848',
        occupation_id: 'banker',
        party: ['Ada', 'James', 'Ruth', 'Thomas', 'Clara'],
        departure_month: kind === 'snow' ? 7 : 3,
      },
    })
    for (const [item_id, quantity] of [
      ['oxen', 3],
      ['food', kind === 'failure' ? 30 : 1800],
      ['clothing', 5],
      ['medicine', 3],
      ['ammunition', 10],
      ['wheel', 2],
      ['axle', 2],
      ['tongue', 2],
    ])
      apply({ Buy: { item_id, quantity } })
    apply('Depart')
    let beforeForkTravel: { campaign: string; view: GameView } | undefined
    for (let step = 0; step < 500; step++) {
      let view = JSON.parse(engine.view()) as GameView
      const status = typeof view.status === 'string' ? view.status : Object.keys(view.status)[0]
      const matches =
        (kind === 'camp' && step === 0) ||
        (kind === 'river' && status === 'AwaitingRiver' && !view.pending_event) ||
        (kind === 'river-daylight' &&
          status === 'AwaitingRiver' &&
          !view.pending_event &&
          /Clear|Warm|Hot/.test(view.weather) &&
          Math.sin(view.day * 0.6 + 0.65) > 0.4) ||
        (kind === 'trader' && status === 'AtLandmark' && view.can_shop && !view.pending_event) ||
        (kind === 'fork' && status === 'AwaitingFork' && !view.pending_event) ||
        (['fork-event', 'before-fork-event'].includes(kind) &&
          status === 'AwaitingFork' &&
          !!view.pending_event) ||
        (kind === 'event' && !!view.pending_event) ||
        (kind === 'repair' &&
          view.can_repair &&
          !['AwaitingFork', 'Failed', 'Arrived'].includes(status)) ||
        (kind === 'ending' && status === 'Arrived') ||
        (kind === 'failure' && status === 'Failed') ||
        (kind === 'rain' && /rain|storm/i.test(view.weather) && !view.pending_event) ||
        (kind === 'snow' && /snow|blizzard/i.test(view.weather) && !view.pending_event) ||
        (kind === 'mountains' && /mountain/i.test(view.terrain) && !view.pending_event) ||
        (kind === 'fog' &&
          view.weather === 'Cold' &&
          /RiverValley|Forest/.test(view.terrain) &&
          !view.pending_event) ||
        (kind === 'raft' &&
          status === 'AwaitingFork' &&
          view.routes.some((r) => r.id === 'columbia')) ||
        (kind === 'finale-fork' &&
          status === 'AwaitingFork' &&
          !view.pending_event &&
          view.routes.some((r) => r.id === 'columbia'))
      if (matches) {
        if (kind === 'raft') {
          apply({ ChooseRoute: { route_id: 'columbia' } })
          view = JSON.parse(engine.view()) as GameView
        }
        let campaign = engine.save()
        if (kind === 'before-fork-event') {
          if (!beforeForkTravel) throw new Error('Fork encounter has no preceding travel day')
          campaign = beforeForkTravel.campaign
          view = beforeForkTravel.view
        }
        const spatial = initial()
        spatial.regionId = view.current_node?.id ?? kind
        spatial.terrain = view.terrain
        const raw = JSON.stringify({
          version: 2,
          campaign,
          spatial,
          savedAt: new Date().toISOString(),
        })
        const result = { raw, view }
        cache.set(kind, result)
        return result
      }
      if (status === 'Arrived' || status === 'Failed') break
      if (view.pending_event)
        apply({
          Respond: {
            event_id: view.pending_event.id,
            choice_id: view.pending_event.choices.find((c) => c.available)!.id,
          },
        })
      else if (kind === 'failure') apply({ Rest: { days: 3 } })
      else if (status === 'AwaitingRiver')
        apply({ CrossRiver: { method: view.river?.ferry_cost_cents !== null ? 'Ferry' : 'Caulk' } })
      else if (status === 'AwaitingFork')
        apply({
          ChooseRoute: {
            route_id: view.routes.find((r) => r.available !== false && r.id !== 'columbia')!.id,
          },
        })
      else if (view.inventory.food < 120 && view.can_camp) apply('Forage')
      else {
        if (kind === 'before-fork-event' && status === 'Travelling')
          beforeForkTravel = { campaign: engine.save(), view }
        apply(status === 'AtLandmark' ? 'Continue' : 'TravelDay')
      }
    }
  }
  throw new Error(`No command-generated ${kind} fixture found`)
}
let fixtureNumber = 0
export async function restore(page: Page, raw: string) {
  // Let the old live runtime complete pagehide before installing an isolated checkpoint.
  await page.goto('about:blank')
  await page.addInitScript(
    ({ key, raw, marker }) => {
      if (!sessionStorage.getItem(marker)) {
        localStorage.setItem(key, raw)
        sessionStorage.setItem(marker, 'installed')
      }
    },
    { key: WORLD_KEY, raw, marker: `trail-test-fixture-${++fixtureNumber}` },
  )
  await page.goto('/?evidence=1')
  await page.waitForFunction(() => Boolean((window as unknown as { __trail: unknown }).__trail))
}
export async function state(page: Page): Promise<RuntimeSnapshot> {
  await page.waitForFunction(() => Boolean((window as unknown as { __trail?: unknown }).__trail))
  return page.evaluate(() =>
    (window as unknown as { __trail: { snapshot(): RuntimeSnapshot } }).__trail.snapshot(),
  )
}
export async function resume(page: Page) {
  await page.bringToFront()
  if ((await state(page)).paused) {
    const button = page.getByRole('button', { name: 'Resume journey' })
    await expect(button).toBeVisible()
    await button.click()
  }
  await expect.poll(async () => (await state(page)).paused).toBe(false)
}
export async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key)
  await page.waitForTimeout(ms)
  await page.keyboard.up(key)
}
export async function start(page: Page, trail = 'oregon', preset = 'Safe', seed = '11') {
  await page.goto('/?evidence=1')
  await page.getByRole('combobox', { name: 'Route', exact: true }).selectOption(trail)
  await page.getByLabel('Journey seed').fill(seed)
  await page.getByRole('button', { name: 'Choose provisions' }).click()
  await page.getByRole('radio', { name: new RegExp(`^${preset}`) }).click()
  await page.getByRole('button', { name: 'Load this plan' }).click()
  await page.getByRole('button', { name: 'Take the trail' }).click()
  await expect.poll(async () => (await state(page)).paused).toBe(false)
}
export async function walkTo(page: Page, x: number, z: number) {
  expect((await state(page)).mode).toBe('walking')
  for (let i = 0; i < 150; i++) {
    const s = await state(page),
      dx = x - s.position.x,
      dz = z - s.position.z
    if (Math.hypot(dx, dz) < 0.45) return
    const yaw = s.heading
    const forward = Math.sin(yaw) * dx + Math.cos(yaw) * dz
    const right = -Math.cos(yaw) * dx + Math.sin(yaw) * dz
    const key =
      Math.abs(forward) > Math.abs(right) ? (forward > 0 ? 'w' : 's') : right > 0 ? 'd' : 'a'
    await hold(
      page,
      key,
      Math.min(250, Math.max(40, (Math.max(Math.abs(forward), Math.abs(right)) / 3.2) * 1000)),
    )
  }
  throw new Error(
    `Walking did not reach ${x},${z}; actual ${JSON.stringify((await state(page)).position)}`,
  )
}

export type WorldObservation = {
  locations: Array<{ id: string; position: [number, number, number]; radius: number }>
  wildlife: Array<{
    id: string
    animal: string
    alive: boolean
    harvested: boolean
    position: { x: number; y: number; z: number }
  }>
}
export async function world(page: Page): Promise<WorldObservation> {
  return page.evaluate(() =>
    (window as unknown as { __trail: { world(): WorldObservation } }).__trail.world(),
  )
}
export async function aimAt(page: Page, target: { x: number; y: number; z: number }) {
  const current = await state(page)
  const yaw = Math.atan2(target.x - current.position.x, target.z - current.position.z)
  const turn = Math.atan2(Math.sin(yaw - current.heading), Math.cos(yaw - current.heading))
  if (Math.abs(turn) > 0.6)
    await hold(page, turn > 0 ? 'ArrowLeft' : 'ArrowRight', (Math.abs(turn) / 1.4) * 1000)
  const pose = await state(page)
  const pitch = await page.evaluate(
    () =>
      JSON.parse((window as unknown as { __trail: { save(): string } }).__trail.save()).spatial
        .player.pitch as number,
  )
  const dyaw = Math.atan2(Math.sin(yaw - pose.heading), Math.cos(yaw - pose.heading))
  const desiredPitch = Math.atan2(
    target.y - pose.position.y,
    Math.hypot(target.x - pose.position.x, target.z - pose.position.z),
  )
  const size = page.viewportSize()!
  await page.mouse.move(size.width / 2, size.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    size.width / 2 - dyaw / 0.0025,
    size.height / 2 - (desiredPitch - pitch) / 0.0025,
    { steps: 3 },
  )
  await page.mouse.up()
  await page.waitForTimeout(60)
}

/** Steer with normal controls toward a visible waypoint; never mutate world state. */
export async function driveTo(page: Page, x: number, z: number) {
  // Hold propulsion across observations, as a player does; IPC latency must not act as braking.
  const region = (await state(page)).regionIndex
  await page.keyboard.down('w')
  try {
    for (let i = 0; i < 140; i++) {
      const s = await state(page)
      // A completed crossing replaces the region; its old waypoint no longer exists.
      if (s.regionIndex !== region) return
      if (Math.hypot(s.wagon.x - x, s.wagon.z - z) < 2.5) return
      const wanted = Math.atan2(x - s.wagon.x, z - s.wagon.z)
      const delta = Math.atan2(Math.sin(wanted - s.wagon.yaw), Math.cos(wanted - s.wagon.yaw))
      if (Math.abs(delta) > 0.045) await page.keyboard.down(delta > 0 ? 'a' : 'd')
      await page.waitForTimeout(180)
      await page.keyboard.up('a')
      await page.keyboard.up('d')
    }
    throw new Error(`Drive did not reach ${x},${z}: ${JSON.stringify((await state(page)).wagon)}`)
  } finally {
    await page.keyboard.up('w')
    await page.keyboard.up('a')
    await page.keyboard.up('d')
  }
}
