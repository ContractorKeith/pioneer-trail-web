import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const base = process.env.TRAIL_URL ?? 'http://localhost:4173'
const browser = await chromium.launch({
  headless: false,
  args: process.platform === 'linux' ? ['--ozone-platform=x11'] : [],
})
const result = { environment: { base, width: 1280, height: 720 }, errors: [] }
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (error) => result.errors.push(String(error)))
const read = () =>
  page.evaluate(() => {
    const s = window.__trail.snapshot()
    return {
      mode: s.mode,
      paused: s.paused,
      pos: s.position,
      wagon: s.wagon,
      day: s.view.day,
      miles: s.view.miles,
      status: s.view.status,
      food: s.view.inventory.food,
      interaction: s.interaction,
      activity: s.activity,
    }
  })
const hold = async (key, ms) => {
  await page.keyboard.down(key)
  await page.waitForTimeout(ms)
  await page.keyboard.up(key)
}
await mkdir('docs/evidence/m1', { recursive: true })
try {
  await page.goto(`${base}/?evidence=1&seed=11`)
  await page.getByRole('heading', { name: 'Begin a journey', exact: true }).waitFor()
  await page.getByRole('radio', { name: /^Moderate/ }).click()
  await page.getByRole('button', { name: 'Take the trail' }).click()
  await page.waitForTimeout(300)
  result.start = await read()
  await page.screenshot({ path: 'docs/evidence/m1/seat.png' })
  await page.keyboard.press('e')
  await page.waitForTimeout(100)
  result.dismount = await read()
  assert.equal(result.dismount.mode, 'walking')
  await hold('d', 1300)
  result.walk = await read()
  assert.ok(result.walk.pos.x < result.dismount.pos.x - 2)
  await page.keyboard.press('e')
  await page.waitForTimeout(200)
  await page.getByRole('heading', { name: 'Camp', exact: true }).waitFor()
  result.camp = await page.locator('dialog').innerText()
  await page.getByRole('button', { name: 'Close panel' }).click()
  await hold('a', 1300)
  await page.keyboard.press('e')
  await page.waitForTimeout(200)
  result.board = await read()
  assert.equal(result.board.mode, 'riding')
  await hold('w', 9000)
  await hold('Space', 800)
  result.drive = await read()
  assert.ok(result.drive.wagon.z > 50)
  assert.ok(result.drive.miles > 0)
  await page.screenshot({ path: 'docs/evidence/m1/drive.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  result.beforeReload = await read()
  assert.equal(result.beforeReload.paused, true)
  await page.reload()
  await page.getByRole('button', { name: 'Resume journey' }).waitFor()
  result.resume = await read()
  assert.equal(result.resume.miles, result.beforeReload.miles)
  assert.equal(result.resume.food, result.beforeReload.food)
  assert.equal(result.resume.wagon.z, result.beforeReload.wagon.z)
  assert.equal(result.resume.paused, true)
  assert.deepEqual(result.errors, [])
  result.pass = true
} catch (error) {
  result.failure = String(error)
  await page.screenshot({ path: 'docs/evidence/m1/failure.png' })
  throw error
} finally {
  await writeFile('docs/evidence/m1/smoke.json', JSON.stringify(result, null, 2))
  await browser.close()
}
console.log(JSON.stringify(result, null, 2))
