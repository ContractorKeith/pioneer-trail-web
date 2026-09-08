import { expect, test, type Page } from '@playwright/test'
import {
  fixture,
  gameplayTimeout,
  hold,
  holdUntil,
  restore,
  resume,
  start,
  state,
  walkTo,
  world,
} from './world.helpers'

type FishingObservation = {
  fishingTarget: [number, number, number] | null
  river: { startZ: number; endZ: number } | null
}

async function fishingObservation(page: Page): Promise<FishingObservation> {
  return page.evaluate(() =>
    (
      window as unknown as {
        __trail: { world(): FishingObservation }
      }
    ).__trail.world(),
  )
}

async function savedCast(page: Page): Promise<{ castX: number; castZ: number }> {
  return page.evaluate(() => {
    const save = JSON.parse(
      (window as unknown as { __trail: { save(): string } }).__trail.save(),
    ) as { spatial: { activity: { data: { castX?: number; castZ?: number } } | null } }
    const data = save.spatial.activity?.data
    if (typeof data?.castX !== 'number' || typeof data.castZ !== 'number')
      throw new Error('Fishing cast coordinates were not saved')
    return { castX: data.castX, castZ: data.castZ }
  })
}

test('fishing casts a visible target from the crossing bank and preserves it through reload', async ({
  page,
}) => {
  const outer = JSON.parse((await fixture('river')).raw)
  outer.spatial.wagon = { x: 0, z: 80, yaw: 0, speed: 0 }
  outer.spatial.player = { x: -3, z: 80, yaw: 0, pitch: 0 }
  outer.spatial.frontierZ = 80
  await restore(page, JSON.stringify(outer))
  await resume(page)
  await hold(page, 'w', 800)
  await holdUntil(page, 'Space', (s) => s.speed === 0, {
    timeout: gameplayTimeout(3000),
    message: 'Stop the wagon through its brake control',
  })
  await page.keyboard.press('e')
  await expect.poll(async () => (await state(page)).mode).toBe('walking')
  await walkTo(page, -3, 94)
  const bank = (await world(page)).locations.find((location) => location.id === 'riverbank')!
  await walkTo(page, bank.position[0], 94)
  await expect.poll(async () => (await state(page)).interaction?.kind).toBe('water')

  const beforeCast = await state(page)
  await page.keyboard.press('f')
  await expect.poll(async () => (await state(page)).activity?.kind).toBe('fish')
  await page.keyboard.press('Space')
  await expect.poll(async () => (await state(page)).activity?.phase).toBe('waiting')

  await expect.poll(async () => (await fishingObservation(page)).fishingTarget).not.toBeNull()
  const observed = await fishingObservation(page)
  const target = observed.fishingTarget
  expect(target).not.toBeNull()
  expect(observed.river).not.toBeNull()
  const [x, , z] = target!
  expect(z).toBeGreaterThan(observed.river!.startZ)
  expect(z).toBeLessThan(observed.river!.endZ)
  expect(Math.abs(x - bank.position[0])).toBeLessThan(0.5)
  expect(z).toBeGreaterThan(90)
  const cast = await savedCast(page)
  expect(cast.castX).toBeCloseTo(x)
  expect(cast.castZ).toBeCloseTo(z)

  const beforeMove = await state(page)
  await hold(page, 's', 500)
  expect((await state(page)).position).not.toEqual(beforeMove.position)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Paused', exact: true })).toBeVisible()
  await page.reload()
  await resume(page)

  const reloaded = await state(page)
  expect(reloaded.view.day).toBe(beforeCast.view.day)
  expect(reloaded.view.inventory.food).toBe(beforeCast.view.inventory.food)
  expect(reloaded.activity?.kind).toBe('fish')
  const persisted = await savedCast(page)
  expect(persisted).toEqual(cast)
  await expect.poll(async () => (await fishingObservation(page)).fishingTarget).not.toBeNull()
  const reloadedTarget = await fishingObservation(page)
  expect(reloadedTarget.fishingTarget).not.toBeNull()
  expect(reloadedTarget.fishingTarget![0]).toBeCloseTo(cast.castX)
  expect(reloadedTarget.fishingTarget![2]).toBeCloseTo(cast.castZ)
})

test('HUD fog agrees with the rendered region after an ordinary cold departure day', async ({
  page,
}) => {
  await start(page, 'oregon', 'Safe', '4')
  await page.keyboard.down('w')
  try {
    await expect
      .poll(async () => (await state(page)).view.day, { timeout: gameplayTimeout(20_000) })
      .toBeGreaterThanOrEqual(1)
  } finally {
    await page.keyboard.up('w')
  }
  await holdUntil(page, 'Space', (s) => s.speed === 0, {
    timeout: gameplayTimeout(3000),
    message: 'Stop the wagon through its brake control',
  })
  const cold = await state(page)
  expect(cold.view.weather).toBe('Cold')
  expect(cold.sceneWeather).toBe('clear')
  await expect(page.locator('.hud-metrics')).toContainText('Cold')
  await expect(page.locator('.hud-metrics')).not.toContainText('fog')
  await restore(page, (await fixture('fog')).raw)
  await resume(page)
  await expect.poll(async () => (await state(page)).sceneWeather).toBe('fog')
  await expect(page.locator('.hud-metrics')).toContainText('fog')
})
