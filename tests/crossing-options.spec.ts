import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import init, { TrailEngine } from '../public/wasm/pioneer_trail_web_engine.js'
import type { GameView } from '../src/engine-types'
import { phase } from '../src/presentation'
import {
  driveTo,
  fixture,
  gameplayTimeout,
  hold,
  holdUntil,
  initial,
  restore,
  resume,
  state,
  world,
} from './world.helpers'

const guideReady = init({
  module_or_path: await readFile('public/wasm/pioneer_trail_web_engine_bg.wasm'),
})
let guideCheckpoint: { raw: string; view: GameView } | undefined

/** Replays the campaign through WASM to the only crossing where a guide is legal. */
async function snakeRiverCheckpoint() {
  if (guideCheckpoint) return guideCheckpoint
  await guideReady
  const engine = new TrailEngine('11')
  const apply = (command: unknown) => JSON.parse(engine.apply(JSON.stringify(command)))
  const view = () => JSON.parse(engine.view()) as GameView
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
    ['food', 1800],
    ['clothing', 5],
    ['medicine', 3],
    ['ammunition', 10],
    ['wheel', 2],
    ['axle', 2],
    ['tongue', 2],
  ])
    apply({ Buy: { item_id, quantity } })
  apply('Depart')

  for (let step = 0; step < 500; step++) {
    const current = view()
    const status =
      typeof current.status === 'string' ? current.status : Object.keys(current.status)[0]
    if (
      status === 'AwaitingRiver' &&
      !current.pending_event &&
      current.current_node?.id === 'snake_river'
    ) {
      const spatial = initial()
      spatial.regionId = 'snake_river'
      spatial.terrain = current.terrain
      guideCheckpoint = {
        raw: JSON.stringify({
          version: 2,
          campaign: engine.save(),
          spatial,
          savedAt: new Date().toISOString(),
        }),
        view: current,
      }
      return guideCheckpoint
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
  throw new Error('No command-generated Snake River guide checkpoint found')
}

function bankApproach(raw: string) {
  const outer = JSON.parse(raw)
  outer.spatial.wagon = { x: 0, z: 80, yaw: 0, speed: 0 }
  outer.spatial.player = { x: -3, z: 80, yaw: 0, pitch: 0 }
  outer.spatial.frontierZ = 80
  return JSON.stringify(outer)
}

async function inspectRiver(page: Page) {
  await resume(page)
  await hold(page, 'w', 800)
  await holdUntil(page, 'Space', (s) => s.speed === 0, {
    timeout: gameplayTimeout(3000),
    message: 'Stop the wagon through its brake control',
  })
  await expect.poll(async () => (await state(page)).speed).toBe(0)
  await expect(page.getByRole('button', { name: /Inspect the crossing/ })).toBeVisible()
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { name: 'River crossing', exact: true })).toBeVisible()
}

test('R05 driver discovers the crossing from the seat and a retreat costs exactly one day', async ({
  page,
}) => {
  await restore(page, bankApproach((await fixture('river')).raw))
  await inspectRiver(page)
  const before = await state(page)
  await page
    .getByRole('button', { name: /^(Ford|Caulk)/ })
    .first()
    .click()
  await expect.poll(async () => (await state(page)).activity?.kind).toBe('crossing')
  await expect.poll(async () => (await state(page)).mode).toBe('riding')
  await page.keyboard.press('x')
  await expect.poll(async () => (await state(page)).activity).toBeNull()
  const after = await state(page)
  expect(after.view.day).toBe(before.view.day + 1)
  expect(phase(after.view)).toBe('AwaitingRiver')
})

test('R05 driver can get down and reboard beside the halted wagon before inspecting from the seat', async ({
  page,
}) => {
  await restore(page, bankApproach((await fixture('river')).raw))
  await resume(page)
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { name: 'River crossing', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Get down and look around', exact: true }).click()
  await expect.poll(async () => (await state(page)).mode).toBe('walking')
  await expect(page.getByRole('button', { name: /Board the wagon/ })).toBeVisible()
  await page.keyboard.press('e')
  await expect.poll(async () => (await state(page)).mode).toBe('riding')
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { name: 'River crossing', exact: true })).toBeVisible()
})

test('R05 on-foot water-edge inspection does not offer a second dismount', async ({ page }) => {
  const outer = JSON.parse(bankApproach((await fixture('river')).raw))
  outer.spatial.mode = 'walking'
  outer.spatial.player = { x: 0, z: 104, yaw: 0, pitch: 0 }
  await restore(page, JSON.stringify(outer))
  await resume(page)
  await expect(page.getByRole('button', { name: /Inspect the crossing/ })).toBeVisible()
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { name: 'River crossing', exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Get down and look around', exact: true }),
  ).toHaveCount(0)
})

test('R05 nearby locations win over the river inspection band on foot', async ({ page }) => {
  const outer = JSON.parse(bankApproach((await fixture('river')).raw))
  outer.spatial.mode = 'walking'
  outer.spatial.player = { x: 8.4, z: 28.4, yaw: 0, pitch: 0 }
  await restore(page, JSON.stringify(outer))
  await resume(page)
  await expect.poll(async () => (await state(page)).interaction?.label).toBe('E · Trail trader')
})

test('R05 Wait costs a camp day and food while keeping the wagon at the riverbank', async ({
  page,
}) => {
  await restore(page, bankApproach((await fixture('river')).raw))
  await inspectRiver(page)
  const before = await state(page)
  await page.getByRole('button', { name: /^Wait/ }).click()
  const waited = await state(page)
  expect(waited.view.day).toBe(before.view.day + 1)
  expect(waited.view.inventory.food).toBeLessThan(before.view.inventory.food)
  expect(phase(waited.view)).toBe('AwaitingRiver')
  expect(waited.wagon).toEqual(before.wagon)
  await expect(page.getByRole('heading', { name: 'River crossing', exact: true })).toBeVisible()
})

test('R05 Guide discloses and spends Snake River clothing when an attempted crossing aborts', async ({
  page,
}) => {
  await restore(page, bankApproach((await snakeRiverCheckpoint()).raw))
  await inspectRiver(page)
  const before = await state(page)
  const cost = before.view.river!.guide_cost_clothing
  const guide = page.getByRole('button', { name: /^Guide/ })
  await expect(guide).toContainText(`${cost} clothing`)
  await guide.click()
  await expect.poll(async () => (await state(page)).activity?.kind).toBe('crossing')
  await page.keyboard.press('x')
  await expect.poll(async () => (await state(page)).activity).toBeNull()
  const aborted = await state(page)
  expect(phase(aborted.view)).toBe('AwaitingRiver')
  expect(aborted.view.day).toBe(before.view.day + 1)
  expect(aborted.view.inventory.clothing).toBe(before.view.inventory.clothing - cost)
})

test('R03/R05 Columbia route selection launches a physical raft run to the ending', async ({
  page,
}) => {
  test.setTimeout(gameplayTimeout(150_000))
  const { finishCrossing } = (await import(
    new URL('../scripts/campaign-walkthrough.mjs', import.meta.url).href
  )) as { finishCrossing(page: Page, report: Record<string, unknown>): Promise<void> }
  await restore(page, bankApproach((await fixture('finale-fork')).raw))
  await expect(page.getByRole('heading', { name: 'Choose the trail', exact: true })).toBeVisible()
  await page.locator('.route-list button').filter({ hasText: 'Columbia' }).click()
  await expect.poll(async () => (await state(page)).view.active_minigame?.kind).toBe('Raft')
  await page.getByRole('button', { name: 'Close panel' }).click()
  await resume(page)
  const river = (await world(page)).river!
  await driveTo(page, 0, river.startZ - 12)
  await holdUntil(page, 'Space', (s) => s.speed === 0, {
    timeout: gameplayTimeout(3000),
    message: 'Stop the wagon through its brake control',
  })
  await page.keyboard.press('e')
  await expect.poll(async () => (await state(page)).activity?.kind).toBe('crossing')

  await driveTo(page, 0, 98)
  await driveTo(page, -8, 107)
  await driveTo(page, -7, 132)
  await finishCrossing(page, {})
  const arrived = await state(page)
  expect(arrived.activity).toBeNull()
  expect(arrived.view.status).toBe('Arrived')
  expect(arrived.view.current_node?.id).toBe('willamette')
})
