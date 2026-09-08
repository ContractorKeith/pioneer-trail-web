import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { fixture, restore, resume, state, WORLD_KEY } from './world.helpers'

test('unsupported inner campaign exports exact original bytes and restores a validated backup', async ({
  page,
}) => {
  const checkpoint = await fixture('camp')
  const broken = JSON.parse(checkpoint.raw)
  broken.campaign = broken.campaign.replace('"version":2', '"version":99')
  const raw = ` \n${JSON.stringify(broken)}\n`
  await page.addInitScript(
    ({ key, raw, backup }) => {
      if (!sessionStorage.getItem('fixture')) {
        localStorage.setItem(key, raw)
        localStorage.setItem('pioneer-trail:world:backup:v2', backup)
        sessionStorage.setItem('fixture', '1')
      }
    },
    { key: WORLD_KEY, raw, backup: checkpoint.raw },
  )
  await page.goto('/?evidence=1')
  await expect(page.getByRole('heading', { name: 'Save needs recovery' })).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export preserved save' }).click(),
  ])
  expect(await readFile((await download.path())!, 'utf8')).toBe(raw)
  await page.getByRole('button', { name: 'Restore recovery copy' }).click()
  await expect.poll(async () => (await state(page)).view.status).toBe('Travelling')
  await expect(page.getByRole('heading', { name: 'Save needs recovery' })).toHaveCount(0)
  await resume(page)
  const preserved = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.includes(':preserved:'))
      .map((k) => localStorage.getItem(k)),
  )
  expect(preserved).toContain(raw)
})

test('archive quota failure still exposes exact rejected bytes without overwriting the save', async ({
  page,
}) => {
  const checkpoint = await fixture('camp')
  const broken = JSON.parse(checkpoint.raw)
  broken.campaign = broken.campaign.replace('"version":2', '"version":99')
  const raw = ` \n${JSON.stringify(broken)}\n`
  await page.addInitScript(
    ({ key, raw }) => {
      localStorage.setItem(key, raw)
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (k, value) {
        if (k.includes(':preserved:'))
          throw new DOMException('Archive quota full', 'QuotaExceededError')
        original.call(this, k, value)
      }
    },
    { key: WORLD_KEY, raw },
  )
  await page.goto('/?evidence=1')
  await expect(page.getByRole('heading', { name: 'Save needs recovery' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText(/could not archive/i)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export preserved save' }).click(),
  ])
  expect(await readFile((await download.path())!, 'utf8')).toBe(raw)
  expect(await page.evaluate((key) => localStorage.getItem(key), WORLD_KEY)).toBe(raw)
})

test('failed activity save pauses safely, retains ammunition and allows recovery', async ({
  page,
}) => {
  const checkpoint = await fixture('camp')
  await restore(page, checkpoint.raw)
  await resume(page)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Sound muted', exact: true }).click()
  await page.getByRole('button', { name: 'Close panel', exact: true }).click()
  await page.keyboard.press('e')
  await expect.poll(async () => (await state(page)).mode).toBe('walking')
  await page.keyboard.press('h')
  await expect.poll(async () => (await state(page)).activity?.kind).toBe('hunt')
  const before = await state(page)
  const outputRms = () =>
    page.evaluate(
      () => (window as unknown as { __trail: { audio(): { rms: number } } }).__trail.audio().rms,
    )
  await expect.poll(outputRms).toBeGreaterThan(0.00001)
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem
    Object.assign(window, {
      restoreStorage: () => {
        Storage.prototype.setItem = original
      },
    })
    Storage.prototype.setItem = function (k, value) {
      if (k === key) throw new DOMException('Simulated storage quota', 'QuotaExceededError')
      original.call(this, k, value)
    }
  }, WORLD_KEY)
  await page.keyboard.press('Space')
  await expect(page.getByRole('status')).toContainText(/quota/i)
  expect((await state(page)).paused).toBe(true)
  expect((await state(page)).view.ammunition_available).toBe(before.view.ammunition_available)
  await expect.poll(outputRms).toBeLessThan(0.00001)
  await page.evaluate(() => (window as unknown as { restoreStorage(): void }).restoreStorage())
  await page.reload()
  await resume(page)
  expect((await state(page)).activity?.kind).toBe('hunt')
  await page.keyboard.press('x')
  await expect.poll(async () => (await state(page)).activity).toBeNull()
  expect((await state(page)).view.day).toBe(before.view.day + 1)
})

test('missing campaign WASM shows a load error without replacing an existing save', async ({
  page,
}) => {
  const checkpoint = await fixture('camp')
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
    key: WORLD_KEY,
    raw: checkpoint.raw,
  })
  await page.route('**/pioneer_trail_web_engine_bg.wasm', (route) => route.abort('failed'))
  await page.goto('/?evidence=1')
  await expect(page.locator('body')).toContainText(
    /could not be restored|failed to fetch|networkerror/i,
  )
  expect(await page.evaluate((key) => localStorage.getItem(key), WORLD_KEY)).toBe(checkpoint.raw)
})
