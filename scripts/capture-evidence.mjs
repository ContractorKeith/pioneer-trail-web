import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fixture, hold, restore, resume, start } from '../tests/world.helpers.ts'

const baseURL = process.env.TRAIL_URL ?? 'http://127.0.0.1:4173'
const mode = process.env.CAPTURE_MODE ?? 'after'
const output = 'docs/evidence/visual-review'
await mkdir(output, { recursive: true })

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } })
const page = await context.newPage()
page.setDefaultTimeout(30_000)

try {
  if (mode === 'night') {
    if (process.env.NIGHT_BUILD === 'before') {
      await page.goto('/?evidence=1&seed=11')
      await page.getByRole('button', { name: 'Choose provisions' }).click()
      await page.getByRole('radio', { name: /^Safe/ }).click()
      await page.getByRole('button', { name: 'Load this plan' }).click()
      await page.getByRole('button', { name: 'Take the trail' }).click()
    } else await start(page)
    await page.evaluate(() => window.__trail.forceNight())
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${output}/night-${process.env.NIGHT_BUILD}.png` })
  } else {
    await page.goto('/?evidence=1&seed=11')
    await page.screenshot({ path: `${output}/onboarding-after.png` })
    await page.getByRole('button', { name: 'Take the trail' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${output}/onboarding-after-cta.png` })

    await start(page)
    await page.evaluate(() => window.__trail.forceNight())
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${output}/night-after.png` })

    const outer = JSON.parse((await fixture('river')).raw)
    outer.spatial.wagon = { x: 0, z: 80, yaw: 0, speed: 0 }
    outer.spatial.player = { x: -3, z: 80, yaw: 0, pitch: 0 }
    outer.spatial.frontierZ = 80
    await restore(page, JSON.stringify(outer))
    await resume(page)
    await hold(page, 'w', 800)
    await hold(page, 'Space', 400)
    await page.getByRole('button', { name: /Inspect the crossing/ }).waitFor()
    await page.screenshot({ path: `${output}/crossing-prompt-after.png` })
    await page.keyboard.press('e')
    await page.getByRole('heading', { name: 'River crossing', exact: true }).waitFor()
    await page.screenshot({ path: `${output}/crossing-overlay-after.png` })
  }
} finally {
  await context.close()
  await browser.close()
}
