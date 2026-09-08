import { expect, test } from '@playwright/test'

test('cold concurrent engine creation keeps every Rust game independent', async ({ page }) => {
  await page.route('**/engine-cold-probe.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>cold engine probe</title>',
    }),
  )
  // Delay only the first wasm load window so every create reaches wasm-bindgen init together.
  await page.route('**/pioneer_trail_web_engine_bg.wasm', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150))
    await route.continue()
  })
  await page.goto('/engine-cold-probe.html')
  const games = await page.evaluate(async () => {
    const { TrailEngine } = await import('/src/engine.ts')
    const engines = await Promise.all(
      Array.from({ length: 8 }, (_, seed) => TrailEngine.create(String(seed))),
    )
    return engines.map((engine) => {
      const setup = engine.apply({
        Configure: {
          trail_id: 'oregon',
          era_id: '1848',
          occupation_id: 'banker',
          party: ['Ada', 'James', 'Ruth', 'Thomas', 'Clara'],
          departure_month: 3,
        },
      })
      const buy = engine.apply({ Buy: { item_id: 'food', quantity: 1 } })
      return { setup: setup.outcomes[0], buy: buy.outcomes[0], cash: engine.view().cash_cents }
    })
  })
  for (const game of games) {
    expect(game.setup).toBe('Configured')
    expect(game.buy).toEqual({ Purchased: { item_id: 'food', quantity: 1, cost_cents: 20 } })
    expect(game.cash).toBe(159_980)
  }
})
