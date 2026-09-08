import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

/** Observe the actual page responses before navigation; never infer served bytes from disk. */
export function trackServedBuild(page, baseURL, build, { retainBodies = false } = {}) {
  const origin = new URL(baseURL).origin
  const expected = new Map(build.files.map((entry) => [entry.file, entry]))
  const pending = []
  const bodies = new Map()
  const report = { localBuildSha256: build.distSha256, responses: [], missing: [], pass: false }
  const response = (value) => {
    const row = { url: value.url(), status: value.status(), matchesDist: false }
    report.responses.push(row)
    report.pass = false
    pending.push(
      (async () => {
        try {
          const url = new URL(row.url)
          row.file = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html'
          const file = url.origin === origin ? expected.get(row.file) : undefined
          row.expectedSha256 = file?.sha256 ?? null
          const body = await value.body()
          row.bytes = body.length
          row.sha256 = createHash('sha256').update(body).digest('hex')
          row.matchesDist = !!file && row.sha256 === file.sha256 && row.bytes === file.bytes
          if (retainBodies) bodies.set(row.file, body)
        } catch (error) {
          row.error = String(error)
        }
      })(),
    )
  }
  const requestFailed = (request) => {
    report.pass = false
    report.responses.push({
      url: request.url(),
      status: 0,
      matchesDist: false,
      error: request.failure()?.errorText ?? 'Request failed',
    })
  }
  page.on('response', response)
  page.on('requestfailed', requestFailed)
  return {
    report,
    bodies,
    async verify() {
      // Response callbacks can append work while earlier bodies finish downloading.
      let checked = 0
      while (checked < pending.length) {
        const count = pending.length
        await Promise.all(pending.slice(checked, count))
        checked = count
      }
      const received = report.responses.filter((row) => row.matchesDist)
      report.missing = [
        ['index.html', received.some((row) => row.file === 'index.html')],
        ['application JavaScript', received.some((row) => /^assets\/.*\.js$/.test(row.file))],
        ['WASM', received.some((row) => row.file.endsWith('.wasm'))],
      ]
        .filter(([, present]) => !present)
        .map(([name]) => name)
      report.pass =
        report.missing.length === 0 &&
        report.responses.every(
          (row) => row.matchesDist && row.status >= 200 && row.status < 400 && !row.error,
        )
      report.verifiedAt = new Date().toISOString()
      assert.ok(
        report.pass,
        `Served production build differs from local manifest: ${JSON.stringify({
          missing: report.missing,
          failed: report.responses.filter(
            (row) => !row.matchesDist || row.status < 200 || row.status >= 400 || row.error,
          ),
        })}`,
      )
      return report
    },
    detach() {
      page.off('response', response)
      page.off('requestfailed', requestFailed)
    },
  }
}
