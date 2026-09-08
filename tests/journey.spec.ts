import { expect, test, type Page } from '@playwright/test'

async function reset(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(startButton(page)).toBeVisible()
}

function startButton(page: Page) {
  return page
    .getByRole('region', { name: 'A view of the Pioneer Trail' })
    .getByRole('button', { name: 'Begin your journey' })
}

async function beginOutfitting(page: Page) {
  await startButton(page).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /Outfit your wagon/ }).click()
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'The wagon & provisions' }),
  ).toBeVisible()
}

async function depart(page: Page) {
  await page.getByText('Shop item by item', { exact: true }).click()
  await buy(page, 'Oxen', 3)
  await buy(page, 'Food', 1200)
  await sell(page, 'Food', 100, 1100)
  await buy(page, 'Food', 100, 1200)
  await expect(page.getByRole('dialog').locator('.store-summary > div').nth(2)).toContainText(
    /[1-9]\d days/,
  )
  await page.getByRole('button', { name: /^(Leave |Depart with these supplies)/ }).click()
  const deliberate = page.getByRole('button', { name: 'Depart with these supplies' })
  if (
    await deliberate
      .waitFor({ state: 'visible', timeout: 1_000 })
      .then(() => true)
      .catch(() => false)
  )
    await deliberate.click()
  await expect(page.getByText(/DAY 1 OF YOUR JOURNEY/)).toBeVisible()
  const routeChoice = page.locator('dialog .choice-list .choice').first()
  if (await routeChoice.isVisible().catch(() => false)) {
    await routeChoice.click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }
}

async function buy(page: Page, item: string, quantity: number, expectedOnHand = quantity) {
  const row = page.getByRole('row').filter({ hasText: new RegExp(`^${item}`) })
  const input = row.getByRole('spinbutton')
  await input.fill(String(quantity))
  await expect(input).toHaveValue(String(quantity))
  await row.getByRole('button', { name: /^Buy/ }).click()
  await expect(row.locator('td').nth(1)).toHaveText(String(expectedOnHand))
}

async function sell(page: Page, item: string, quantity: number, expectedOnHand: number) {
  const row = page.getByRole('row').filter({ hasText: new RegExp(`^${item}`) })
  const input = row.getByRole('spinbutton')
  await input.fill(String(quantity))
  await expect(input).toHaveValue(String(quantity))
  const action = row.getByRole('button', { name: new RegExp(`^Sell ${quantity} ${item} for \\$`) })
  await expect(action).toBeVisible()
  await action.click()
  await expect(row.locator('td').nth(1)).toHaveText(String(expectedOnHand))
}

function dayLabel(page: Page) {
  return page.locator('.journey-heading .eyebrow')
}
function foodLabel(page: Page) {
  return page.locator('.status-stat').filter({ hasText: 'FOOD' }).locator('strong')
}

test.describe('journey acceptance', () => {
  test.beforeEach(async ({ page }) => reset(page))

  test('desktop and mobile can configure, stock, and depart through the real engine', async ({
    page,
  }, testInfo) => {
    await beginOutfitting(page)
    await expect(
      page.getByRole('button', { name: 'Outfit with recommended supplies', exact: true }),
    ).toBeVisible()
    await depart(page)
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('pioneer-trail:journey:v1')))
      .not.toBeNull()
    await page.screenshot({
      path: `/tmp/pioneer-trail-${testInfo.project.name}.png`,
      fullPage: true,
    })
  })

  test('camp, journal, map, conversation, pace and rations do not accidentally advance time', async ({
    page,
  }) => {
    await beginOutfitting(page)
    await depart(page)
    const day = await dayLabel(page).textContent()

    await page.getByRole('button', { name: 'Make camp' }).click()
    await expect(page.getByRole('dialog')).toContainText('The wagon is parked')
    await expect(dayLabel(page)).toHaveText(day!)
    await page.getByRole('button', { name: 'Close panel' }).click()

    await page.getByRole('button', { name: 'Field journal' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Close panel' }).click()
    await page.getByRole('button', { name: 'Trail map' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Close panel' }).click()

    await page.getByText('Travel options', { exact: true }).click()
    await page.getByRole('button', { name: 'Pace & rest' }).click()
    await page.locator('select').first().selectOption('Strenuous')
    await page.locator('select').nth(1).selectOption('Meager')
    await expect(page.locator('select').first()).toHaveValue('Strenuous')
    await expect(page.locator('select').nth(1)).toHaveValue('Meager')
    await expect(dayLabel(page)).toHaveText(day!)
    await page.getByRole('button', { name: 'Close panel' }).click()

    await page.getByRole('button', { name: 'Meet travelers' }).click()
    const routeQuestion = page.getByRole('button', { name: 'What is the road like ahead?' })
    if (await routeQuestion.isVisible().catch(() => false)) {
      await routeQuestion.click()
      await expect(page.locator('.conversation-reply')).toBeVisible()
    }
    await expect(dayLabel(page)).toHaveText(day!)
  })

  test('rest spends a day and food, and autosave survives reload', async ({ page }) => {
    await beginOutfitting(page)
    await depart(page)
    const initialDay = await dayLabel(page).textContent()
    const initialFood = await foodLabel(page).textContent()
    await page.getByText('Travel options', { exact: true }).click()
    await page.getByRole('button', { name: 'Pace & rest' }).click()
    await page.getByRole('button', { name: 'Rest 1 day' }).click()
    await expect(dayLabel(page)).not.toHaveText(initialDay!)
    await expect(foodLabel(page)).not.toHaveText(initialFood!)
    const savedDay = await dayLabel(page).textContent()
    await page.reload()
    await expect(dayLabel(page)).toHaveText(savedDay!)
  })

  test('malformed import preserves the active journey; mute and reduced motion settings persist', async ({
    page,
  }) => {
    await beginOutfitting(page)
    await depart(page)
    const before = await dayLabel(page).textContent()
    await page.getByRole('button', { name: 'Settings and saves' }).click()
    const sound = page.getByRole('switch', { name: 'Ambient sound' })
    const reduced = page.getByRole('switch', { name: 'Reduced motion' })
    await sound.click()
    await reduced.click()
    await expect(sound).toHaveAttribute('aria-checked', 'true')
    await expect(reduced).toHaveAttribute('aria-checked', 'true')
    await page.getByLabel('Choose journey save').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{not valid json'),
    })
    await expect(page.getByRole('alert')).toContainText('could not be imported')
    await expect(dayLabel(page)).toHaveText(before!)
    await page.reload()
    await page.getByRole('button', { name: 'Settings and saves' }).click()
    await expect(page.getByRole('switch', { name: 'Ambient sound' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(page.getByRole('switch', { name: 'Reduced motion' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})
