import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { parseArgs, promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { buildIdentity } from './measure-ride.mjs'
import { trackServedBuild } from './served-build.mjs'
import { walkPlanned } from './campaign-walkthrough.mjs'
import {
  aimAt,
  driveTo,
  fixture,
  hold,
  restore,
  resume,
  start,
  state,
  walkTo,
  world,
} from '../tests/world.helpers.ts'

const run = promisify(execFile)
const hash = (body) => createHash('sha256').update(body).digest('hex')
const caseNames = ['seed14-bank-wildlife', 'hunt-retrieval', 'main-bank-fishing', 'rain-shelter']

export function captureOptions(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: { case: { type: 'string', multiple: true }, output: { type: 'string' } },
  })
  const selected = [...new Set(values.case ?? caseNames)]
  assert.ok(
    selected.length > 0 && selected.every((name) => caseNames.includes(name)),
    'Unknown capture case',
  )
  const output =
    values.output ??
    (values.case
      ? `docs/evidence/activity-review-${selected.join('-')}`
      : 'docs/evidence/activity-review')
  return { selected, output }
}

export async function main() {
  const baseURL = process.env.TRAIL_URL ?? 'http://localhost:4173'
  const { selected, output } = captureOptions()
  const videoDirectory = '.artifacts/videos'
  const artifactPrefix = `${path.basename(output)}-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const headless = process.env.TRAIL_HEADLESS_GPU === '1'
  const browserLaunch = {
    executablePath: process.env.TRAIL_CHROMIUM ?? '/usr/bin/chromium',
    headless,
    args: ['--ozone-platform=x11', ...(headless ? ['--enable-gpu'] : [])],
  }
  const report = {
    started: new Date().toISOString(),
    baseURL,
    browserLaunch,
    selectedCases: selected,
    output,
    environment: {
      display: process.env.DISPLAY ?? null,
      sessionType: process.env.XDG_SESSION_TYPE ?? null,
    },
    cases: [],
    errors: [],
    captureRunComplete: false,
    note: 'Production first-person controls and factual activity outcomes. Checkpoint setup is disclosed per case. Completion means the capture procedure ran; independent image/video review must supply the visual verdict.',
  }
  let browser, build
  await mkdir(output, { recursive: true })
  await mkdir(videoDirectory, { recursive: true })
  const flush = () => writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))

  async function observe(page) {
    const s = await state(page)
    return {
      observedAt: new Date().toISOString(),
      mode: s.mode,
      paused: s.paused,
      position: s.position,
      heading: s.heading,
      wagon: s.wagon,
      speed: s.speed,
      seed: s.view.seed,
      region: s.regionId,
      regionIndex: s.regionIndex,
      sceneWeather: s.sceneWeather,
      campaignWeather: s.view.weather,
      day: s.view.day,
      food: s.view.inventory.food,
      ammunition: s.view.ammunition_available,
      activity: s.activity,
      ledger: s.view.activity,
      spatial: await page.evaluate(() => JSON.parse(window.__trail.save()).spatial),
      world: await world(page),
    }
  }
  async function waitState(page, predicate, label, timeout = 10000) {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const snapshot = await state(page)
      if (predicate(snapshot)) return snapshot
      assert.equal(snapshot.paused, false, `Unexpected pause while ${label}`)
      await page.waitForTimeout(100)
    }
    throw new Error(`Timed out while ${label}: ${JSON.stringify(await observe(page))}`)
  }
  async function stoppedDismount(page) {
    await hold(page, 'Space', 800)
    await waitState(page, (s) => Math.abs(s.speed) < 0.05, 'braking')
    await page.keyboard.press('e')
    await waitState(page, (s) => s.mode === 'walking', 'dismounting')
  }
  async function rightBankCorridor(page, z, retreatX) {
    const s = await state(page)
    const x = retreatX ?? s.position.x
    if (retreatX !== undefined) await walkTo(page, x, s.position.z)
    // Go around the wagon's rear before changing sides; preserve the entire train collider.
    await walkTo(page, x, s.wagon.z - 5)
    await walkTo(page, 3, s.wagon.z - 5)
    await walkTo(page, 3, z)
  }
  async function capture(entry, name) {
    await entry.served.verify()
    const imagePath = `${output}/${name}.png`
    await entry.page.screenshot({ path: imagePath })
    entry.record.captures.push({
      name,
      path: imagePath,
      buildSha256: build.distSha256,
      ...(await observe(entry.page)),
    })
  }
  async function sample(entry, label) {
    entry.record.samples.push({ label, ...(await observe(entry.page)) })
  }
  async function runCase(name, setup, prepare, action, quality = 'balanced') {
    if (!selected.includes(name)) return
    const record = { name, setup, quality, captures: [], samples: [], errors: [], complete: false }
    report.cases.push(record)
    let page, served, failure
    const createdAt = Date.now()
    try {
      page = await browser.newPage({
        baseURL,
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        recordVideo: { dir: videoDirectory, size: { width: 1280, height: 720 } },
      })
      // Only settings preferences are written here; isolated campaign saves use restore().
      await page.addInitScript(
        ({ quality, origin }) => {
          if (location.origin !== origin) return
          localStorage.setItem(
            'pioneer-trail:settings:v2',
            JSON.stringify({ quality, lookMode: 'drag', muted: true, reducedMotion: false }),
          )
        },
        { quality, origin: new URL(baseURL).origin },
      )
      served = trackServedBuild(page, baseURL, build)
      record.servedBuild = served.report
      const error = (value) => record.errors.push(String(value))
      page.on('pageerror', error)
      page.on('crash', () => error('Page crashed'))
      page.on('console', (message) => {
        if (message.type() === 'error') error(message.text())
      })
      await prepare(page)
      await served.verify()
      record.buildSha256 = build.distSha256
      record.renderer = await page.evaluate(() => window.__trail.renderer())
      assert.equal(record.renderer.quality, quality)
      assert.equal(record.renderer.width, 1280)
      assert.equal(record.renderer.height, 720)
      record.client = await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        width: innerWidth,
        height: innerHeight,
        devicePixelRatio,
      }))
      record.startedEpochMs = Date.now()
      const entry = { page, served, record }
      await sample(entry, 'Start')
      await action(entry)
      await sample(entry, 'End')
      await served.verify()
      assert.deepEqual(record.errors, [])
      record.complete = true
    } catch (error) {
      failure = error
      record.errors.push(String(error))
      if (page && !page.isClosed()) {
        record.failureImage = `${output}/${name}-failure.png`
        await page.screenshot({ path: record.failureImage }).catch(() => {})
      }
    } finally {
      record.finishedEpochMs = Date.now()
      if (served) {
        await served.verify().catch((error) => {
          record.errors.push(String(error))
          failure ??= error
        })
        served.detach()
      }
      if (page) {
        const video = page.video()
        await page.waitForTimeout(500).catch(() => {})
        await page.close().catch((error) => {
          record.errors.push(String(error))
          failure ??= error
        })
        if (video) {
          // Preserve the original even when preparation, interaction, or clip extraction fails.
          await video
            .path()
            .then((original) => {
              record.originalVideo = original
            })
            .catch((error) => {
              record.errors.push(String(error))
              failure ??= error
            })
          if (record.originalVideo && record.startedEpochMs) {
            record.video = `${videoDirectory}/${artifactPrefix}-${name}.webm`
            record.offsetSeconds = Math.max(0, (record.startedEpochMs - createdAt) / 1000 - 0.5)
            record.durationSeconds = (record.finishedEpochMs - record.startedEpochMs) / 1000 + 1
            record.timing =
              'Approximate page-creation wall-clock offset with 0.5s lead/trail padding. Absolute observation times and original video are retained. Visual evidence, not a frame-time benchmark.'
            try {
              record.originalVideoSha256 = hash(await readFile(record.originalVideo))
              await run('ffmpeg', [
                '-y',
                '-loglevel',
                'error',
                '-ss',
                String(record.offsetSeconds),
                '-i',
                record.originalVideo,
                '-t',
                String(record.durationSeconds),
                '-an',
                '-c:v',
                'libvpx-vp9',
                '-cpu-used',
                '5',
                '-threads',
                '2',
                record.video,
              ])
              record.videoSha256 = hash(await readFile(record.video))
            } catch (error) {
              record.errors.push(String(error))
              failure ??= error
            }
          }
        }
      }
      if (record.errors.length) failure ??= new Error(record.errors.join('\n'))
      if (failure) record.complete = false
      await flush()
    }
    if (failure) throw failure
  }

  try {
    build = await buildIdentity()
    report.build = build
    browser = await chromium.launch(browserLaunch)
    report.environment.browser = browser.version()
    const cdp = await browser.newBrowserCDPSession()
    report.environment.gpu = (await cdp.send('SystemInfo.getInfo')).gpu

    await runCase(
      'seed14-bank-wildlife',
      'Existing command-generated daylight-river campaign (seed 11); saved spatial terrain is explicitly RiverValley and regionIndex is 3, reproducing physical seed 14. Wagon/player retain the ordinary spawn20. This isolates the prior tree/deer recipe; it is not a played Big Blue arrival or an exact old animation timestamp.',
      async (page) => {
        const checkpoint = await fixture('river-daylight')
        assert.equal(checkpoint.view.seed, '11')
        const outer = JSON.parse(checkpoint.raw)
        outer.spatial.terrain = 'RiverValley'
        outer.spatial.regionIndex = 3
        await restore(page, JSON.stringify(outer))
        await resume(page)
        await driveTo(page, 0, 80)
        await hold(page, 'Space', 800)
        const s = await state(page)
        assert.equal(Number(BigInt(s.view.seed) % 2147483647n) + s.regionIndex, 14)
        assert.ok((await world(page)).river)
      },
      async (entry) => {
        const { page, record } = entry
        record.referenceTrunk = {
          id: 'tree-1-62',
          x: -4.0049016661942005,
          z: 93.80418059998192,
          source: 'Unchanged seed14 RiverValley CPU recipe and world regression',
        }
        const deer = () => world(page).then((w) => w.wildlife.find((a) => a.id === 'deer-3'))
        await aimAt(page, (await deer()).position)
        await capture(entry, 'seed14-team-and-deer')
        await page.waitForTimeout(2000)
        await stoppedDismount(page)
        const wagon = (await state(page)).wagon
        const viewpoint = { x: -20, z: 80 }
        await walkPlanned(page, viewpoint, record)
        const walking = await state(page)
        assert.equal(walking.mode, 'walking')
        assert.ok(walking.position.x < wagon.x - 15, 'Camera must walk clear of the wagon and oxen')
        record.viewpoint = {
          target: viewpoint,
          actual: walking.position,
          aim: { x: -7, y: 1.1, z: 82 },
        }
        await aimAt(page, record.viewpoint.aim)
        await capture(entry, 'seed14-trunk-and-dry-patrol')
        for (let i = 0; i < 18; i++) {
          await page.waitForTimeout(1000)
          assert.ok((await deer()).alive)
          await sample(entry, `Preserved trunk and live deer, second ${i + 1}`)
          if ((i + 1) % 6 === 0) await capture(entry, `seed14-full-body-patrol-${i + 1}`)
        }
      },
      'low',
    )

    await runCase(
      'hunt-retrieval',
      'Normal visible UI: Oregon, seed 11, Safe provisions; walk to deer-0 without changing targets or campaign state.',
      async (page) => {
        await start(page)
        await stoppedDismount(page)
        await walkTo(page, -4, 34)
        await walkTo(page, 3, 34)
        await walkTo(page, 3, 45)
      },
      async (entry) => {
        const { page, record } = entry
        const before = await state(page)
        await page.keyboard.press('h')
        await waitState(page, (s) => s.activity?.kind === 'hunt', 'beginning a hunt')
        let killed
        for (let shot = 0; shot < 5; shot++) {
          const target = (await world(page)).wildlife.find((a) => a.id === 'deer-0')
          assert.ok(target?.alive)
          await aimAt(page, target.position)
          await aimAt(page, (await world(page)).wildlife.find((a) => a.id === target.id).position)
          if (shot === 0) await capture(entry, 'hunt-aim')
          await page.keyboard.press('Space')
          await page.waitForTimeout(100)
          await sample(entry, `Actual shot ${shot + 1}`)
          killed = (await world(page)).wildlife.find(
            (a) => a.id === target.id && !a.alive && !a.harvested,
          )
          if (killed) break
          await page.keyboard.press('r')
          await waitState(page, (s) => s.activity?.phase === 'aiming', 'reloading')
        }
        assert.ok(killed, 'An actual shot must hit before a carcass capture is credited')
        record.targetId = killed.id
        await walkTo(page, killed.position.x - 1.8, killed.position.z)
        await aimAt(page, { ...killed.position, y: killed.position.y - 1.1 })
        await capture(entry, 'hunt-grounded-carcass')
        await page.waitForTimeout(2000)
        await page.keyboard.press('e')
        await page.waitForTimeout(100)
        assert.ok((await world(page)).wildlife.find((a) => a.id === killed.id).harvested)
        const bag = (await state(page)).view.activity.food_lbs
        assert.ok(bag > 0)
        await capture(entry, 'hunt-retrieved')
        await page.keyboard.press('x')
        const after = await waitState(page, (s) => !s.activity, 'finishing the hunt')
        assert.equal(after.view.day, before.view.day + 1)
        record.outcome = {
          targetId: killed.id,
          collectedFoodLbs: bag,
          dayBefore: before.view.day,
          dayAfter: after.view.day,
          foodBefore: before.view.inventory.food,
          foodAfter: after.view.inventory.food,
        }
      },
    )

    await runCase(
      'main-bank-fishing',
      'Existing command-generated daylight-river checkpoint. Drive from spawn20 to80, dismount, walk around the train to the actual crossing bank, then use F/Space.',
      async (page) => {
        await restore(page, (await fixture('river-daylight')).raw)
        await resume(page)
        await driveTo(page, 0, 80)
        await stoppedDismount(page)
        // The inward lane avoids the tree beside this checkpoint's left dismount.
        await rightBankCorridor(page, 94, -2)
        const bank = (await world(page)).locations.find((l) => l.id === 'riverbank')
        assert.ok(bank)
        await walkTo(page, bank.position[0], 94)
        await aimAt(page, { x: bank.position[0], y: 0, z: 107 })
      },
      async (entry) => {
        const { page, record } = entry
        const before = await state(page)
        await page.keyboard.press('f')
        await waitState(page, (s) => s.activity?.phase === 'ready', 'preparing fishing')
        await capture(entry, 'fishing-ready')
        await page.keyboard.press('Space')
        await waitState(page, (s) => s.activity?.phase === 'waiting', 'casting')
        await page.waitForFunction(() => window.__trail.world().fishingTarget !== null)
        const visible = await world(page),
          target = visible.fishingTarget
        assert.ok(
          target &&
            visible.river &&
            target[2] > visible.river.startZ &&
            target[2] < visible.river.endZ,
        )
        record.castTarget = target
        await aimAt(page, { x: target[0], y: target[1], z: target[2] })
        await capture(entry, 'fishing-line-and-bobber')
        await waitState(page, (s) => s.activity?.phase === 'bite', 'waiting for the bite')
        await page.keyboard.press('Space')
        await waitState(page, (s) => s.activity?.phase === 'reeling', 'hooking the fish')
        await capture(entry, 'fishing-reeling')
        try {
          for (let i = 0; i < 180; i++) {
            const s = await state(page)
            if (!s.activity) break
            assert.equal(s.paused, false)
            if ((s.activity.tension ?? 0) < 0.65) await page.keyboard.down('Space')
            else await page.keyboard.up('Space')
            if (i % 10 === 0) await sample(entry, `Reel observation ${i / 10}`)
            await page.waitForTimeout(100)
          }
        } finally {
          await page.keyboard.up('Space')
        }
        const after = await state(page)
        assert.equal(after.activity, null, 'Fishing must finish through actual input')
        assert.equal(after.view.day, before.view.day + 1)
        assert.equal(
          after.view.inventory.food,
          before.view.inventory.food - before.view.daily_food_lbs + 12,
        )
        await capture(entry, 'fishing-landed')
        record.outcome = {
          foodBefore: before.view.inventory.food,
          foodAfter: after.view.inventory.food,
          dayBefore: before.view.day,
          dayAfter: after.view.day,
        }
      },
    )

    await runCase(
      'rain-shelter',
      'Existing command-generated rain checkpoint; normal walking approaches the trader awning from outside and enters the modeled roof volume.',
      async (page) => {
        await restore(page, (await fixture('rain')).raw)
        await resume(page)
        await stoppedDismount(page)
        await walkTo(page, -3, 14)
        await walkTo(page, 11.5, 14)
        await walkTo(page, 11.5, 34)
        await walkTo(page, 8.5, 34)
        await aimAt(page, { x: 8.5, y: 1.9, z: 29 })
      },
      async (entry) => {
        const { page } = entry
        assert.equal((await state(page)).sceneWeather, 'rain')
        await capture(entry, 'rain-outside-awning')
        await page.waitForTimeout(3000)
        await walkTo(page, 8.5, 30.8)
        const inside = (await state(page)).position
        assert.ok(
          inside.x > 6.43 && inside.x < 10.57 && inside.z > 30.44 && inside.z < 31.4,
          'Walking eye must reach the clear area beneath the modeled awning',
        )
        await aimAt(page, { x: 8.5, y: inside.y + 0.2, z: 28.8 })
        await capture(entry, 'rain-under-awning')
        await page.waitForTimeout(5000)
        await walkTo(page, 8.5, 34)
        await capture(entry, 'rain-back-outside')
        await page.waitForTimeout(2000)
        assert.equal((await state(page)).sceneWeather, 'rain')
      },
    )
    assert.equal(report.cases.length, selected.length)
    assert.ok(report.cases.every((entry) => entry.complete))
    report.captureRunComplete = true
  } catch (error) {
    report.errors.push(String(error))
    throw error
  } finally {
    try {
      await browser?.close()
    } catch (error) {
      report.captureRunComplete = false
      report.errors.push(String(error))
      process.exitCode = 1
    } finally {
      await flush()
    }
  }
  console.log(JSON.stringify(report, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main()
