import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: ['engine-init.spec.ts', 'onboarding.spec.ts'],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5181',
    ...devices['Desktop Chrome'],
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      args: ['--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5181',
    url: 'http://localhost:5181',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
