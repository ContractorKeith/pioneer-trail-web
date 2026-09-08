import { defineConfig, devices } from '@playwright/test'
const software = !!process.env.CI || process.env.TRAIL_SOFTWARE_TESTS === '1'
const headlessGpu = process.env.TRAIL_HEADLESS_GPU === '1'
export default defineConfig({
  testDir: './tests',
  testMatch: [
    'world.spec.ts',
    'onboarding.spec.ts',
    'recovery.spec.ts',
    'mechanics.spec.ts',
    'survival.spec.ts',
    'audio.spec.ts',
    'replay.spec.ts',
    'crossing-options.spec.ts',
    'spatial-activity.spec.ts',
    'runtime-decisions.spec.ts',
  ],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: software ? 900_000 : 90_000,
  expect: { timeout: software ? 15_000 : 5_000 },
  use: {
    baseURL: 'http://localhost:4173',
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: software
      ? {
          cookies: [],
          origins: [
            {
              origin: 'http://localhost:4173',
              localStorage: [
                {
                  name: 'pioneer-trail:settings:v2',
                  value: JSON.stringify({ quality: 'low' }),
                },
              ],
            },
          ],
        }
      : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: software ? { width: 640, height: 360 } : { width: 1280, height: 720 },
        headless: headlessGpu || process.env.TRAIL_HEADED !== '1',
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
          args: headlessGpu
            ? ['--ozone-platform=x11', '--enable-gpu']
            : process.env.TRAIL_HEADED === '1'
              ? ['--ozone-platform=x11']
              : ['--enable-unsafe-swiftshader'],
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: software ? { width: 640, height: 360 } : { width: 1280, height: 720 },
        // Firefox's native WebGL path needs the X display supplied by CI's Xvfb wrapper.
        headless: software ? false : undefined,
        launchOptions: software ? { firefoxUserPrefs: { 'webgl.force-enabled': true } } : undefined,
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --host 0.0.0.0 --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
