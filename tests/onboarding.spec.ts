import { expect, test } from '@playwright/test'
import { start, state, walkTo } from './world.helpers'
test('Escape cannot dismiss the required journey setup', async ({ page }) => {
  await page.goto('/?evidence=1')
  const setup = page.getByRole('heading', { name: 'Begin a journey', exact: true })
  await expect(setup).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(setup).toBeVisible()
  await page.getByRole('button', { name: 'Take the trail' }).click()
  await expect(page.getByRole('heading', { name: 'Begin a journey', exact: true })).toHaveCount(0)
})
test('whitespace-only traveler names keep the selected setup open without replacing a save', async ({
  page,
}) => {
  await page.goto('/?evidence=1')
  await page.getByRole('combobox', { name: 'Route', exact: true }).selectOption('california')
  const traveler = page.getByLabel('Traveler 1', { exact: true })
  await traveler.fill('   ')
  await page.getByRole('button', { name: 'Take the trail' }).click()
  await expect(page.getByText('Every traveler needs a name.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Begin a journey', exact: true })).toHaveCount(1)
  await expect(traveler).toHaveValue('   ')
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.getByRole('combobox', { name: 'Route', exact: true })).toHaveValue('california')
  expect(await page.evaluate(() => localStorage.getItem('pioneer-trail:world:v2'))).toBeNull()
})
for (const [preset, trail] of [
  ['Safe', 'oregon'],
  ['Moderate', 'california'],
  ['Risky', 'mormon'],
] as const) {
  test(`${preset} outfitting leads a named party into the ${trail} world`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await start(page, trail, preset)
    const packed = await state(page)
    expect(packed.view.trail_id).toBe(trail)
    expect(packed.view.inventory.food).toBeGreaterThan(0)
    expect(packed.view.inventory.oxen).toBeGreaterThanOrEqual(2)
    expect(packed.mode).toBe('riding')
    expect(packed.position.y).toBeGreaterThan(2)
    await expect(page.locator('.sidebar,.lower-grid,.scene-image')).toHaveCount(0)
    await page.getByRole('button', { name: 'Map', exact: true }).click()
    const map = page.getByRole('img', { name: /Geographic map/ })
    await expect(map).toBeVisible()
    const position = await map.locator(':scope > g').first().getAttribute('transform')
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await expect(map.locator(':scope > g').first()).not.toHaveAttribute('transform', position!)
    await page.getByRole('button', { name: 'Reset map position', exact: true }).click()
    await expect(map.locator(':scope > g').first()).toHaveAttribute('transform', position!)
    await page.getByRole('button', { name: 'Close panel' }).click()
    await page.keyboard.press('e')
    await expect.poll(async () => (await state(page)).mode).toBe('walking')
    await walkTo(page, -6.8, 20)
    await page.keyboard.press('e')
    await expect(page.getByRole('heading', { name: 'Camp', exact: true })).toBeVisible()
    const day = (await state(page)).view.day
    await page.getByRole('button', { name: 'Rest one day', exact: true }).click()
    await expect.poll(async () => (await state(page)).view.day).toBe(day + 1)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Resume journey' })).toBeVisible()
    expect((await state(page)).view.day).toBe(day + 1)
    expect(errors).toEqual([])
  })
}
test('farmer outfit remains budget-aware and rejected configurations stay visible', async ({
  page,
}) => {
  await page.goto('/?evidence=1')
  await page.getByRole('combobox', { name: 'Occupation', exact: true }).selectOption('farmer')
  const view = (await state(page)).view
  expect(view.inventory.food).toBeGreaterThanOrEqual(450)
  expect(view.cash_cents).toBeGreaterThanOrEqual(0)
  for (const item of ['wheel', 'axle', 'tongue'])
    expect(view.inventory[item]).toBeGreaterThanOrEqual(1)
  expect((await state(page)).view.status).toBe('Travelling')
})

test('setup keeps only the journey decisions and loads Moderate supplies by default', async ({ page }) => {
  await page.goto('/?evidence=1')
  await expect(page.getByLabel('Year')).toHaveCount(0)
  await expect(page.getByLabel('Difficulty')).toHaveCount(0)
  await expect(page.getByLabel('Journey seed')).toHaveCount(0)
  await expect(page.getByRole('radio', { name: /^Moderate/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Traveler 5')).toHaveCount(1)
  await page.getByRole('button', { name: 'Take the trail' }).click()
  expect((await state(page)).view.party).toHaveLength(5)
})
