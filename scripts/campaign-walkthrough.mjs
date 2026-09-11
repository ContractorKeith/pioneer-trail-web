import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { platform, release, cpus } from 'node:os'
import { pathToFileURL } from 'node:url'
import { buildIdentity } from './measure-ride.mjs'
import { trackServedBuild } from './served-build.mjs'
import { loadWorldTools } from './load-world-tools.mjs'

const phase = (status) => (typeof status === 'string' ? status : Object.keys(status)[0])

export function chooseRoute(view) {
  return view.routes.find((route) => route.available !== false && route.id !== 'columbia')
}

export function purchaseQuantity(view, id, target, reserve = 5000) {
  const item = view.items.find((candidate) => candidate.id === id)
  if (!view.can_shop || !item || item.price_cents === null) return 0
  return Math.max(
    0,
    Math.floor(
      Math.min(
        target - (view.inventory[id] ?? 0),
        item.limit - (view.inventory[id] ?? 0),
        item.weight_lbs
          ? ((view.capacity_lbs ?? 2400) - view.weight_lbs) / item.weight_lbs
          : Infinity,
        item.price_cents ? Math.max(0, view.cash_cents - reserve) / item.price_cents : Infinity,
        100,
      ),
    ),
  )
}

// The runtime omits paused frames: this aggregate is not proof of a continuous two-minute ride.
export function movingPerformance(frames) {
  let elapsed = 0
  const selected = frames.filter((frame) => {
    if (frame.mode !== 'riding' || frame.speed <= 0.3) return false
    elapsed += frame.ms
    return elapsed > 10000 && elapsed <= 130000
  })
  const sorted = selected.map((frame) => frame.ms).sort((a, b) => a - b)
  return {
    selected,
    classification:
      'Aggregate moving frames; separate continuous hardware ride verification required',
    acceptancePass: false,
    warmupMovingSeconds: 10,
    durationSeconds: selected.reduce((sum, frame) => sum + frame.ms, 0) / 1000,
    frames: sorted.length,
    medianFps: sorted.length ? 1000 / sorted[Math.floor(sorted.length * 0.5)] : null,
    p95FrameMs: sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : null,
    regions: [...new Set(selected.map((frame) => frame.region))],
  }
}

export function sceneGrowth(samples) {
  const groups = new Map()
  for (const sample of samples) {
    const key = `${sample.terrain}:${sample.river}`
    const regions = groups.get(key) ?? new Map()
    regions.set(sample.region, sample)
    groups.set(key, regions)
  }
  const comparisons = []
  for (const [kind, regions] of groups) {
    const rows = [...regions.values()]
    if (rows.length < 6) continue
    const first = rows.slice(0, 3),
      last = rows.slice(-3)
    comparisons.push({
      kind,
      regions: rows.length,
      // Compare separate regions of the same terrain. One unusually complex scene is not a leak.
      geometries:
        Math.min(...last.map((row) => row.geometries)) -
        Math.max(...first.map((row) => row.geometries)),
      textures:
        Math.min(...last.map((row) => row.textures)) -
        Math.max(...first.map((row) => row.textures)),
    })
  }
  return {
    comparisons,
    suspicious: comparisons.filter((row) => row.geometries > 2 || row.textures > 1),
    note: 'Renderer resource trend screening; raw heap/DOM/listener samples are retained for independent leak review.',
  }
}

export async function walkPlanned(page, target, report) {
  const { state, world, hold } = await import('../tests/world.helpers.ts')
  const before = await state(page),
    visible = await world(page)
  assert.equal(before.mode, 'walking')
  const { createWorld, Scene, planWalkingRoute } = await loadWorldTools()
  const terrain = await page.evaluate(() => JSON.parse(window.__trail.save()).spatial.terrain)
  const ground = createWorld(new Scene(), {
    seed: Number(BigInt(before.view.seed) % 2147483647n) + before.regionIndex,
    terrain,
    river: !!visible.river,
    quality: 'low',
  })
  let route
  try {
    route = planWalkingRoute(
      ground,
      before.wagon,
      {
        x: before.position.x,
        z: before.position.z,
        yaw: before.heading,
        speed: 0,
      },
      target,
    )
  } finally {
    ground.dispose()
  }
  report.walkingRoutes ??= []
  report.walkingRoutes.push({ region: before.regionIndex, start: before.position, target, route })
  for (const point of route) {
    let reached = false
    for (let tries = 0; tries < 100; tries++) {
      const s = await state(page),
        dx = point.x - s.position.x,
        dz = point.z - s.position.z
      assert.equal(s.paused, false, 'Walking route must stay in live play')
      assert.equal(s.regionIndex, before.regionIndex)
      assert.equal(s.collisionCount, before.collisionCount, 'Planned walking route collided')
      if (Math.hypot(dx, dz) < 0.14) {
        reached = true
        break
      }
      const forward = Math.sin(s.heading) * dx + Math.cos(s.heading) * dz
      const right = -Math.cos(s.heading) * dx + Math.sin(s.heading) * dz
      const key =
        Math.abs(forward) > Math.abs(right) ? (forward > 0 ? 'w' : 's') : right > 0 ? 'd' : 'a'
      await hold(
        page,
        key,
        Math.min(80, Math.max(16, (Math.max(Math.abs(forward), Math.abs(right)) / 3.2) * 1000)),
      )
    }
    assert.ok(reached, `Walking route did not reach ${JSON.stringify(point)}`)
  }
}

/** Finish the far-bank approach with actual steering; a full progress bar is not arrival. */
export async function finishCrossing(page, report) {
  const { state, world, hold } = await import('../tests/world.helpers.ts')
  const arrival = await state(page)
  assert.equal(arrival.activity?.kind, 'crossing')
  // Reconstructing the CPU scene takes time; stop through real input before planning its exit.
  await hold(page, 'Space', 800)
  const before = await state(page)
  if (!before.activity || before.regionIndex !== arrival.regionIndex) return
  const river = (await world(page)).river
  assert.ok(river)
  const { createWorld, Scene, CrossingExitDriver } = await loadWorldTools()
  const terrain = await page.evaluate(() => JSON.parse(window.__trail.save()).spatial.terrain)
  const ground = createWorld(new Scene(), {
    seed: Number(BigInt(before.view.seed) % 2147483647n) + before.regionIndex,
    terrain,
    river: true,
    quality: 'low',
  })
  const pace = before.view.pace === 'Grueling' ? 1.3 : before.view.pace === 'Strenuous' ? 1.15 : 1
  const driver = new CrossingExitDriver(ground, river, pace)
  const record = { region: before.regionIndex, start: before.wagon, inputs: [] }
  report.crossingExits ??= []
  report.crossingExits.push(record)
  const keys = ['w', 's', 'a', 'd', 'Space']
  try {
    for (let step = 0; step < 240; step++) {
      const s = await state(page)
      if (!s.activity || s.regionIndex !== before.regionIndex) {
        record.finish = s.wagon
        record.day = s.view.day
        return
      }
      assert.equal(s.paused, false, 'Crossing exit must remain in live play')
      assert.equal(s.activity.kind, 'crossing')
      const input = driver.next(s.wagon)
      if (!input) {
        await page.waitForTimeout(100)
        continue
      }
      record.inputs.push({ pose: s.wagon, input })
      const pressed = [
        ...(input.forward ? [input.forward > 0 ? 'w' : 's'] : []),
        ...(input.turn ? [input.turn > 0 ? 'a' : 'd'] : []),
        ...(input.brake ? ['Space'] : []),
      ]
      for (const key of pressed) await page.keyboard.down(key)
      await page.waitForTimeout(input.seconds * 1000)
      for (const key of pressed) await page.keyboard.up(key)
    }
    assert.fail(`Crossing exit stalled: ${JSON.stringify((await state(page)).wagon)}`)
  } finally {
    for (const key of keys) await page.keyboard.up(key).catch(() => {})
    driver.dispose()
    ground.dispose()
  }
}

export async function main() {
  const { chromium } = await import('playwright')
  const { driveTo, hold, resume, state, world } = await import('../tests/world.helpers.ts')
  const baseURL = process.env.TRAIL_URL ?? 'http://localhost:4173'
  const output = process.env.TRAIL_EVIDENCE_DIR ?? 'docs/evidence/campaign'
  const limitMinutes = Number(process.env.TRAIL_LIMIT_MINUTES ?? 45)
  assert.ok(
    Number.isFinite(limitMinutes) && limitMinutes >= 10,
    'TRAIL_LIMIT_MINUTES must be at least 10',
  )
  await mkdir(output, { recursive: true })
  await mkdir('.artifacts/videos', { recursive: true })
  const headlessGpu = process.env.TRAIL_HEADLESS_GPU === '1'
  const browserLaunch = {
    executablePath: process.env.TRAIL_CHROMIUM,
    headless: headlessGpu,
    args: [
      ...(process.platform === 'linux' ? ['--ozone-platform=x11'] : []),
      ...(headlessGpu ? ['--enable-gpu'] : []),
    ],
  }
  const build = await buildIdentity()
  const browser = await chromium.launch(browserLaunch)
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '.artifacts/videos', size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  const served = trackServedBuild(page, baseURL, build)
  page.setDefaultTimeout(10000)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  const report = {
    started: new Date().toISOString(),
    baseURL,
    browserLaunch,
    build,
    servedBuild: served.report,
    source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    seed: '11',
    trail: 'oregon',
    era: '1848',
    difficulty: 'Normal',
    quality: 'low',
    environment: {
      os: `${platform()} ${release()}`,
      cpu: cpus()[0]?.model,
      browser: browser.version(),
      display: process.env.DISPLAY ?? null,
      sessionType: process.env.XDG_SESSION_TYPE ?? null,
    },
    events: [],
    samples: [],
    errors: [],
    telemetryErrors: [],
    notices: [],
    automatedChecksPass: false,
    independentMemoryReview: 'pending',
    pass: false,
  }
  // Camp, trader and seat approaches all use the same physical obstacle-aware walking driver.
  const walk = (page, x, z) => walkPlanned(page, { x, z }, report)
  page.on('pageerror', (error) => report.errors.push(String(error)))
  page.on('crash', () => report.errors.push('Page crashed'))
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push(message.text())
  })
  // The only browser storage mutation in this player. Campaigns start through the visible UI.
  await page.addInitScript(() =>
    localStorage.setItem(
      'pioneer-trail:settings:v2',
      JSON.stringify({
        quality: 'low',
        muted: true,
        reducedMotion: true,
        lookMode: 'drag',
      }),
    ),
  )
  let began = Date.now(),
    lastRegion = -1,
    lastSample = 0,
    stuckSeconds = 0
  let lastNotice = '',
    lastCampDay = 0,
    lastFrames = [],
    unpausedSeconds = 0
  const provisionedRegions = new Set()
  let checkpointSequence = 0
  const flush = () => writeFile(`${output}/walkthrough.json`, JSON.stringify(report, null, 2))
  const checkpoint = async (name) => {
    const raw = await page.evaluate(() => window.__trail.save())
    const path = `${output}/${name}-${++checkpointSequence}.json`
    await writeFile(path, raw, { flag: 'wx' })
    return {
      path,
      sha256: createHash('sha256').update(raw).digest('hex'),
      at: new Date().toISOString(),
    }
  }
  const observe = async (label) => {
    const s = await state(page),
      visibleWorld = await world(page)
    const spatialTerrain = await page.evaluate(
      () => JSON.parse(window.__trail.save()).spatial.terrain,
    )
    const entry = {
      seconds: (Date.now() - began) / 1000,
      label,
      status: phase(s.view.status),
      day: s.view.day,
      miles: s.view.miles,
      food: s.view.inventory.food ?? 0,
      cash: s.view.cash_cents,
      health: s.view.party.map((member) => ({
        name: member.name,
        alive: member.alive,
        health: member.health,
      })),
      region: s.regionIndex,
      terrain: spatialTerrain,
      campaignTerrain: s.view.terrain,
      river: !!visibleWorld.river,
      mode: s.mode,
      paused: s.paused,
      position: s.wagon,
      geometries: s.geometries,
      textures: s.textures,
      drawCalls: s.drawCalls,
    }
    if (label === 'Region entered')
      entry.checkpoint = await checkpoint(`region-${s.regionIndex}-save`)
    try {
      // Retained-memory observations accompany region entries; this is outside the ride FPS gate.
      if (label === 'Region entered') await cdp.send('HeapProfiler.collectGarbage')
      const [metrics, dom] = await Promise.all([
        cdp.send('Performance.getMetrics'),
        cdp.send('Memory.getDOMCounters'),
      ])
      entry.memory = {
        afterCollection: label === 'Region entered',
        ...dom,
        ...Object.fromEntries(
          metrics.metrics
            .filter((m) => ['JSHeapUsedSize', 'JSHeapTotalSize'].includes(m.name))
            .map((m) => [m.name, m.value]),
        ),
      }
    } catch (error) {
      report.telemetryErrors.push(String(error))
    }
    report.samples.push(entry)
    if (label !== 'Periodic observation') report.events.push(entry)
    console.log(JSON.stringify(entry))
    const notice = (await page.locator('.notice').allTextContents()).join(' ')
    if (notice && notice !== lastNotice) {
      report.notices.push({ seconds: entry.seconds, text: notice })
      lastNotice = notice
    }
    const appError = (await page.locator('.notice.is-error').allTextContents()).join(' ')
    if (appError) report.errors.push(appError)
    const timing = await page.evaluate(() => {
      const frames = window.__trail.frameSamples()
      // Keep observation bookkeeping outside the game. Frame objects are read, never changed.
      const tally = window.__walkthroughTiming ?? { last: null, ms: 0 }
      const index = tally.last ? frames.indexOf(tally.last) : -1
      if (tally.last && index < 0) throw new Error('Frame buffer rolled over between observations')
      tally.ms += frames.slice(index + 1).reduce((sum, frame) => sum + frame.ms, 0)
      tally.last = frames.at(-1) ?? null
      window.__walkthroughTiming = tally
      return { frames, seconds: tally.ms / 1000 }
    })
    lastFrames = timing.frames
    unpausedSeconds = timing.seconds
    const performance = movingPerformance(lastFrames)
    const { selected, ...summary } = performance
    report.performance = summary
    await writeFile(`${output}/ride-frames.json`, JSON.stringify(selected))
    await flush()
  }
  const close = async () => {
    const button = page.getByRole('button', { name: 'Close panel', exact: true })
    if (await button.isVisible()) await button.click()
  }
  const play = async () => {
    await close()
    if ((await state(page)).paused) await resume(page)
  }
  const stopAndDismount = async () => {
    // Relinquish travel throttle before braking or handing control to the walker.
    for (const key of ['w', 'a', 's', 'd', 'Space']) await page.keyboard.up(key)
    await play()
    if ((await state(page)).mode === 'riding') {
      await hold(page, 'Space', 1000)
      assert.ok(Math.abs((await state(page)).speed) <= 0.2, 'Wagon must stop before dismount')
      await page.keyboard.press('e')
      assert.equal((await state(page)).mode, 'walking', 'Dismount must change mode')
    }
  }
  const board = async () => {
    await play()
    const s = await state(page)
    if (s.mode === 'riding') return
    // Interactions/transitions can relocate both bodies: observe the current seat, never assume old coordinates.
    await walk(page, s.wagon.x - Math.cos(s.wagon.yaw) * 3, s.wagon.z + Math.sin(s.wagon.yaw) * 3)
    await page.keyboard.press('e')
    assert.equal((await state(page)).mode, 'riding', 'Return to the actual driver seat')
  }
  const camp = async () => {
    await stopAndDismount()
    const fire = (await world(page)).locations.find((location) => location.id === 'campfire')
    assert.ok(fire, 'Region exposes an actual campfire')
    await walk(page, fire.position[0], fire.position[2] - 1.5)
    await page.keyboard.press('c')
    await page.getByRole('heading', { name: 'Camp', exact: true }).waitFor()
  }
  const tendParty = async () => {
    await play()
    await page.keyboard.press('p')
    await page.getByRole('heading', { name: 'Your party', exact: true }).waitFor()
    for (let attempts = 0; attempts < 12; attempts++) {
      const before = (await state(page)).view
      if (!(before.inventory.medicine > 0)) break
      const treatment = page
        .locator('.party-list button')
        .filter({ hasText: /^Treat / })
        .first()
      if (!(await treatment.isVisible())) break
      await treatment.click()
      const after = (await state(page)).view
      assert.ok(
        after.inventory.medicine < before.inventory.medicine ||
          JSON.stringify(after.party) !== JSON.stringify(before.party),
        'Treat action must consume medicine or change an ailment',
      )
    }
    await close()
  }
  const shop = async () => {
    await stopAndDismount()
    // The wagon and its team occupy the center: go behind it on the proven trader approach.
    await walk(page, -3, 14)
    await walk(page, 3, 14)
    const trader = (await world(page)).locations.find((location) => location.id === 'trader')
    assert.ok(trader)
    await walk(page, 3, trader.position[2] - 1.4)
    await walk(page, trader.position[0] - 2.4, trader.position[2] - 1.4)
    await page.keyboard.press('e')
    await page.getByRole('heading', { name: 'Trade', exact: true }).waitFor()
    for (const [id, target] of [
      ['oxen', 3],
      ['medicine', 4],
      ['wheel', 1],
      ['axle', 1],
      ['tongue', 1],
      ['clothing', 7],
      ['food', 1600],
    ]) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const before = (await state(page)).view
        let quantity = purchaseQuantity(
          before,
          id,
          target,
          id === 'food' && before.inventory.food < 150 ? 1000 : 5000,
        )
        if (!quantity) break
        const item = before.items.find((candidate) => candidate.id === id)
        const row = page
          .locator('.trade-list li')
          .filter({ has: page.getByText(item.name, { exact: true }) })
        let bought = false
        // Stock is not exposed in the snapshot. Rejected stock quotes are recorded, then try a smaller visible order.
        while (quantity >= 1) {
          await page.getByLabel('Quantity', { exact: true }).fill(String(quantity))
          await row.getByRole('button', { name: 'Buy', exact: true }).click()
          const after = (await state(page)).view
          if ((after.inventory[id] ?? 0) === (before.inventory[id] ?? 0) + quantity) {
            assert.ok(after.cash_cents < before.cash_cents, 'Purchased supplies must cost money')
            bought = true
            break
          }
          report.events.push({
            seconds: (Date.now() - began) / 1000,
            label: 'Shop rejected order',
            id,
            quantity,
            notice: await page.locator('.notice').textContent(),
          })
          quantity = Math.floor(quantity / 2)
        }
        if (!bought) break
      }
    }
    await observe('Traded through visible shop')
    await play()
    // Retrace the clear approach before heading south; a diagonal shortcut can meet a rock.
    await walk(page, 3, trader.position[2] - 1.4)
    await walk(page, 3, 14)
    await walk(page, -3, 14)
  }
  const provisions = async () => {
    let view = (await state(page)).view
    if (!view.can_camp || view.pending_event) return
    if (
      view.party.some((member) => member.alive && member.ailments.length) &&
      view.inventory.medicine > 0
    )
      await tendParty()
    await camp()
    await page.getByRole('combobox', { name: 'Pace', exact: true }).selectOption('Steady')
    await page.getByRole('combobox', { name: 'Rations', exact: true }).selectOption('Filling')
    for (let attempt = 0; attempt < 12; attempt++) {
      view = (await state(page)).view
      if (view.pending_event || phase(view.status) === 'Failed' || view.inventory.food >= 180) break
      const before = view.inventory.food ?? 0
      await page.getByRole('button', { name: 'Forage', exact: true }).click()
      const after = (await state(page)).view
      assert.equal(after.day, view.day + 1, 'Foraging charges one actual day')
      if ((after.inventory.food ?? 0) <= before) {
        await observe('Foraging did not cover meals; stopping the forage loop')
        break
      }
    }
    view = (await state(page)).view
    if (
      view.can_camp &&
      view.inventory.food > view.daily_food_lbs * 5 &&
      (view.day - lastCampDay >= 18 ||
        view.party.some((member) => member.alive && member.health < 65))
    ) {
      const beforeDay = view.day
      await page.getByRole('button', { name: 'Rest three days', exact: true }).click()
      const after = (await state(page)).view
      assert.ok(
        after.day > beforeDay && after.day <= beforeDay + 3,
        'Rest must charge actual days, stopping for mandatory events',
      )
      lastCampDay = after.day
    }
    await observe('Camp supplies and party checked')
  }
  try {
    await page.goto(`/?evidence=1&seed=${report.seed}`)
    await page.getByRole('combobox', { name: 'Route', exact: true }).selectOption(report.trail)
    await page.getByRole('radio', { name: /^Safe/ }).click()
    await page.getByRole('button', { name: 'Take the trail' }).click()
    await served.verify()
    began = Date.now()
    report.environment.client = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      devicePixelRatio,
      width: innerWidth,
      height: innerHeight,
    }))
    report.renderer = await page.evaluate(() => window.__trail.renderer())
    report.renderer.hardwareCandidate = !/swiftshader|llvmpipe|software|lavapipe/i.test(
      report.renderer.renderer,
    )
    await observe('Departed using visible setup/outfitting')
    while (Date.now() - began < limitMinutes * 60000) {
      let s = await state(page)
      if (s.regionIndex !== lastRegion) {
        lastRegion = s.regionIndex
        stuckSeconds = 0
        await observe('Region entered')
        s = await state(page)
      }
      if (Date.now() - lastSample >= 10000) {
        lastSample = Date.now()
        await observe('Periodic observation')
        s = await state(page)
      }
      const view = s.view,
        status = phase(view.status)
      assert.deepEqual(report.errors, [], 'Application errors must fail the walkthrough')
      if (status === 'Arrived' || status === 'Failed') {
        await observe('Ending reached')
        await page.screenshot({ path: `${output}/ending.png` })
        report.ending = status
        break
      }
      if (view.pending_event) {
        const event = view.pending_event
        const choice = event.choices.find((candidate) => candidate.available)
        assert.ok(choice, `No available visible choice for ${event.id}`)
        await page.getByRole('heading', { name: 'Trail moment', exact: true }).waitFor()
        await page.getByRole('button', { name: choice.label, exact: true }).click()
        assert.notEqual(
          (await state(page)).view.pending_event?.id,
          event.id,
          `Event ${event.id} must resolve`,
        )
        await observe(`Encounter: ${event.text} → ${choice.label}`)
        if (
          !(await state(page)).view.pending_event &&
          (await page.getByRole('heading', { name: 'Trail moment', exact: true }).isVisible())
        )
          await close()
        continue
      }
      if (status === 'AwaitingFork') {
        const route = chooseRoute(view)
        assert.ok(route, 'An available overland route must exist')
        await page
          .locator('.route-list button')
          .filter({ has: page.getByText(route.label, { exact: true }) })
          .click()
        assert.notEqual(
          phase((await state(page)).view.status),
          'AwaitingFork',
          `Route ${route.label} must commit`,
        )
        await observe(`Route chosen: ${route.label}`)
        await close()
        continue
      }
      if (status === 'AtLandmark') {
        if (view.can_shop) await shop()
        await provisions()
        const after = (await state(page)).view
        if (after.pending_event || phase(after.status) !== 'AtLandmark') continue
        await page.getByRole('button', { name: 'Continue journey', exact: true }).click()
        assert.notEqual(
          phase((await state(page)).view.status),
          'AtLandmark',
          'Continue must leave the landmark',
        )
        await board()
        continue
      }
      if (status === 'AwaitingRiver' && !s.activity) {
        await board()
        const crossingWorld = await world(page)
        const river = crossingWorld.river
        assert.ok(river)
        // Follow the visible road as it curves toward the bank; x=0 can cross valid scenery.
        const roadX = (z) =>
          crossingWorld.trail.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a)).x
        await driveTo(page, roadX(river.startZ - 24), river.startZ - 24)
        await hold(page, 'Space', 1000)
        assert.ok(Math.abs((await state(page)).speed) <= 0.2, 'Wagon must stop at the riverbank')
        await page.keyboard.press('e')
        await page.getByRole('heading', { name: 'River crossing', exact: true }).waitFor()
        const beforeDay = (await state(page)).view.day
        const ferry = page.getByRole('button', { name: /^Ferry/ })
        if (await ferry.isEnabled()) {
          await ferry.click()
          await close()
        } else {
          await page.getByRole('button', { name: /^Caulk and float/ }).click()
          assert.equal(
            (await state(page)).activity?.kind,
            'crossing',
            'Caulk must launch controlled crossing',
          )
          await driveTo(page, roadX(river.startZ - 6), river.startZ - 6)
          await driveTo(page, -8, river.startZ + 3)
          // Give the exit planner control before the front of the team reaches bank scenery.
          await driveTo(page, -9, river.endZ - 6)
          if ((await state(page)).activity) await finishCrossing(page, report)
        }
        const after = await state(page)
        assert.equal(after.activity, null, 'Crossing activity must finish')
        assert.notEqual(
          phase(after.view.status),
          'AwaitingRiver',
          'Crossing must reach the far bank',
        )
        assert.equal(after.view.day, beforeDay + 1, 'Crossing charges exactly one day')
        await observe('River crossing completed')
        await board()
        continue
      }
      if (s.paused) {
        await play()
        continue
      }
      if (s.mode === 'walking') {
        await board()
        continue
      }
      // Every chunk begins beside camp, permitting survival decisions without teleporting back to it.
      if (
        s.wagon.z < 24 &&
        !provisionedRegions.has(s.regionIndex) &&
        view.can_camp &&
        (view.inventory.food < 150 ||
          view.day - lastCampDay >= 18 ||
          view.party.some((member) => member.alive && member.health < 60))
      ) {
        provisionedRegions.add(s.regionIndex)
        await provisions()
        if (!(await state(page)).view.pending_event) await board()
        continue
      }
      const trail = (await world(page)).trail
      const target = trail.reduce((a, b) =>
        Math.abs(b.z - (s.wagon.z + 14)) < Math.abs(a.z - (s.wagon.z + 14)) ? b : a,
      )
      const desired = Math.atan2(target.x - s.wagon.x, Math.max(8, target.z - s.wagon.z))
      const delta = Math.atan2(Math.sin(desired - s.wagon.yaw), Math.cos(desired - s.wagon.yaw))
      const inputStart = Date.now()
      try {
        await page.keyboard.down('w')
        if (Math.abs(delta) > 0.04) await page.keyboard.down(delta > 0 ? 'a' : 'd')
        await page.waitForTimeout(200)
      } finally {
        await page.keyboard.up('a')
        await page.keyboard.up('d')
      }
      const after = await state(page)
      if (
        after.regionIndex === s.regionIndex &&
        !after.paused &&
        phase(after.view.status) === 'Travelling' &&
        Math.hypot(after.wagon.x - s.wagon.x, after.wagon.z - s.wagon.z) < 0.03 &&
        Math.abs(after.speed) < 0.1
      )
        stuckSeconds += (Date.now() - inputStart) / 1000
      else stuckSeconds = 0
      assert.ok(
        stuckSeconds < 8,
        `Controls stuck for ${stuckSeconds}s at ${JSON.stringify(after.wagon)}`,
      )
    }
    assert.equal(
      report.ending,
      'Arrived',
      'Complete successful campaign must be reachable through normal input',
    )
    assert.deepEqual(report.errors, [])
    const resources = sceneGrowth(report.samples)
    report.soak = {
      durationSeconds: (Date.now() - began) / 1000,
      observedUnpausedSeconds: unpausedSeconds,
      regions: new Set(report.samples.map((sample) => sample.region)).size,
      resources,
      automatedChecksPass: false,
      independentMemoryReview: 'pending',
      pass: false,
    }
    assert.ok(
      report.soak.durationSeconds >= 600,
      'A short campaign is not a ten-minute soak; no idle padding is counted',
    )
    assert.ok(
      report.soak.observedUnpausedSeconds >= 600,
      'At least ten minutes of observed unpaused play is required',
    )
    assert.ok(
      report.soak.regions >= 6 && resources.comparisons.length > 0,
      'Repeated comparable regions are required for resource screening',
    )
    assert.deepEqual(
      resources.suspicious,
      [],
      'Continuing renderer resource growth requires investigation',
    )
    assert.deepEqual(report.telemetryErrors, [], 'Memory telemetry must be complete')
    await served.verify()
    report.soak.automatedChecksPass = true
    report.automatedChecksPass = true
    // Geometry counts alone cannot clear heap/DOM/listener leaks. Bind an independent review
    // of this report and its retained-memory samples before marking overall acceptance passed.
  } catch (error) {
    report.failure = String(error)
    try {
      report.failureCheckpoint = await checkpoint('failure-save')
      await page.screenshot({ path: `${output}/failure.png` })
      report.lastState = await state(page)
    } catch {}
    throw error
  } finally {
    report.finished = new Date().toISOString()
    report.durationSeconds = (Date.now() - began) / 1000
    report.resourceScreening = sceneGrowth(report.samples)
    await served.verify().catch((error) => {
      report.errors.push(String(error))
      report.automatedChecksPass = false
      report.pass = false
    })
    served.detach()
    await page.keyboard.up('w').catch(() => {})
    await page.keyboard.up('a').catch(() => {})
    await page.keyboard.up('d').catch(() => {})
    try {
      await context.close()
      report.video = await page.video()?.path()
    } catch (error) {
      report.errors.push(`Closing recording: ${String(error)}`)
      report.pass = false
    }
    try {
      await browser.close()
    } catch (error) {
      report.errors.push(`Closing browser: ${String(error)}`)
      report.pass = false
    }
    await flush()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
