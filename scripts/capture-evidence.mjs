import { chromium } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import init, { TrailEngine } from '../public/wasm/pioneer_trail_web_engine.js'

const baseURL = process.env.TRAIL_URL ?? 'http://127.0.0.1:4173'
const output = 'docs/evidence/visual-review'
await mkdir(output, { recursive: true })
const wasmReady = init({
  module_or_path: await readFile('public/wasm/pioneer_trail_web_engine_bg.wasm'),
})

async function riverFixture() {
  await wasmReady
  for (let seed = 11; seed < 50; seed++) {
    const engine = new TrailEngine(String(seed))
    const apply = (command) => JSON.parse(engine.apply(JSON.stringify(command)))
    const view = () => JSON.parse(engine.view())
    apply({
      Configure: {
        trail_id: 'oregon',
        era_id: '1848',
        occupation_id: 'banker',
        departure_month: 3,
        party: ['Ada', 'James', 'Ruth', 'Thomas'],
      },
    })
    for (const [item_id, quantity] of [
      ['oxen', 3],
      ['food', 1800],
      ['clothing', 4],
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
      if (status === 'AwaitingRiver' && !current.pending_event)
        return JSON.stringify({
          version: 2,
          campaign: engine.save(),
          spatial: {
            regionId: current.current_node?.id ?? 'river',
            terrain: current.terrain,
            regionIndex: 0,
            wagon: { x: 0, z: 80, yaw: 0, speed: 0 },
            player: { x: -3, z: 80, yaw: 0, pitch: 0 },
            mode: 'riding',
            frontierZ: 80,
            travelRemainder: 0,
            activity: null,
          },
          savedAt: new Date().toISOString(),
        })
      if (current.pending_event)
        apply({
          Respond: {
            event_id: current.pending_event.id,
            choice_id: current.pending_event.choices.find((choice) => choice.available).id,
          },
        })
      else if (status === 'AwaitingRiver')
        apply({
          CrossRiver: { method: current.river?.ferry_cost_cents !== null ? 'Ferry' : 'Caulk' },
        })
      else if (status === 'AwaitingFork')
        apply({
          ChooseRoute: {
            route_id: current.routes.find(
              (route) => route.available !== false && route.id !== 'columbia',
            ).id,
          },
        })
      else apply(status === 'AtLandmark' ? 'Continue' : 'TravelDay')
    }
  }
  throw new Error('Could not generate a river evidence fixture')
}

async function start(page) {
  await page.goto('/?evidence=1&seed=11')
  await page.getByRole('heading', { name: 'Begin a journey', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Take the trail' }).click()
  await page.waitForFunction(() => window.__trail?.snapshot().paused === false)
}

async function restore(page, raw) {
  await page.goto('about:blank')
  await page.addInitScript(({ raw }) => localStorage.setItem('pioneer-trail:world:v2', raw), {
    raw,
  })
  await page.goto('/?evidence=1')
  await page.waitForFunction(() => Boolean(window.__trail))
  const resume = page.getByRole('button', { name: 'Resume journey' })
  if (await resume.isVisible()) await resume.click()
  await page.waitForFunction(() => !window.__trail.snapshot().paused)
}

// main predates the test-only forceNight hook, so a comparable night-before image is not reproducible.
const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } })
const page = await context.newPage()
page.setDefaultTimeout(30_000)
try {
  await page.goto('/?evidence=1&seed=11')
  await page.getByRole('heading', { name: 'Begin a journey', exact: true }).waitFor()
  await page.screenshot({ path: `${output}/onboarding-after.png` })
  await page.getByRole('button', { name: 'Take the trail' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${output}/onboarding-after-cta.png` })
  await start(page)
  await page.screenshot({ path: `${output}/day-after.png` })
  await page.evaluate(() => window.__trail.forceNight())
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${output}/night-after.png` })
  await restore(page, await riverFixture())
  await page.keyboard.down('w')
  await page.waitForTimeout(800)
  await page.keyboard.up('w')
  await page.keyboard.down('Space')
  await page.waitForTimeout(400)
  await page.keyboard.up('Space')
  await page.getByRole('button', { name: /Inspect the crossing/ }).waitFor()
  await page.screenshot({ path: `${output}/crossing-prompt-after.png` })
  await page.keyboard.press('e')
  await page.getByRole('heading', { name: 'River crossing', exact: true }).waitFor()
  await page.screenshot({ path: `${output}/crossing-overlay-after.png` })
} finally {
  await context.close()
  await browser.close()
}
