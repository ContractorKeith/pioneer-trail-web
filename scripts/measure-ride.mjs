import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const width = 1280
const height = 720
const warmupMs = 10_000
const durationMs = 120_000
const settings = {
  sensitivity: 1,
  fov: 72,
  volume: 0.45,
  muted: true,
  quality: 'low',
  reducedMotion: false,
  lookMode: 'drag',
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function quantile(sorted, percentile) {
  if (!sorted.length) return null
  const index = (sorted.length - 1) * percentile
  const low = Math.floor(index)
  return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low)
}

export function summarizeFrames(frames) {
  assert.ok(frames.length > 0, 'No animation frames recorded')
  assert.ok(frames.every((frame) => Number.isFinite(frame.ms) && frame.ms > 0))
  const sorted = frames.map((frame) => frame.ms).sort((a, b) => a - b)
  const elapsedMs = frames.reduce((sum, frame) => sum + frame.ms, 0)
  let pathMeters = 0
  let slowestFiveSeconds = Infinity
  let windowStart = 0
  const distance = [0]
  const forwardSegments = []
  let forwardStart = null
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    if (i) pathMeters += Math.hypot(frame.x - frames[i - 1].x, frame.z - frames[i - 1].z)
    distance[i] = pathMeters
    while (windowStart < i - 1 && frame.atMs - frames[windowStart + 1].atMs >= 5_000) windowStart++
    if (frame.atMs - frames[windowStart].atMs >= 5_000) {
      slowestFiveSeconds = Math.min(slowestFiveSeconds, pathMeters - distance[windowStart])
    }
    if (frame.speed > 0.2 && forwardStart === null) forwardStart = frame.atMs - frame.ms
    if ((frame.speed <= 0.2 || i === frames.length - 1) && forwardStart !== null) {
      forwardSegments.push({ fromMs: forwardStart, toMs: frame.atMs })
      forwardStart = null
    }
  }
  return {
    frames: frames.length,
    elapsedMs,
    excludedFrames: 0,
    medianFrameMs: quantile(sorted, 0.5),
    medianFps: 1000 / quantile(sorted, 0.5),
    p95FrameMs: quantile(sorted, 0.95),
    averageFps: (frames.length * 1000) / elapsedMs,
    maximumFrameMs: sorted.at(-1),
    framesOver50Ms: frames.filter((frame) => frame.ms > 50).length,
    stoppedFrames: frames.filter((frame) => Math.abs(frame.speed) < 0.1).length,
    pausedFrames: frames.filter((frame) => frame.paused).length,
    hiddenFrames: frames.filter((frame) => frame.hidden).length,
    unfocusedFrames: frames.filter((frame) => !frame.focused).length,
    nonRidingFrames: frames.filter((frame) => frame.mode !== 'riding').length,
    pathMeters,
    slowestFiveSecondPathMeters: Number.isFinite(slowestFiveSeconds) ? slowestFiveSeconds : null,
    minZ: Math.min(...frames.map((frame) => frame.z)),
    maxZ: Math.max(...frames.map((frame) => frame.z)),
    collisionDelta: frames.at(-1).collisions - frames[0].collisions,
    regions: [...new Set(frames.map((frame) => frame.region))],
    forwardSegments,
  }
}

function trailAt(trail, z) {
  for (let i = 1; i < trail.length; i++) {
    if (z <= trail[i].z) {
      const a = trail[i - 1]
      const b = trail[i]
      const fraction = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z)))
      return a.x + (b.x - a.x) * fraction
    }
  }
  return trail.at(-1).x
}

// Follow the road using only keyboard input, with room to decelerate at each end.
export function rideControls(state, trail, previousDirection) {
  const direction = state.z >= 84 ? -1 : state.z <= 24 ? 1 : previousDirection
  const targetZ = state.z + direction * 8
  const facing = Math.atan2((trailAt(trail, targetZ) - state.x) * direction, 8)
  const difference = Math.atan2(Math.sin(facing - state.yaw), Math.cos(facing - state.yaw))
  const motionSign = Math.abs(state.speed) > 0.05 ? Math.sign(state.speed) : direction
  const turn = Math.abs(difference) > 0.025 ? Math.sign(difference) * motionSign : 0
  return {
    direction,
    keys: [direction > 0 ? 'w' : 's', ...(turn ? [turn > 0 ? 'a' : 'd'] : [])],
    roadOffset: state.x - trailAt(trail, state.z),
  }
}

// Shared by ride and campaign reports; importing this helper never launches a browser.
export async function buildIdentity() {
  const files = []
  async function visit(directory) {
    for (const entry of (
      await readdir(path.join(root, 'dist', directory), { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.posix.join(directory, entry.name)
      if (entry.isDirectory()) await visit(name)
      else if (entry.isFile()) {
        const body = await readFile(path.join(root, 'dist', name))
        files.push({ file: name, bytes: body.length, sha256: sha256(body) })
      }
    }
  }
  await visit('')
  const [commit, changes] = await Promise.all([
    run('git', ['rev-parse', 'HEAD'], { cwd: root }),
    run('git', ['status', '--porcelain'], { cwd: root }),
  ])
  return {
    commit: commit.stdout.trim(),
    dirty: changes.stdout.trim().length > 0,
    sourceStatus: changes.stdout.trim(),
    distSha256: sha256(files.map((file) => `${file.file}\0${file.sha256}\n`).join('')),
    files,
  }
}

async function readState(page) {
  return page.evaluate(() => {
    const s = window.__trail.snapshot()
    return {
      x: s.wagon.x,
      z: s.wagon.z,
      yaw: s.wagon.yaw,
      speed: s.speed,
      mode: s.mode,
      paused: s.paused,
      hidden: document.hidden,
      focused: document.hasFocus(),
      region: s.regionId,
      collisions: s.collisionCount,
      day: s.view.day,
      miles: s.view.miles,
      status: s.view.status,
      activity: s.activity,
      errorNotices: [...document.querySelectorAll('.notice.is-error, .loading-error')].map(
        (element) => element.textContent,
      ),
    }
  })
}

// Observe rAF independently of runtime.frames(), which excludes paused frames.
function recordWindow(page) {
  return page.evaluate(
    (requestedMs) =>
      new Promise((resolve) => {
        requestAnimationFrame((start) => {
          let previous = start
          const frames = []
          const transitions = []
          const visibility = () =>
            transitions.push({
              atMs: performance.now() - start,
              hidden: document.hidden,
              focused: document.hasFocus(),
            })
          document.addEventListener('visibilitychange', visibility)
          window.addEventListener('blur', visibility)
          window.addEventListener('focus', visibility)
          const tick = (now) => {
            const s = window.__trail.snapshot()
            frames.push({
              atMs: now - start,
              ms: now - previous,
              x: s.wagon.x,
              z: s.wagon.z,
              yaw: s.wagon.yaw,
              speed: s.speed,
              mode: s.mode,
              paused: s.paused,
              hidden: document.hidden,
              focused: document.hasFocus(),
              region: s.regionId,
              collisions: s.collisionCount,
              drawCalls: s.drawCalls,
              triangles: s.triangles,
            })
            previous = now
            if (now - start < requestedMs) requestAnimationFrame(tick)
            else {
              document.removeEventListener('visibilitychange', visibility)
              window.removeEventListener('blur', visibility)
              window.removeEventListener('focus', visibility)
              resolve({
                requestedMs,
                startPerformanceMs: start,
                endPerformanceMs: now,
                startEpochMs: performance.timeOrigin + start,
                endEpochMs: performance.timeOrigin + now,
                transitions,
                frames,
              })
            }
          }
          requestAnimationFrame(tick)
        })
      }),
    durationMs,
  )
}

export async function main() {
  const { chromium } = await import('playwright')
  const baseURL = process.env.TRAIL_URL ?? 'http://localhost:4173'
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  const headlessGpu = process.env.TRAIL_HEADLESS_GPU === '1'
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const artifactBase = `.artifacts/videos/ride-low-${stamp}`
  const reportPath = path.join(root, 'docs/evidence/performance/ride.json')
  const report = {
    started: new Date().toISOString(),
    baseURL,
    pass: false,
    procedure:
      'Fresh context; normal Oregon/seed 11/Safe setup; real W/S/A/D road shuttle. Settings are the only injected application state.',
    journey: { route: 'oregon', seed: '11', provisions: 'Safe', difficulty: 'Normal' },
    acceptance: { minimumMedianFps: 30, maximumP95FrameMs: 50, durationMs, warmupMs },
    settings,
    viewport: { width, height, deviceScaleFactor: 1 },
    browserLaunch: {
      executablePath,
      headless: headlessGpu,
      args: [
        ...(process.platform === 'linux' ? ['--ozone-platform=x11'] : []),
        ...(headlessGpu ? ['--enable-gpu'] : []),
      ],
    },
    environment: {
      platform: os.platform(),
      release: os.release(),
      version: os.version(),
      arch: os.arch(),
      cpu: os.cpus(),
      totalMemoryBytes: os.totalmem(),
      node: process.version,
      display: process.env.DISPLAY ?? null,
      sessionType: process.env.XDG_SESSION_TYPE ?? null,
    },
    artifacts: {
      frames: `${artifactBase}.frames.json`,
      video: `${artifactBase}.webm`,
      clip: `${artifactBase}-30s.webm`,
    },
    errors: [],
    checks: {},
    controlTrace: [],
  }
  let browser
  let context
  let page
  let video
  let pageCreatedEpochMs
  let closing = false
  let phase = 'setup'
  let held = new Set()
  let direction = 1
  let windowResult
  const served = []
  const responses = []
  const error = (kind, message) =>
    report.errors.push({ phase, kind, message: String(message), at: new Date().toISOString() })
  const keys = async (next) => {
    const wanted = new Set(next)
    for (const key of held) if (!wanted.has(key)) await page.keyboard.up(key)
    for (const key of wanted) if (!held.has(key)) await page.keyboard.down(key)
    held = wanted
  }
  const control = async () => {
    const state = await readState(page)
    for (const notice of state.errorNotices) {
      if (
        !report.errors.some(
          (event) => event.kind === 'application-notice' && event.message === notice,
        )
      )
        error('application-notice', notice)
    }
    const commands = rideControls(state, report.trail, direction)
    direction = commands.direction
    const active = !state.paused && !state.hidden && state.focused && state.mode === 'riding'
    await keys(active ? commands.keys : [])
    report.controlTrace.push({
      epochMs: Date.now(),
      phase,
      ...state,
      ...commands,
      keys: active ? commands.keys : [],
    })
  }
  try {
    await Promise.all([
      mkdir(path.join(root, '.artifacts/videos'), { recursive: true }),
      mkdir(path.dirname(reportPath), { recursive: true }),
    ])
    report.build = await buildIdentity()
    report.environment.osRelease = await readFile('/etc/os-release', 'utf8').catch(() => null)
    report.environment.hardwareModel = await readFile('/proc/device-tree/model', 'utf8')
      .then((value) => value.replace(/\0/g, '').trim())
      .catch(() => null)
    report.environment.ffmpeg = (await run('ffmpeg', ['-version'])).stdout.split('\n')[0]
    browser = await chromium.launch(report.browserLaunch)
    browser.on('disconnected', () => {
      if (!closing) error('browser-disconnected', 'Browser disconnected before cleanup')
    })
    const browserCdp = await browser.newBrowserCDPSession()
    report.browserVersion = await browserCdp.send('Browser.getVersion')
    report.gpu = (await browserCdp.send('SystemInfo.getInfo')).gpu
    context = await browser.newContext({
      baseURL,
      viewport: { width, height },
      deviceScaleFactor: 1,
      recordVideo: { dir: path.join(root, '.artifacts/videos'), size: { width, height } },
    })
    await context.addInitScript((initialSettings) => {
      localStorage.setItem('pioneer-trail:settings:v2', JSON.stringify(initialSettings))
    }, settings)
    pageCreatedEpochMs = Date.now()
    page = await context.newPage()
    page.setDefaultTimeout(15_000)
    video = page.video()
    page.on('pageerror', (event) => error('pageerror', event))
    page.on('crash', () => error('page-crash', 'Page crashed'))
    page.on('console', (event) => {
      if (event.type() === 'error') error('console-error', event.text())
    })
    page.on('requestfailed', (request) =>
      error('requestfailed', `${request.url()}: ${request.failure()?.errorText}`),
    )
    page.on('response', (response) => {
      if (new URL(response.url()).origin !== new URL(baseURL).origin) return
      const file =
        decodeURIComponent(new URL(response.url()).pathname).replace(/^\//, '') || 'index.html'
      const expected = report.build.files.find((candidate) => candidate.file === file)
      if (!expected) return
      responses.push(
        response
          .body()
          .then((body) => {
            served.push({
              file,
              status: response.status(),
              sha256: sha256(body),
              matchesDist: sha256(body) === expected.sha256,
            })
          })
          .catch((event) => error('response-body', `${file}: ${event}`)),
      )
    })
    await page.goto('/?evidence=1&seed=11', { waitUntil: 'networkidle' })
    await page.getByRole('combobox', { name: 'Route', exact: true }).selectOption('oregon')
    await page.getByRole('radio', { name: /^Safe/ }).click()
    await page.getByRole('button', { name: 'Take the trail' }).click()
    await page.waitForFunction(() => window.__trail?.snapshot().paused === false)
    await page.locator('canvas.game-canvas').click({ position: { x: 640, y: 300 } })
    report.renderer = await page.evaluate(() => window.__trail.renderer())
    report.client = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      devicePixelRatio,
      width: innerWidth,
      height: innerHeight,
      savedSettings: JSON.parse(localStorage.getItem('pioneer-trail:settings:v2')),
    }))
    report.trail = await page.evaluate(() => window.__trail.world().trail)
    report.initialState = await readState(page)
    assert.equal(report.renderer.quality, 'low')
    assert.equal(report.renderer.width, width)
    assert.equal(report.renderer.height, height)
    assert.equal(report.initialState.mode, 'riding')
    assert.equal(report.initialState.paused, false)
    assert.ok(
      !/swiftshader|llvmpipe|softpipe|lavapipe|swrast|software|microsoft basic render/i.test(
        report.renderer.renderer,
      ),
      'Hardware renderer required',
    )
    assert.ok(
      !/software|disabled|unavailable/i.test(report.gpu.featureStatus?.webgl2 ?? ''),
      'WebGL2 hardware acceleration is unavailable',
    )
    report.checks.hardware = true
    report.checks.low720p = true
    phase = 'warmup'
    report.warmupStartEpochMs = Date.now()
    while (Date.now() - report.warmupStartEpochMs < warmupMs) {
      await control()
      await sleep(100)
    }
    report.warmupElapsedMs = Date.now() - report.warmupStartEpochMs
    report.measurementInitialState = await readState(page)
    assert.ok(
      !report.controlTrace.some(
        (sample) => sample.paused || sample.hidden || !sample.focused || sample.mode !== 'riding',
      ),
      'Warmup was interrupted',
    )
    phase = 'measurement'
    let finished = false
    let recordingError
    const recording = recordWindow(page)
      .then(
        (value) => {
          windowResult = value
        },
        (event) => {
          recordingError = event
        },
      )
      .finally(() => {
        finished = true
      })
    const deadline = Date.now() + durationMs + 15_000
    let nextProgress = Date.now() + 30_000
    while (!finished && Date.now() < deadline) {
      await control()
      if (Date.now() >= nextProgress) {
        console.log(
          `Continuous ride: ${Math.round((durationMs + 15_000 - (deadline - Date.now())) / 1000)} seconds observed`,
        )
        nextProgress += 30_000
      }
      await sleep(100)
    }
    assert.ok(
      finished,
      'Continuous rAF recorder did not finish within 135 seconds (hidden, stalled, or crashed page)',
    )
    await recording
    if (recordingError) throw recordingError
    phase = 'post-measurement'
    await keys([])
    report.measurementFinalState = await readState(page)
    report.rendererAfter = await page.evaluate(() => window.__trail.renderer())
    report.measurement = summarizeFrames(windowResult.frames)
    report.window = { ...windowResult, frames: undefined }
    await writeFile(
      path.join(root, report.artifacts.frames),
      JSON.stringify({
        schema: 1,
        note: 'Every independent rAF interval in one continuous window, including slow, stopped, paused, and hidden frames. No trimming or sampling.',
        build: report.build.distSha256,
        renderer: report.renderer,
        settings,
        ...windowResult,
      }),
    )
    await Promise.all(responses)
    report.servedBuild = served
    const m = report.measurement
    report.checks = {
      ...report.checks,
      servedProductionBuild:
        served.some((file) => file.file === 'index.html') &&
        served.some((file) => file.file.endsWith('.js')) &&
        served.every((file) => file.matchesDist && file.status < 400),
      continuousDuration: m.elapsedMs >= durationMs && m.excludedFrames === 0,
      medianFps: m.medianFps >= 30,
      p95FrameMs: m.p95FrameMs <= 50,
      uninterrupted:
        m.pausedFrames === 0 &&
        m.hiddenFrames === 0 &&
        m.unfocusedFrames === 0 &&
        m.nonRidingFrames === 0 &&
        windowResult.transitions.every((event) => !event.hidden && event.focused),
      notStuck:
        m.maximumFrameMs < 5000 &&
        m.slowestFiveSecondPathMeters !== null &&
        m.slowestFiveSecondPathMeters >= 0.75,
      roadShuttle:
        m.minZ >= 20 &&
        m.maxZ <= 93 &&
        m.maxZ - m.minZ >= 40 &&
        m.pathMeters >= 120 &&
        m.regions.length === 1,
      noApplicationErrors: report.errors.length === 0,
    }
    await page.screenshot({ path: path.join(root, `${artifactBase}-end.png`) })
    report.artifacts.endScreenshot = `${artifactBase}-end.png`
  } catch (event) {
    error('measurement-failure', event.stack ?? event)
    if (page && !page.isClosed()) {
      await keys([]).catch(() => {})
      report.failureState = await readState(page).catch(() => null)
      await page
        .screenshot({ path: path.join(root, `${artifactBase}-failure.png`), timeout: 5_000 })
        .catch(() => {})
    }
  } finally {
    phase = 'cleanup'
    closing = true
    if (context) await context.close().catch((event) => error('context-close', event))
    if (video) {
      await video
        .saveAs(path.join(root, report.artifacts.video))
        .catch((event) => error('video-save', event))
      await video.delete().catch(() => {})
    }
    if (browser) await browser.close().catch((event) => error('browser-close', event))
    if (windowResult && video) {
      const startSeconds = Math.max(0, (windowResult.startEpochMs - pageCreatedEpochMs) / 1000) + 5
      try {
        await run(
          'ffmpeg',
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-ss',
            String(startSeconds),
            '-i',
            path.join(root, report.artifacts.video),
            '-t',
            '30',
            '-an',
            '-c:v',
            'libvpx-vp9',
            '-crf',
            '32',
            '-b:v',
            '0',
            '-deadline',
            'good',
            '-cpu-used',
            '4',
            path.join(root, report.artifacts.clip),
          ],
          { timeout: 120_000 },
        )
        report.clip = {
          durationSeconds: 30,
          approximateVideoStartSeconds: startSeconds,
          caption:
            'Actual 720p low-quality gameplay: keyboard-controlled forward/reverse road travel during the continuous two-minute hardware performance measurement.',
          note: 'Offset estimated from page creation and the rAF epoch; a five-second interior margin keeps the excerpt inside the measurement. Video is evidence, not the frame-time source.',
        }
        report.checks.recording = true
      } catch (event) {
        error('clip-extraction', event)
      }
    }
    report.finished = new Date().toISOString()
    report.checks.noApplicationErrors = report.errors.length === 0
    report.pass =
      !!report.measurement &&
      report.checks.recording === true &&
      Object.values(report.checks).every(Boolean)
    await mkdir(path.dirname(reportPath), { recursive: true })
    await writeFile(reportPath, JSON.stringify(report, null, 2))
  }
  console.log(
    JSON.stringify(
      {
        pass: report.pass,
        checks: report.checks,
        measurement: report.measurement,
        artifacts: report.artifacts,
        report: path.relative(root, reportPath),
        errors: report.errors,
      },
      null,
      2,
    ),
  )
  assert.ok(report.pass, `Continuous ride failed; inspect ${path.relative(root, reportPath)}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main()
}
