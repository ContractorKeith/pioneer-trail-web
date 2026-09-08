import { expect, test } from '@playwright/test'
import {
  driveTo,
  fixture,
  hold,
  initial,
  restore,
  resume,
  start,
  state,
  walkTo,
  world,
  WORLD_KEY,
} from './world.helpers'

// Fixtures only arrange rare campaign checkpoints; every mechanic below uses visible UI/real keys.
test('first person looks back, walks a complete circuit, collides, reboards and drives', async ({
  page,
}) => {
  await start(page)
  const origin = await state(page)
  await hold(page, 'ArrowLeft', 2250)
  expect(Math.abs((await state(page)).heading)).toBeGreaterThan(2.8)
  await page.screenshot({ path: test.info().outputPath('rear-seat.png') })
  await hold(page, 'ArrowRight', 2250)
  await page.keyboard.press('e')
  await expect.poll(async () => (await state(page)).mode).toBe('walking')
  await walkTo(page, -4, 14)
  await walkTo(page, 4, 14)
  await walkTo(page, 4, 29)
  await walkTo(page, -4, 29)
  await walkTo(page, -3, 20)
  const stopped = (await state(page)).position
  await hold(page, 'a', 1000)
  const blocked = await state(page)
  expect(blocked.position.x).toBeLessThan(-1.4)
  expect(blocked.collisionCount).toBeGreaterThan(0)
  await page.keyboard.press('e')
  await expect.poll(async () => (await state(page)).mode).toBe('riding')
  await hold(page, 'w', 8500)
  await hold(page, 'Space', 800)
  const driven = await state(page)
  expect(driven.wagon.z).toBeGreaterThan(origin.wagon.z + 30)
  expect(driven.view.miles).toBeGreaterThan(0)
  expect(driven.speed).toBe(0)
  expect(stopped.z).toBeGreaterThan(19)
})

test('Escape and overlays freeze input; focus loss and reload recover without advancing', async ({
  page,
}) => {
  await start(page)
  await hold(page, 'w', 1800)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Paused', exact: true })).toBeVisible()
  const frozen = await state(page)
  expect(frozen.paused).toBe(true)
  await hold(page, 'w', 400)
  await hold(page, 'ArrowLeft', 300)
  const still = await state(page)
  expect(still.wagon.z).toBe(frozen.wagon.z)
  expect(still.heading).toBe(frozen.heading)
  await page.getByRole('button', { name: 'Return to the trail' }).click()
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect.poll(async () => (await state(page)).paused).toBe(true)
  await page.reload()
  await resume(page)
  expect((await state(page)).view.day).toBe(frozen.view.day)
  expect((await state(page)).wagon.z).toBe(frozen.wagon.z)
})

for (const method of ['Ferry', 'Caulk'] as const)
  test(`${method} crossing has costs and onward physical travel`, async ({ page }) => {
    test.setTimeout(150_000)
    const checkpoint = await fixture('river'),
      outer = JSON.parse(checkpoint.raw)
    outer.spatial.wagon.z = 80
    outer.spatial.frontierZ = 80
    outer.spatial.player = { x: -3, z: 80, yaw: 0, pitch: 0 }
    await restore(page, JSON.stringify(outer))
    await resume(page)
    await hold(page, 'w', 800)
    await hold(page, 'Space', 800)
    await expect.poll(async () => (await state(page)).speed).toBe(0)
    await page.keyboard.press('e')
    await expect.poll(async () => (await state(page)).mode).toBe('walking')
    await walkTo(page, -3, 94)
    const bank = (await world(page)).locations.find((l) => l.id === 'riverbank')!
    await walkTo(page, bank.position[0], 94)
    await page.keyboard.press('e')
    await expect(page.getByRole('heading', { name: 'River crossing', exact: true })).toBeVisible()
    const before = (await state(page)).view
    if (method === 'Ferry') {
      await page.getByRole('button', { name: /^Ferry/ }).click()
      await page.getByRole('button', { name: 'Close panel' }).click()
      // Reboard at the new checkpoint, then movement must continue beyond the old bank.
      if ((await state(page)).mode === 'walking') await page.keyboard.press('e')
      await hold(page, 'w', 2200)
      const after = await state(page)
      expect(after.view.cash_cents).toBeLessThan(before.cash_cents)
      expect(after.view.day).toBe(before.day + 1)
      expect(after.wagon.z).toBeGreaterThan(22)
    } else {
      await page.getByRole('button', { name: /^Caulk and float/ }).click()
      await expect.poll(async () => (await state(page)).activity?.kind).toBe('crossing')
      await hold(page, 'w', 11500)
      expect((await state(page)).view.activity!.cargo_lost_lbs).toBeGreaterThan(0)
      await page.keyboard.down('s')
      await expect
        .poll(async () => (await state(page)).wagon.z, { timeout: 16000 })
        .toBeLessThan(100)
      await page.keyboard.up('s')
      await driveTo(page, -9, 102)
      await driveTo(page, -9, 144)
      await hold(page, 'w', 1700)
      await hold(page, 'Space', 800)
      const after = await state(page)
      expect(after.activity).toBeNull()
      expect(after.view.day).toBeGreaterThanOrEqual(before.day + 1)
      expect(after.view.status).toBe('Travelling')
      expect(after.wagon.z).toBeGreaterThan(20)
      const saved = await page.evaluate(() =>
        JSON.parse((window as unknown as { __trail: { save(): string } }).__trail.save()),
      )
      expect(saved.spatial.frontierZ).toBeLessThanOrEqual(after.wagon.z + 0.1)
    }
  })

for (const [kind, title] of [
  ['fork', 'Choose the trail'],
  ['event', 'Trail moment'],
  ['ending', 'Journey complete'],
  ['failure', 'Journey complete'],
] as const)
  test(`saved ${kind} presents its mandatory decision on reload`, async ({ page }) => {
    const checkpoint = await fixture(kind)
    await restore(page, checkpoint.raw)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    const before = await state(page)
    await page.reload()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    expect((await state(page)).wagon.z).toBe(before.wagon.z)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: title, exact: true })).not.toBeVisible()
    await page.locator('canvas.game-canvas').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close panel', exact: true }).click()
    await page
      .getByRole('button', {
        name:
          kind === 'fork'
            ? 'Choose the trail'
            : kind === 'event'
              ? 'Resolve trail moment'
              : 'Review ending',
        exact: true,
      })
      .click()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: title, exact: true })).not.toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    if (kind === 'fork') {
      await page.locator('.route-list button:not([disabled])').first().click()
      expect((await state(page)).view.status).toBe('Travelling')
    }
  })

test('fishing casts, hooks, reels and commits the caught food and day exactly once', async ({
  page,
}) => {
  const checkpoint = await fixture('camp'),
    outer = JSON.parse(checkpoint.raw)
  outer.spatial = {
    ...initial(),
    terrain: 'RiverValley',
    mode: 'walking',
    player: { x: 19.5, z: 34, yaw: Math.PI / 2, pitch: -0.25 },
  }
  await restore(page, JSON.stringify(outer))
  await resume(page)
  await page.keyboard.press('f')
  await expect.poll(async () => (await state(page)).activity?.phase).toBe('ready')
  const before = (await state(page)).view
  await page.keyboard.press('Space')
  await expect.poll(async () => (await state(page)).activity?.phase, { timeout: 8000 }).toBe('bite')
  await page.keyboard.press('Space')
  for (let i = 0; i < 150; i++) {
    const activity = (await state(page)).activity
    if (!activity) break
    if ((activity.tension ?? 0) < 0.65) await page.keyboard.down('Space')
    else await page.keyboard.up('Space')
    await page.waitForTimeout(100)
  }
  await page.keyboard.up('Space')
  const after = await state(page)
  expect(after.activity).toBeNull()
  expect(after.view.day).toBe(before.day + 1)
  expect(after.view.inventory.food).toBe(before.inventory.food - 15 + 12)
  await expect(page.locator('.notice')).toContainText('landed 12 lb')
  const food = after.view.inventory.food
  await page.reload()
  expect((await state(page)).view.inventory.food).toBe(food)
  expect((await state(page)).view.day).toBe(after.view.day)
})

test('a missed fishing bite spends its day without a catch', async ({ page }) => {
  const checkpoint = await fixture('camp'),
    outer = JSON.parse(checkpoint.raw)
  outer.spatial = {
    ...initial(),
    terrain: 'RiverValley',
    mode: 'walking',
    player: { x: 19.5, z: 34, yaw: Math.PI / 2, pitch: 0 },
  }
  await restore(page, JSON.stringify(outer))
  await resume(page)
  const before = (await state(page)).view
  await page.keyboard.press('f')
  await page.keyboard.press('Space')
  await expect
    .poll(async () => (await state(page)).activity?.phase, { timeout: 10000 })
    .toBe('bite')
  await expect.poll(async () => (await state(page)).activity, { timeout: 8000 }).toBeNull()
  const after = await state(page)
  expect(after.activity).toBeNull()
  expect(after.view.day).toBe(before.day + 1)
  expect(after.view.inventory.food).toBeLessThan(before.inventory.food)
})

test('settings and desktop resize preserve the world, fit the canvas and overlay, and retain usable controls; imports preserve failed input', async ({
  page,
}) => {
  await start(page)
  await hold(page, 'w', 1200)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const before = await state(page)
  await page.getByLabel('Field of view').fill('80')
  await page.getByRole('button', { name: 'Reduce camera motion' }).click()
  await page.getByLabel('Graphics quality').selectOption('low')
  const after = await state(page)
  expect(after.wagon.z).toBe(before.wagon.z)
  expect(after.regionIndex).toBe(before.regionIndex)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export save', exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toContain('save')
  const saved = await page.evaluate((key) => localStorage.getItem(key), WORLD_KEY)
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  })
  await expect(page.locator('.notice')).toContainText('could not be imported')
  expect((await state(page)).wagon.z).toBe(before.wagon.z)
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).campaign, WORLD_KEY),
  ).toBe(JSON.parse(saved!).campaign)
  const beforeResize = await state(page)
  await page.setViewportSize({ width: 1024, height: 768 })
  expect((await state(page)).view.seed).toBe(before.view.seed)
  const canvas = page.locator('canvas.game-canvas')
  await expect
    .poll(() =>
      canvas.evaluate((element: HTMLCanvasElement) => ({
        width: element.width,
        height: element.height,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
      })),
    )
    .toEqual({ width: 1024, height: 768, clientWidth: 1024, clientHeight: 768 })
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBe(0)
  expect(bounds!.y).toBe(0)
  expect(bounds!.width / bounds!.height).toBeCloseTo(4 / 3, 5)
  const resized = await state(page)
  expect(resized.view).toEqual(after.view)
  expect(resized.wagon).toEqual(before.wagon)
  expect(resized.position).toEqual(beforeResize.position)
  expect(resized.heading).toBe(beforeResize.heading)
  expect(resized.regionIndex).toBe(before.regionIndex)
  expect(resized.paused).toBe(true)

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeInViewport({
    ratio: 1,
  })
  expect(
    await dialog
      .locator('.dialog-body')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true)
  const fieldOfView = page.getByLabel('Field of view')
  await fieldOfView.scrollIntoViewIfNeeded()
  await expect(fieldOfView).toBeInViewport({ ratio: 1 })
  await expect(fieldOfView).toHaveValue('80')
  await fieldOfView.fill('84')
  await expect(fieldOfView).toHaveValue('84')
  await expect(page.getByRole('button', { name: 'Close panel', exact: true })).toBeInViewport({
    ratio: 1,
  })
  await page.getByRole('button', { name: 'Close panel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(async () => (await state(page)).paused).toBe(false)
  await hold(page, 'w', 1800)
  await hold(page, 'Space', 800)
  const moved = await state(page)
  expect(moved.wagon.z).toBeGreaterThan(resized.wagon.z + 1)
  expect(moved.mode).toBe('riding')
  expect(moved.speed).toBe(0)
  expect(moved.view.seed).toBe(before.view.seed)
  expect(moved.regionIndex).toBe(before.regionIndex)
})

test('unsupported WebGL gives an honest compatibility message', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (args[0] === 'webgl2') return null
      return original.apply(this, args)
    } as typeof original
  })
  await page.goto('/')
  await expect(page.locator('body')).toContainText('needs WebGL 2')
  await expect(page.locator('.sidebar,.scene-image')).toHaveCount(0)
})

// Preserve actual controller/time evidence for failures, including slow or interrupted hosts.
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return
  try {
    const evidence = await page.evaluate(() => {
      const trail = (
        window as unknown as {
          __trail: { snapshot(): unknown; save(): string; frames(): number[]; renderer(): unknown }
        }
      ).__trail
      return {
        snapshot: trail.snapshot(),
        spatial: JSON.parse(trail.save()).spatial,
        frames: trail.frames().slice(-120),
        renderer: trail.renderer(),
      }
    })
    await info.attach('runtime-at-failure', {
      body: JSON.stringify(evidence, null, 2),
      contentType: 'application/json',
    })
  } catch {
    /* Browser-level failure has its own launch/crash evidence. */
  }
})
