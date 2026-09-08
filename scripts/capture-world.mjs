import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { buildIdentity } from './measure-ride.mjs'
import { trackServedBuild } from './served-build.mjs'
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

const baseURL = process.env.TRAIL_URL ?? 'http://localhost:4173'
const output = 'docs/evidence/visual-review'
const videoDirectory = '.artifacts/videos'
const run = promisify(execFile)
await mkdir(output, { recursive: true })
await mkdir(videoDirectory, { recursive: true })
const headlessGpu = process.env.TRAIL_HEADLESS_GPU === '1'
const browserLaunch = {
  executablePath: '/usr/bin/chromium',
  headless: headlessGpu,
  args: ['--ozone-platform=x11', ...(headlessGpu ? ['--enable-gpu'] : [])],
}
let browser, build
const report = {
  baseURL,
  browserLaunch,
  environment: {
    display: process.env.DISPLAY ?? null,
    sessionType: process.env.XDG_SESSION_TYPE ?? null,
  },
  date: new Date().toISOString(),
  captureRunComplete: false,
  captures: [],
  recordings: [],
  servedBuilds: [],
  errors: [],
  note: 'Actual production first-person controls. Rare scene checkpoints are command-generated fixtures, not proof of a complete played campaign. Visual verdict requires independent image/video inspection.',
}
const pages = new Map()
const newPage = async (setup, recordVideo = false) => {
  const createdAt = Date.now()
  const page = await browser.newPage({
    baseURL,
    viewport: { width: 1280, height: 720 },
    ...(recordVideo && {
      recordVideo: { dir: videoDirectory, size: { width: 1280, height: 720 } },
    }),
  })
  const served = trackServedBuild(page, baseURL, build)
  const servedBuildId = report.servedBuilds.length
  report.servedBuilds.push({ id: servedBuildId, setup, verification: served.report })
  pages.set(page, { setup, createdAt, segments: [], served, servedBuildId })
  page.on('pageerror', (error) => report.errors.push(String(error)))
  page.on('crash', () => report.errors.push('Page crashed'))
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push(message.text())
  })
  return page
}
const observation = async (page) => {
  const s = await state(page)
  assert.equal(s.paused, false, 'A visual capture must show active gameplay')
  return {
    position: s.position,
    heading: s.heading,
    wagon: s.wagon,
    speed: s.speed,
    mode: s.mode,
    sceneWeather: s.sceneWeather,
    campaignWeather: s.view.weather,
    seed: s.view.seed,
    day: s.view.day,
    terrain: await page.evaluate(() => JSON.parse(window.__trail.save()).spatial.terrain),
    campaignTerrain: s.view.terrain,
    region: s.regionId,
    regionIndex: s.regionIndex,
    collisionCount: s.collisionCount,
    wildlife: (await world(page)).wildlife,
    drawCalls: s.drawCalls,
    triangles: s.triangles,
    fps: s.fps,
  }
}
const capture = async (page, name) => {
  await page.waitForTimeout(250)
  await pages.get(page).served.verify()
  await page.screenshot({ path: `${output}/${name}.png` })
  report.captures.push({
    name,
    setup: pages.get(page).setup,
    buildSha256: build.distSha256,
    servedBuildId: pages.get(page).servedBuildId,
    client: await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      devicePixelRatio,
      width: innerWidth,
      height: innerHeight,
    })),
    renderer: await page.evaluate(() => window.__trail.renderer()),
    ...(await observation(page)),
  })
}
const motion = async (page, name, description, action) => {
  await pages.get(page).served.verify()
  const began = Date.now(),
    samples = []
  const sample = async (label) =>
    samples.push({
      seconds: (Date.now() - began) / 1000,
      label,
      ...(await observation(page)),
    })
  await sample('Start')
  await action(sample)
  await sample('End')
  await pages.get(page).served.verify()
  pages.get(page).segments.push({
    name,
    description,
    began,
    durationSeconds: (Date.now() - began) / 1000,
    samples,
    renderer: await page.evaluate(() => window.__trail.renderer()),
  })
}
const closePage = async (page) => {
  const { createdAt, setup, segments, served, servedBuildId } = pages.get(page)
  const video = page.video()
  await page.waitForTimeout(500)
  await served.verify()
  served.detach()
  await page.close()
  if (video && segments.length) {
    const original = await video.path()
    for (const { began, ...segment } of segments) {
      const path = `${videoDirectory}/visual-${segment.name}.webm`
      const offsetSeconds = Math.max(0, (began - createdAt) / 1000 - 0.5)
      await run('ffmpeg', [
        '-y',
        '-loglevel',
        'error',
        '-ss',
        String(offsetSeconds),
        '-i',
        original,
        '-t',
        String(segment.durationSeconds + 1),
        '-an',
        '-c:v',
        'libvpx-vp9',
        '-cpu-used',
        '5',
        '-threads',
        '2',
        path,
      ])
      report.recordings.push({
        ...segment,
        setup,
        path,
        original,
        offsetSeconds,
        timing:
          'Approximate wall-clock video offset with 0.5s lead/trail padding; original retained. This clip is visual evidence, not a frame-time benchmark.',
        buildSha256: build.distSha256,
        servedBuildId,
        sha256: createHash('sha256')
          .update(await readFile(path))
          .digest('hex'),
      })
    }
  }
  pages.delete(page)
}
try {
  build = await buildIdentity()
  report.build = build
  report.source = build.commit
  report.dirty = build.dirty
  browser = await chromium.launch(browserLaunch)
  report.environment.browser = browser.version()
  const browserCdp = await browser.newBrowserCDPSession()
  report.environment.gpu = (await browserCdp.send('SystemInfo.getInfo')).gpu
  const page = await newPage('Normal UI: Oregon, seed 11, Safe provisions')
  await start(page)
  await capture(page, 'seat-forward')
  await hold(page, 'ArrowLeft', 2250)
  await capture(page, 'seat-rear')
  await hold(page, 'ArrowRight', 2250)
  await page.keyboard.press('e')
  await walkTo(page, -4, 14)
  await hold(page, 'ArrowLeft', 700)
  await capture(page, 'wagon-exterior')
  await walkTo(page, -6.8, 20)
  await aimAt(page, { x: -6.8, y: 1, z: 21.5 })
  await capture(page, 'camp')
  await walkTo(page, -4, 30)
  await aimAt(page, { x: -0.79, y: 2, z: 26 })
  await capture(page, 'ox-front')
  await walkTo(page, -3, 28.5)
  await walkTo(page, -3, 26)
  const ground = (await state(page)).wagon.y
  await aimAt(page, { x: -0.79, y: ground + 1.1, z: 25 })
  await capture(page, 'ox-side')
  await aimAt(page, { x: -0.79, y: ground + 0.25, z: 25 })
  await capture(page, 'ox-hoof-contact')
  await walkTo(page, -4, 27)
  await aimAt(page, { x: -4.9, y: 1.9, z: 25 })
  await capture(page, 'companion')
  await closePage(page)

  const ride = await newPage('Normal UI: Oregon, seed 11, Safe provisions', true)
  await start(ride)
  await aimAt(ride, { x: 0, y: 1.15, z: 25 })
  await motion(
    ride,
    'wagon-team-motion',
    'Real W acceleration, Space braking, S reversing, then downward side and rear looks while driving. Camera remains at the driver seat.',
    async (sample) => {
      await hold(ride, 'w', 6500)
      await sample('Forward team gait')
      await hold(ride, 'Space', 800)
      await sample('Braked team')
      await hold(ride, 's', 3000)
      await sample('Reverse team gait')
      await hold(ride, 'Space', 500)
      let pose = (await state(ride)).wagon
      // The seat/rail may occlude part of the wheel. Preserve that genuine viewpoint.
      await aimAt(ride, { x: pose.x + 1.31, y: pose.y + 0.5, z: pose.z + 1.45 })
      await hold(ride, 'w', 2000)
      await sample('Downward side look while moving')
      await hold(ride, 'Space', 800)
      pose = (await state(ride)).wagon
      await aimAt(ride, { x: pose.x, y: pose.y + 1.9, z: pose.z - 2 })
      await hold(ride, 'w', 2000)
      await sample('Rear interior while moving')
      await hold(ride, 'Space', 800)
    },
  )
  await capture(ride, 'ride-rear-stopped')
  await closePage(ride)

  const animals = await newPage(
    'Normal UI: Oregon, seed 11, Safe provisions; walk to the authored dry clearings',
    true,
  )
  await start(animals)
  await animals.keyboard.press('e')
  await walkTo(animals, -4, 34)
  await walkTo(animals, -12.8, 34)
  const watch = async (id, name) => {
    const target = async () => {
      const animal = (await world(animals)).wildlife.find((entry) => entry.id === id)
      assert.ok(animal?.alive, `${id} must remain a live, visible target`)
      return animal.position
    }
    await aimAt(animals, await target())
    await capture(animals, name)
    await motion(
      animals,
      `${name}-motion`,
      `Stationary walking camera observing ${id}; normal drag/arrow look follows the full moving body in its dry clearing. No shots or target mutations.`,
      async (sample) => {
        for (let i = 0; i < 12; i++) {
          await aimAt(animals, await target())
          await animals.waitForTimeout(1000)
          await sample(`Patrol second ${i + 1}`)
        }
      },
    )
  }
  await watch('rabbit-5', 'wildlife-rabbit')
  await walkTo(animals, -12.8, 45)
  await walkTo(animals, 3, 45)
  await watch('deer-0', 'wildlife-deer')
  await closePage(animals)

  for (const kind of ['river', 'river-daylight', 'rain', 'snow', 'fog', 'mountains']) {
    const scene = await newPage(
      `Command-generated ${kind} checkpoint; subsequent movement uses normal controls`,
      kind === 'river-daylight',
    )
    const checkpoint = await fixture(kind)
    await restore(scene, checkpoint.raw)
    await resume(scene)
    await hold(scene, 'w', 1000)
    await hold(scene, 'Space', 800)
    if (kind === 'river-daylight') {
      await driveTo(scene, 0, 80)
      await hold(scene, 'Space', 800)
      await scene.keyboard.press('e')
      await walkTo(scene, -3, 94)
      await aimAt(scene, { x: 0, y: -0.2, z: 121 })
    }
    await capture(scene, kind)
    if (kind === 'fog') assert.equal((await state(scene)).sceneWeather, 'fog')
    if (kind === 'river-daylight') {
      await motion(
        scene,
        'river-daylight-motion',
        'Stationary first-person view from the physically approached near bank; animated main-channel surface, banks and visible hazards.',
        async (sample) => {
          for (let i = 0; i < 8; i++) {
            await scene.waitForTimeout(1000)
            await sample(`Water second ${i + 1}`)
          }
        },
      )
    }
    if (kind === 'river') {
      await scene.keyboard.press('e')
      await walkTo(scene, -6.8, 20)
      await aimAt(scene, { x: -6.8, y: (await state(scene)).wagon.y + 1, z: 21.5 })
      await capture(scene, 'camp-night')
    }
    if (kind === 'mountains') {
      await scene.keyboard.press('e')
      const wagon = (await state(scene)).wagon
      await walkTo(scene, -3, wagon.z + 6)
      await aimAt(scene, { x: -0.79, y: wagon.y + 0.5, z: wagon.z + 5.03 })
      await capture(scene, 'ox-mountain-contact')
    }
    await closePage(scene)
  }
  assert.deepEqual(report.errors, [])
  report.captureRunComplete = true
} catch (error) {
  report.errors.push(String(error))
  report.captureRunComplete = false
  report.failureImages = []
  for (const page of pages.keys()) {
    const path = `${output}/failure-${report.failureImages.length}.png`
    if (!page.isClosed()) {
      await page
        .screenshot({ path })
        .then(() => report.failureImages.push(path))
        .catch(() => {})
    }
  }
  throw error
} finally {
  try {
    for (const { served } of pages.values()) {
      await served.verify().catch((error) => {
        report.errors.push(String(error))
        report.captureRunComplete = false
      })
      served.detach()
    }
    await browser?.close()
  } finally {
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
  }
}
console.log(JSON.stringify(report, null, 2))
