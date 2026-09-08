import { expect, test, type Page } from '@playwright/test'
import { start } from './world.helpers'

type AudioInspection = {
  state: string
  rms: number
  masterGain: number
  volume: number
  muted: boolean
  unlocked: boolean
}

async function audio(page: Page): Promise<AudioInspection> {
  return page.evaluate(() =>
    (window as unknown as { __trail: { audio(): AudioInspection } }).__trail.audio(),
  )
}

test('settings control the unlocked runtime audio output', async ({ page }) => {
  await start(page)
  expect((await audio(page)).rms).toBe(0)

  const viewport = page.viewportSize()!
  await page.locator('canvas.game-canvas').click({
    position: { x: viewport.width * 0.7, y: viewport.height * 0.4 },
  })
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Sound muted', exact: true }).click()
  await expect.poll(async () => (await audio(page)).unlocked).toBe(true)
  expect((await audio(page)).muted).toBe(false)
  await page.getByLabel('Close panel').click()

  await page.keyboard.down('w')
  await page.waitForTimeout(700)
  await page.keyboard.up('w')
  const normal = await audio(page)
  expect(normal.rms).toBeGreaterThan(0.00001)

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const volume = page.getByLabel('Volume', { exact: true })
  await volume.press('Home')
  await volume.press('ArrowRight')
  await volume.press('ArrowRight')
  await page.getByLabel('Close panel').click()
  await page.waitForTimeout(350)
  expect((await audio(page)).rms).toBeLessThan(normal.rms)

  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.waitForTimeout(650)
  expect((await audio(page)).rms).toBeLessThan(0.00001)
  await page.getByRole('button', { name: 'Return to the trail', exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Sound on', exact: true }).click()
  await page.getByLabel('Close panel').click()
  await page.waitForTimeout(650)
  expect((await audio(page)).rms).toBeLessThan(0.00001)
})
