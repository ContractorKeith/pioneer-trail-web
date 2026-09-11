import { expect, test } from '@playwright/test'
import { aimAt, fixture, hold, restore, resume, state, walkTo, world } from './world.helpers'

test('hunting uses moving 3D targets, misses, reloads, retrieves game and survives interruption', async ({
  page,
}) => {
  await restore(page, (await fixture('camp')).raw)
  await resume(page)
  await page.keyboard.press('e')
  await expect.poll(async () => (await state(page)).mode).toBe('walking')
  // Move clear of the wagon before aiming across the hunting ground.
  await walkTo(page, -4, 34)
  const first = (await world(page)).wildlife.find((a) => a.animal === 'Deer')!
  await page.waitForTimeout(400)
  expect((await world(page)).wildlife.find((a) => a.id === first.id)!.position).not.toEqual(
    first.position,
  )
  await page.keyboard.press('h')
  const before = (await state(page)).view
  await aimAt(page, { x: -4, y: 80, z: 50 })
  expect(
    await page.evaluate(
      () =>
        JSON.parse((window as unknown as { __trail: { save(): string } }).__trail.save()).spatial
          .player.pitch as number,
    ),
  ).toBeGreaterThan(1.1)
  await page.keyboard.press('Space')
  await expect(page.locator('.notice')).toContainText('Miss')
  expect((await state(page)).view.activity?.shots).toBe(1)
  await page.keyboard.press('Space')
  expect((await state(page)).view.activity?.shots).toBe(1)
  await page.keyboard.press('r')
  await expect.poll(async () => (await state(page)).activity?.phase).toBe('aiming')
  let killed: Awaited<ReturnType<typeof world>>['wildlife'][number] | undefined
  for (let shot = 0; shot < 5; shot++) {
    const target = (await world(page)).wildlife
      .filter((a) => a.alive && a.animal === 'Deer')
      .sort(
        (a, b) =>
          Math.hypot(a.position.x + 4, a.position.z - 34) -
          Math.hypot(b.position.x + 4, b.position.z - 34),
      )[0]
    await aimAt(page, target.position)
    await aimAt(page, (await world(page)).wildlife.find((a) => a.id === target.id)!.position)
    await page.keyboard.press('Space')
    killed = (await world(page)).wildlife.find((a) => !a.alive && !a.harvested)
    if (killed) break
    await page.keyboard.press('r')
    await expect.poll(async () => (await state(page)).activity?.phase).toBe('aiming')
  }
  expect(killed, 'a ray aimed through the visible deer torso must hit').toBeTruthy()
  const shots = (await state(page)).view.activity!.shots
  await page.reload()
  await resume(page)
  expect((await state(page)).view.activity!.shots).toBe(shots)
  expect((await world(page)).wildlife.find((a) => a.id === killed!.id)!.alive).toBe(false)
  await walkTo(page, killed!.position.x, killed!.position.z - 1)
  await page.keyboard.press('e')
  expect((await state(page)).view.activity!.food_lbs).toBeGreaterThan(0)
  const food = (await state(page)).view.activity!.food_lbs
  await page.keyboard.press('e')
  expect((await state(page)).view.activity!.food_lbs).toBe(food)
  await page.keyboard.press('x')
  const after = (await state(page)).view
  expect(after.activity).toBeNull()
  expect(after.day).toBe(before.day + 1)
  expect(after.ammunition_available).toBe(before.ammunition_available! - shots)
  expect(after.inventory.food).toBe(before.inventory.food + food - 15)
})

test('a modeled trader supports buy, sell, flexible barter and returns to the world', async ({
  page,
}) => {
  await restore(page, (await fixture('trader')).raw)
  await resume(page)
  await page.keyboard.press('e')
  await walkTo(page, -3, 14)
  await walkTo(page, 5, 14)
  const trader = (await world(page)).locations.find((location) => location.id === 'trader')!
  // Stop comfortably inside the interaction radius; walkTo intentionally permits a 0.45 m tolerance.
  await walkTo(page, trader.position[0] - 2, trader.position[2] - 1)
  await expect.poll(async () => (await state(page)).interaction?.label).toBe('E · Trail trader')
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { name: 'Trade', exact: true })).toBeVisible()
  const before = (await state(page)).view
  const food = page
    .locator('.trade-list li')
    .filter({ has: page.getByText('Food', { exact: true }) })
  await page.getByLabel('Quantity', { exact: true }).fill('10')
  await food.getByRole('button', { name: 'Buy', exact: true }).click()
  await expect
    .poll(async () => (await state(page)).view.inventory.food)
    .toBe(before.inventory.food + 10)
  expect((await state(page)).view.cash_cents).toBeLessThan(before.cash_cents)
  await food.getByRole('button', { name: 'Sell', exact: true }).click()
  expect((await state(page)).view.inventory.food).toBe(before.inventory.food)
  const partners = (await state(page)).view.npcs as Array<{
    id: string
    name: string
    inventory: Record<string, number>
  }>
  expect(partners.length).toBeGreaterThan(0)
  await page.getByLabel('Trading partner').selectOption(partners.at(-1)!.id)
  await page.getByRole('combobox', { name: 'You offer', exact: true }).selectOption('clothing')
  await page.getByLabel('Offer quantity', { exact: true }).fill('1')
  await page.getByRole('combobox', { name: 'You request', exact: true }).selectOption('food')
  await page.getByLabel('Request quantity', { exact: true }).fill('80')
  const beforeBarter = (await state(page)).view
  await page.getByRole('button', { name: 'Propose trade' }).click()
  await expect(page.locator('.notice')).toBeVisible()
  const counter = (await state(page)).view.pending_counteroffer
  expect(counter).not.toBeNull()
  expect(counter!.wanted_quantity).toBe(80)
  expect(counter!.offered_quantity).toBeGreaterThan(1)
  await expect(page.locator('.counteroffer')).toContainText(`Give ${counter!.offered_quantity}`)
  await page.getByRole('button', { name: 'Accept counteroffer' }).click()
  const afterBarter = (await state(page)).view
  expect(afterBarter.pending_counteroffer).toBeNull()
  expect(afterBarter.inventory.food).toBe(beforeBarter.inventory.food + counter!.wanted_quantity)
  expect(afterBarter.inventory.clothing).toBe(
    beforeBarter.inventory.clothing - counter!.offered_quantity,
  )
  const tradedPartner = (afterBarter.npcs as typeof partners).find(
    (partner) => partner.id === counter!.npc_id,
  )!
  expect(tradedPartner.inventory.food).toBe(
    partners.at(-1)!.inventory.food - counter!.wanted_quantity,
  )
  expect(tradedPartner.inventory.clothing).toBe(
    (partners.at(-1)!.inventory.clothing ?? 0) + counter!.offered_quantity,
  )
  expect(afterBarter.cash_cents).toBe(beforeBarter.cash_cents)
  await page.getByRole('button', { name: 'Close panel' }).click()
  const position = (await state(page)).position
  await hold(page, 's', 500)
  expect((await state(page)).position).not.toEqual(position)
})
