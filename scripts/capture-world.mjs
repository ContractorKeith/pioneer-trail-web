import { chromium } from 'playwright'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
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
} from '../tests/world.helpers.ts'

const baseURL = process.env.TRAIL_URL ?? 'http://localhost:4173'
const output = 'docs/evidence/visual-review'
await mkdir(output, { recursive: true })
const headlessGpu = process.env.TRAIL_HEADLESS_GPU === '1'
const browserLaunch = {
  executablePath: '/usr/bin/chromium',
  headless: headlessGpu,
  args: ['--ozone-platform=x11', ...(headlessGpu ? ['--enable-gpu'] : [])],
}
const browser = await chromium.launch(browserLaunch)
const buildFiles = [
  'index.html',
  'wasm/pioneer_trail_web_engine_bg.wasm',
  ...(await readdir('dist/assets')).map((name) => `assets/${name}`),
]
const report = {
  baseURL,
  browserLaunch,
  date: new Date().toISOString(),
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  build: Object.fromEntries(
    await Promise.all(
      buildFiles.map(async (file) => [
        file,
        createHash('sha256')
          .update(await readFile(`dist/${file}`))
          .digest('hex'),
      ]),
    ),
  ),
  captures: [],
  errors: [],
}
const capture = async (page, name) => {
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${output}/${name}.png` })
  const s = await state(page)
  report.captures.push({
    name,
    renderer: await page.evaluate(() => window.__trail.renderer()),
    position: s.position,
    heading: s.heading,
    weather: s.view.weather,
    day: s.view.day,
    terrain: s.view.terrain,
    region: s.regionId,
    drawCalls: s.drawCalls,
    triangles: s.triangles,
    fps: s.fps,
  })
}
try {
  const page = await browser.newPage({ baseURL, viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (error) => report.errors.push(String(error)))
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
  await walkTo(page, -4, 27)
  await aimAt(page, { x: -4.9, y: 1.9, z: 25 })
  await capture(page, 'companion')
  await page.close()
  for (const kind of ['river', 'river-daylight', 'rain', 'snow', 'fog', 'mountains']) {
    const scene = await browser.newPage({ baseURL, viewport: { width: 1280, height: 720 } })
    scene.on('pageerror', (error) => report.errors.push(String(error)))
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
    await scene.close()
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
