import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { buildIdentity } from './measure-ride.mjs'
import { trackServedBuild } from './served-build.mjs'

const baseURL = process.env.TRAIL_URL ?? 'http://localhost:4173'
const headlessGpu = process.env.TRAIL_HEADLESS_GPU === '1'
const browserLaunch = {
  headless: headlessGpu,
  args: [
    ...(process.platform === 'linux' ? ['--ozone-platform=x11'] : []),
    ...(headlessGpu ? ['--enable-gpu'] : []),
  ],
}
let browser, page, served
const report = {
  baseURL,
  browserLaunch,
  environment: {
    display: process.env.DISPLAY ?? null,
    sessionType: process.env.XDG_SESSION_TYPE ?? null,
  },
  started: new Date().toISOString(),
  profile: { downloadMbps: 10, uploadMbps: 2, latencyMs: 150, cache: 'disabled, fresh context' },
  errors: [],
  pass: false,
}
try {
  const build = await buildIdentity()
  report.build = build
  browser = await chromium.launch(browserLaunch)
  report.environment.browser = browser.version()
  page = await browser.newPage({ baseURL, viewport: { width: 1280, height: 720 } })
  served = trackServedBuild(page, baseURL, build, { retainBodies: true })
  report.servedBuild = served.report
  page.on('pageerror', (error) => report.errors.push(String(error)))
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 10_000_000 / 8,
    uploadThroughput: 2_000_000 / 8,
  })
  const began = performance.now()
  await page.goto('/?evidence=1&seed=11')
  await page.getByRole('heading', { name: 'Begin a journey', exact: true }).waitFor()
  report.coldInteractiveMs = performance.now() - began
  await page.getByRole('radio', { name: /^Safe/ }).click()
  await page.getByRole('button', { name: 'Take the trail' }).click()
  await page.waitForFunction(() => window.__trail.snapshot().paused === false)
  report.coldPlayableMs = performance.now() - began
  // Finish deferred assets after recording playable time, before computing the payload.
  await page.waitForLoadState('networkidle')
  report.renderer = await page.evaluate(() => window.__trail.renderer())
  report.environment.client = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    devicePixelRatio,
    width: innerWidth,
    height: innerHeight,
  }))
  report.resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((r) => ({
      url: r.name,
      transfer: r.transferSize,
      encoded: r.encodedBodySize,
      decoded: r.decodedBodySize,
      duration: r.duration,
    })),
  )
  await served.verify()
  report.payload = []
  for (const [file, body] of served.bodies) {
    report.payload.push({
      file,
      bytes: body.length,
      gzipBytes: gzipSync(body).length,
      sha256: createHash('sha256').update(body).digest('hex'),
    })
  }
  report.initialRawBytes = report.payload.reduce((s, r) => s + r.bytes, 0)
  report.initialGzipBytes = report.payload.reduce((s, r) => s + r.gzipBytes, 0)
  report.note =
    'Cold interactive time reaches the setup controls with the world loaded. Cold playable time also includes automated normal setup/outfitting clicks. This is production preview under CDP throttling. Gzip independently compresses actual response bodies verified against the local build manifest; preview transfer figures are reported separately and may be uncompressed.'
  assert.ok(report.initialGzipBytes <= 30_000_000)
  assert.deepEqual(report.errors, [])
  report.pass = true
} catch (error) {
  report.errors.push(String(error))
  report.pass = false
  throw error
} finally {
  try {
    if (served) {
      await served.verify().catch((error) => {
        report.errors.push(String(error))
        report.pass = false
      })
      served.detach()
    }
    await browser?.close()
  } finally {
    await mkdir('docs/evidence/performance', { recursive: true })
    await writeFile('docs/evidence/performance/cold-load.json', JSON.stringify(report, null, 2))
  }
}
console.log(JSON.stringify(report, null, 2))
