import { expect, test, type Page } from '@playwright/test'
import { fixture, restore, resume, state } from './world.helpers'

async function resolveEncounterThenChooseRoute(page: Page, checkManualClose = false) {
  const before = await state(page)
  const event = before.view.pending_event!
  const choice = event.choices.find((candidate) => candidate.available)!
  expect(event).toBeTruthy()
  expect(choice).toBeTruthy()
  await expect(page.getByRole('heading', { name: 'Trail moment', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Choose the trail', exact: true })).toHaveCount(0)
  expect(before.paused).toBe(true)

  await page.getByRole('button', { name: choice.label, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose the trail', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Trail moment', exact: true })).toHaveCount(0)
  const resolved = await state(page)
  expect(resolved.view.pending_event).toBeNull()
  expect(resolved.view.status).toEqual(before.view.status)
  expect(resolved.regionIndex).toBe(before.regionIndex)
  expect(resolved.paused).toBe(true)

  if (checkManualClose) {
    await page.getByRole('button', { name: 'Close panel', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Choose the trail', exact: true })).toHaveCount(
      0,
    )
    await page.getByRole('button', { name: 'Party', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your party', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close panel', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Choose the trail', exact: true })).toHaveCount(
      0,
    )
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Choose the trail', exact: true })).toBeVisible()
    expect((await state(page)).regionIndex).toBe(before.regionIndex)
  }

  const route = resolved.view.routes.find(
    (candidate) => candidate.available !== false && candidate.id !== 'columbia',
  )!
  expect(route).toBeTruthy()
  await page
    .locator('.route-list button')
    .filter({ has: page.getByText(route.label, { exact: true }) })
    .click()
  await expect.poll(async () => (await state(page)).view.status).toBe('Travelling')
  const travelling = await state(page)
  expect(travelling.view.target_node_id).toBe(route.target_id)
  expect(travelling.view.route_miles_remaining).toBe(route.distance_miles)
  expect(travelling.regionIndex).toBe(before.regionIndex)
}

test('arriving at a fork resolves its simultaneous encounter before showing route choices', async ({
  page,
}) => {
  const checkpoint = await fixture('before-fork-event')
  await restore(page, checkpoint.raw)
  await resume(page)
  const before = await state(page)
  expect(before.view.status).toBe('Travelling')
  expect(before.view.pending_event).toBeNull()
  await page.keyboard.down('w')
  try {
    await expect
      .poll(async () => (await state(page)).view.pending_event, { timeout: 30_000 })
      .not.toBeNull()
  } finally {
    await page.keyboard.up('w')
  }
  const arrived = await state(page)
  expect(arrived.view.status).toHaveProperty('AwaitingFork')
  expect(arrived.view.day).toBe(before.view.day + 1)
  expect(arrived.regionIndex).toBe(before.regionIndex + 1)
  await resolveEncounterThenChooseRoute(page)
})

test('a saved fork encounter presents the deferred route after responding without another region reset', async ({
  page,
}) => {
  const checkpoint = await fixture('fork-event')
  await restore(page, checkpoint.raw)
  await resolveEncounterThenChooseRoute(page, true)
})
