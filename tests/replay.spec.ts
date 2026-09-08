import { expect, test } from '@playwright/test'
import { fixture, restore, start, state, WORLD_KEY } from './world.helpers'

test('settings starts a separately configured replay without replacing the archived journey', async ({
  page,
}) => {
  await start(page, 'oregon')
  const oldTrail = (await state(page)).view.trail_id
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const oldRaw = await page.evaluate((key) => localStorage.getItem(key), WORLD_KEY)
  expect(oldRaw).toBeTruthy()
  await page.getByRole('button', { name: 'New journey', exact: true }).click()
  await page.getByRole('combobox', { name: 'Route', exact: true }).selectOption('california')
  await page.getByRole('button', { name: 'Choose provisions', exact: true }).click()
  expect((await state(page)).view.trail_id).toBe('california')
  expect((await state(page)).view.trail_id).not.toBe(oldTrail)

  const preserved = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([key]) => key.startsWith('pioneer-trail:preserved:'))
      .map(([, value]) => value),
  )
  expect(preserved).toContain(oldRaw)
})

for (const kind of ['ending', 'failure'] as const) {
  test(`${kind} permits a new journey while preserving the completed chapter`, async ({ page }) => {
    await restore(page, (await fixture(kind)).raw)
    await expect(page.getByRole('heading', { name: 'Journey complete' })).toBeVisible()
    await page.getByRole('button', { name: 'New journey', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Begin a journey', exact: true })).toBeVisible()
    expect((await state(page)).view.status).toBe('Setup')
  })
}

test('an archive failure keeps the active journey when replay is requested', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const previous = await state(page)
  const raw = await page.evaluate((key) => localStorage.getItem(key), WORLD_KEY)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('pioneer-trail:preserved:'))
        throw new DOMException('Archive quota full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: 'New journey', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(/could not be preserved/i)
  expect((await state(page)).view.status).toEqual(previous.view.status)
  expect(await page.evaluate((key) => localStorage.getItem(key), WORLD_KEY)).toBe(raw)
})
