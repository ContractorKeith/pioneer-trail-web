import { expect, test } from '@playwright/test'
import { letterDeliveryCheckpoint, rareCheckpoint } from './survival.helpers'
import { fixture, restore, resume, start, state, walkTo, WORLD_KEY } from './world.helpers'

async function openCamp(page: Parameters<typeof state>[0]) {
  await page.keyboard.press('e')
  await expect.poll(async () => (await state(page)).mode).toBe('walking')
  await walkTo(page, -6.8, 20)
  await expect.poll(async () => (await state(page)).interaction?.kind).toBe('camp')
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { name: 'Camp', exact: true })).toBeVisible()
}

async function openCompanionConversation(page: Parameters<typeof state>[0]) {
  await page.keyboard.press('e')
  await expect.poll(async () => (await state(page)).mode).toBe('walking')
  await walkTo(page, -4.9, 27)
  await expect.poll(async () => (await state(page)).interaction?.kind).toBe('companion')
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { name: 'Conversation', exact: true })).toBeVisible()
}

test('R08 camp management changes ration and pace settings, gathers food, and rests', async ({
  page,
}) => {
  await restore(page, (await fixture('camp')).raw)
  await resume(page)
  await openCamp(page)

  const initialCamp = await state(page)
  await page.getByLabel('Pace').selectOption('Grueling')
  await page.getByLabel('Rations').selectOption('BareBones')
  const configured = await state(page)
  expect(configured.view.pace).toBe('Grueling')
  expect(configured.view.rations).toBe('BareBones')
  expect(configured.view.daily_food_lbs).toBeLessThan(initialCamp.view.daily_food_lbs)

  await page.getByRole('button', { name: 'Forage', exact: true }).click()
  const foraged = await state(page)
  expect(foraged.view.day).toBe(configured.view.day + 1)
  expect(foraged.view.inventory.food).toBeGreaterThan(configured.view.inventory.food)
  expect(foraged.view.has_fresh_food).toBe(true)

  await page.getByRole('button', { name: 'Rest one day', exact: true }).click()
  const rested = await state(page)
  expect(rested.view.day).toBe(foraged.view.day + 1)
  expect(rested.view.inventory.food).toBeLessThan(foraged.view.inventory.food)
})

test('R08 repairs a mandatory wagon failure through the physical camp flow', async ({ page }) => {
  await restore(page, (await fixture('repair')).raw)
  await expect(page.getByRole('heading', { name: 'Trail moment', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close panel' }).click()
  await resume(page)
  await openCamp(page)
  const damaged = await state(page)
  expect(damaged.view.can_repair).toBe(true)
  expect(damaged.view.pending_event).not.toBeNull()
  const spareParts = ['wheel', 'axle', 'tongue'].reduce(
    (total, item) => total + (damaged.view.inventory[item] ?? 0),
    0,
  )
  await page.getByRole('button', { name: 'Repair wagon', exact: true }).click()
  const repaired = await state(page)
  expect(repaired.view.day).toBe(damaged.view.day + 1)
  expect(repaired.view.can_repair).toBe(false)
  expect(
    ['wheel', 'axle', 'tongue'].reduce(
      (total, item) => total + (repaired.view.inventory[item] ?? 0),
      0,
    ),
  ).toBe(spareParts - 1)
  expect(repaired.view.pending_event).toBeNull()
})

test('R08 treats an ill companion after approaching them in the world', async ({ page }) => {
  await restore(page, (await rareCheckpoint('illness')).raw)
  await resume(page)
  await openCompanionConversation(page)
  await page.getByRole('button', { name: 'Close panel' }).click()
  const ill = await state(page)
  const member = ill.view.party.find((candidate) => candidate.ailments.length > 0)!
  const ailment = member.ailments[0]
  const medicine = ill.view.inventory.medicine
  const health = member.health
  await page.getByRole('button', { name: 'Party', exact: true }).click()
  await page
    .getByRole('button', { name: new RegExp(`^Treat ${ailment.replace('_', ' ')}`, 'i') })
    .click()
  const treated = await state(page)
  const recovered = treated.view.party.find((candidate) => candidate.name === member.name)!
  expect(recovered.ailments).not.toContain(ailment)
  expect(recovered.health).toBe(Math.min(100, health + 15))
  expect(treated.view.inventory.medicine).toBe(medicine - 1)
})

test('R09 accepts a letter in conversation, delivers it at its destination once, and retains payment on reload', async ({
  page,
}) => {
  await restore(page, (await rareCheckpoint('letter')).raw)
  await resume(page)
  await openCompanionConversation(page)

  const beforeConversation = await state(page)
  const letter = beforeConversation.view.offered_letter!
  expect(letter).not.toBeNull()
  for (const topic of ['Route', 'Supplies', 'News']) {
    await page.getByRole('button', { name: topic, exact: true }).click()
    await expect(page.locator('.conversation-reply')).not.toBeEmpty()
  }
  expect((await state(page)).view.day).toBe(beforeConversation.view.day)
  await page.getByRole('button', { name: 'Carry it', exact: true }).click()
  await expect.poll(async () => (await state(page)).view.active_letter).not.toBeNull()
  expect((await state(page)).view.offered_letter).toBeNull()
  expect((await state(page)).view.can_deliver_letter).toBe(false)
  await expect(page.getByRole('button', { name: 'Deliver letter', exact: true })).toHaveCount(0)
  const acceptedLetter = (await state(page)).view.active_letter
  await page.reload()
  await resume(page)
  expect((await state(page)).view.active_letter).not.toBeNull()
  expect((await state(page)).view.active_letter).toEqual(acceptedLetter)

  // Only the journey to the rare destination is arranged; acceptance and delivery use real UI.
  const acceptedRaw = await page.evaluate((key) => localStorage.getItem(key), WORLD_KEY)
  expect(acceptedRaw).not.toBeNull()
  const destination = await letterDeliveryCheckpoint(acceptedRaw!)
  expect(destination.view.current_node?.id).toBe(letter.destination_id)
  expect(destination.view.active_letter).toEqual(acceptedLetter)
  await restore(page, destination.raw)
  await resume(page)
  await openCompanionConversation(page)
  const beforeDelivery = await state(page)
  expect(beforeDelivery.view.can_deliver_letter).toBe(true)
  await expect(page.locator('.letter')).toContainText(letter.recipient)
  await page.getByRole('button', { name: 'Deliver letter', exact: true }).click()
  const delivered = await state(page)
  expect(delivered.view.active_letter).toBeNull()
  expect(delivered.view.can_deliver_letter).toBe(false)
  expect(delivered.view.cash_cents).toBe(beforeDelivery.view.cash_cents + letter.reward_cents)
  expect(delivered.view.day).toBe(beforeDelivery.view.day)
  expect(delivered.view.inventory).toEqual(beforeDelivery.view.inventory)
  expect(delivered.regionIndex).toBe(beforeDelivery.regionIndex)
  await expect(page.getByRole('button', { name: 'Deliver letter', exact: true })).toHaveCount(0)

  const deliveryText = `Delivered the sealed letter to ${letter.recipient} at ${destination.view.current_node!.name}`
  expect(
    delivered.view.journal.filter((entry) => entry.text.startsWith(deliveryText)),
  ).toHaveLength(1)
  await page.getByRole('button', { name: 'Close panel' }).click()
  await page.getByRole('button', { name: 'Journal', exact: true }).click()
  await expect(page.locator('.journal-list li').filter({ hasText: deliveryText })).toHaveCount(1)
  await page.reload()
  await resume(page)
  const reloaded = await state(page)
  expect(reloaded.view.active_letter).toBeNull()
  expect(reloaded.view.can_deliver_letter).toBe(false)
  expect(reloaded.view.cash_cents).toBe(delivered.view.cash_cents)
  expect(reloaded.view.day).toBe(delivered.view.day)
  expect(reloaded.view.journal.filter((entry) => entry.text.startsWith(deliveryText))).toHaveLength(
    1,
  )
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { name: 'Conversation', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Deliver letter', exact: true })).toHaveCount(0)
})

test('R09 recruits a traveler, parts ways through the party panel, and preserves the dismissal on reload', async ({
  page,
}) => {
  await restore(page, (await fixture('trader')).raw)
  await resume(page)
  await page.keyboard.press('e')
  await expect.poll(async () => (await state(page)).mode).toBe('walking')
  await walkTo(page, -3, 14)
  await walkTo(page, 5, 14)
  await walkTo(page, 6, 27)
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { name: 'Trade', exact: true })).toBeVisible()
  const beforeRecruit = await state(page)
  const invite = page.getByRole('button', { name: /^Invite / })
  await expect(invite).toBeEnabled()
  await invite.click()
  const recruited = await state(page)
  expect(recruited.view.party).toHaveLength(beforeRecruit.view.party.length + 1)
  expect(recruited.view.available_party_slots).toBe(beforeRecruit.view.available_party_slots - 1)
  expect(recruited.view.party.some((member) => member.npc_id)).toBe(true)
  const companion = recruited.view.party.find(
    (member) => !beforeRecruit.view.party.some((previous) => previous.name === member.name),
  )!
  expect(companion.npc_id).toBeTruthy()
  await page.getByRole('button', { name: 'Close panel' }).click()
  await page.getByRole('button', { name: 'Party', exact: true }).click()
  const companionRow = page.locator('.party-list li').filter({
    has: page.getByText(companion.name, { exact: true }),
  })
  await expect(companionRow).toBeVisible()
  await companionRow.getByRole('button', { name: 'Part ways', exact: true }).click()
  const dismissed = await state(page)
  expect(dismissed.view.party).toHaveLength(beforeRecruit.view.party.length)
  expect(dismissed.view.party.map((member) => member.name)).toEqual(
    beforeRecruit.view.party.map((member) => member.name),
  )
  expect(dismissed.view.party.some((member) => member.npc_id === companion.npc_id)).toBe(false)
  expect(dismissed.view.available_party_slots).toBe(recruited.view.available_party_slots + 1)
  expect(dismissed.view.cash_cents).toBe(recruited.view.cash_cents)
  expect(dismissed.view.inventory).toEqual(recruited.view.inventory)
  expect(dismissed.view.day).toBe(recruited.view.day)
  await expect(companionRow).toHaveCount(0)
  const departureText = `${companion.name} left the party.`
  expect(dismissed.view.journal.filter((entry) => entry.text === departureText)).toHaveLength(1)
  await page.reload()
  await resume(page)
  const reloaded = await state(page)
  expect(reloaded.view.party).toEqual(dismissed.view.party)
  expect(reloaded.view.available_party_slots).toBe(beforeRecruit.view.available_party_slots)
  expect(reloaded.view.cash_cents).toBe(dismissed.view.cash_cents)
  expect(reloaded.view.day).toBe(dismissed.view.day)
  expect(reloaded.view.journal.filter((entry) => entry.text === departureText)).toHaveLength(1)
  await page.getByRole('button', { name: 'Party', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your party', exact: true })).toBeVisible()
  await expect(companionRow).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Part ways', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close panel' }).click()
  await page.getByRole('button', { name: 'Journal', exact: true }).click()
  await expect(page.locator('.journal-list li').filter({ hasText: departureText })).toHaveCount(1)
})

test('R13 exposes usable landscape coarse-pointer controls', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
  })
  const touchPage = await context.newPage()
  try {
    await start(touchPage)
    expect(await touchPage.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    const controls = touchPage.getByRole('region', { name: 'Touch controls' })
    await expect(controls).toBeVisible()
    const beforeMove = await state(touchPage)
    const forward = touchPage.getByRole('button', { name: 'Forward', exact: true })
    const box = await forward.boundingBox()
    if (!box) throw new Error('The visible Forward control has no bounds')
    await touchPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await touchPage.mouse.down()
    await touchPage.waitForTimeout(1200)
    await touchPage.mouse.up()
    expect((await state(touchPage)).wagon.z).toBeGreaterThan(beforeMove.wagon.z + 1)
  } finally {
    await context.close()
  }
})

test('R13 supports desktop drag look and pointer lock recovery', async ({ page }) => {
  await start(page)
  const canvas = page.getByLabel(/Pioneer Trail 3D world/)
  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) throw new Error('World canvas has no bounds')
  const beforeDrag = (await state(page)).heading
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + canvasBox.width / 2 + 140, canvasBox.y + canvasBox.height / 2)
  await page.mouse.up()
  await expect
    .poll(async () => Math.abs((await state(page)).heading - beforeDrag))
    .toBeGreaterThan(0.1)

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Look controls').selectOption('pointer')
  await page.getByRole('button', { name: 'Close panel' }).click()
  await canvas.click()
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.tagName), { timeout: 5000 })
    .toBe('CANVAS')
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull()
  await expect.poll(async () => (await state(page)).paused).toBe(true)
})
