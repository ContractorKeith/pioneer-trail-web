import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { createHash } from 'node:crypto'

const baseURL = process.env.TRAIL_URL ?? 'http://localhost:4173'
const headlessGpu = process.env.TRAIL_HEADLESS_GPU === '1'
const browserLaunch = {
  executablePath: '/usr/bin/chromium',
  headless: headlessGpu,
  args: ['--ozone-platform=x11', ...(headlessGpu ? ['--enable-gpu'] : [])],
}
const browser = await chromium.launch(browserLaunch)
const page = await browser.newPage({ baseURL, viewport: { width: 1280, height: 720 } })
const report = {
  baseURL,
  browserLaunch,
  started: new Date().toISOString(),
  profile: { downloadMbps: 10, uploadMbps: 2, latencyMs: 150, cache: 'disabled, fresh context' },
  errors: [],
}
page.on('pageerror', (error) => report.errors.push(String(error)))
try {
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
  await page.goto('/?evidence=1')
  await page.getByRole('button', { name: 'Choose provisions' }).waitFor()
  report.coldInteractiveMs = performance.now() - began
  await page.getByLabel('Journey seed').fill('11')
  await page.getByRole('button', { name: 'Choose provisions' }).click()
  await page.getByRole('radio', { name: /^Safe/ }).click()
  await page.getByRole('button', { name: 'Load this plan' }).click()
  await page.getByRole('button', { name: 'Take the trail' }).click()
  await page.waitForFunction(() => window.__trail.snapshot().paused === false)
  report.coldPlayableMs = performance.now() - began
  report.renderer = await page.evaluate(() => window.__trail.renderer())
  report.resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((r) => ({
      url: r.name,
      transfer: r.transferSize,
      encoded: r.encodedBodySize,
      decoded: r.decodedBodySize,
      duration: r.duration,
    })),
  )
  const files = [
    ...new Set(['index.html', ...report.resources.map((r) => new URL(r.url).pathname.slice(1))]),
  ]
  report.payload = []
  for (const file of files) {
    const body = await readFile(path.join('dist', file))
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
    'Cold interactive time reaches the setup controls with the world loaded. Cold playable time also includes automated normal setup/outfitting clicks. This is local production preview under CDP throttling. Gzip independently compresses exact requested build bytes; preview transfer figures are reported separately and may be uncompressed.'
  assert.ok(report.initialGzipBytes <= 30_000_000)
  assert.deepEqual(report.errors, [])
  report.pass = true
} finally {
  await browser.close()
  await mkdir('docs/evidence/performance', { recursive: true })
  await writeFile('docs/evidence/performance/cold-load.json', JSON.stringify(report, null, 2))
}
console.log(JSON.stringify(report, null, 2))
