import { defineConfig, devices } from '@playwright/test'
const software = !!process.env.CI || process.env.TRAIL_SOFTWARE_TESTS === '1'
const headlessGpu = process.env.TRAIL_HEADLESS_GPU === '1'

export default defineConfig({
  testDir: './tests',
  testMatch: ['engine-init.spec.ts', 'onboarding.spec.ts'],
  timeout: 90_000,
  workers: 1,
  retries: 0,
  expect: { timeout: software ? 15_000 : 5_000 },
  use: {
    baseURL: 'http://localhost:5181',
    ...devices['Desktop Chrome'],
    viewport: software ? { width: 640, height: 360 } : { width: 1280, height: 720 },
    storageState: software
      ? {
          cookies: [],
          origins: [
            {
              origin: 'http://localhost:5181',
              localStorage: [
                { name: 'pioneer-trail:settings:v2', value: JSON.stringify({ quality: 'low' }) },
              ],
            },
          ],
        }
      : undefined,
    headless: headlessGpu || process.env.TRAIL_HEADED !== '1',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      args: headlessGpu
        ? [...(process.platform === 'linux' ? ['--ozone-platform=x11'] : []), '--enable-gpu']
        : process.env.TRAIL_HEADED === '1'
          ? process.platform === 'linux'
            ? ['--ozone-platform=x11']
            : []
          : ['--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5181',
    url: 'http://localhost:5181',
    reuseExistingServer: false,
    timeout: 90_000,
  },
})
