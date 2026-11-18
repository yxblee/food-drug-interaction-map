import { expect, test, type Page } from '@playwright/test'

// The real Dataset has no Helpful pairings yet. These two are test fixtures, injected into the
// static payloads the app fetches; nothing under data/ carries them.
const fixture = (food: string, drug: string) => ({
  id: `${food}--${drug}`,
  food,
  drug,
  mechanisms: [],
  summary: `Fixture summary for ${food} and ${drug}.`,
  advice: `Fixture: the label describes taking ${drug} with ${food}.`,
  citations: [
    {
      type: 'label',
      title: 'Fixture label',
      url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=fixture',
    },
  ],
  status: 'approved',
  source: 'curated',
  reviewed_at: '2026-11-17',
})
const FIXTURES = [fixture('a-meal', 'metformin'), fixture('aged-cheeses', 'metformin')]

type Node = { kind: string; id: string }
const node = (kind: string, id: string, name: string, group = false) => ({
  kind,
  id,
  name,
  aliases: [],
  group,
})
const NODES: Record<string, unknown> = {
  'a-meal': node('food', 'a-meal', 'A meal'),
  'aged-cheeses': node('food', 'aged-cheeses', 'Aged cheeses', true),
  metformin: node('drug', 'metformin', 'Metformin'),
}
type Payload = { nodes?: Record<string, Node> | Node[]; pairings: unknown[] }

async function withFixturePairings(page: Page) {
  await page.route('**/api/graph.json', async (route) => {
    const body = (await (await route.fetch()).json()) as Payload
    body.pairings = FIXTURES
    await route.fulfill({ json: body })
  })
  await page.route(/\/api\/node\/(drug|food)\/[^/]+\.json$/, async (route) => {
    const res = await route.fetch()
    const [, kind, id] = /\/node\/(drug|food)\/([^/]+)\.json$/.exec(route.request().url())!
    const body = (await res.json()) as Payload & { nodes: Record<string, unknown> }
    const mine = FIXTURES.filter((p) => (kind === 'drug' ? p.drug : p.food) === id)
    body.pairings = mine.map((pairing) => ({ pairing }))
    for (const p of mine) {
      body.nodes[`food:${p.food}`] = NODES[p.food]
      body.nodes[`drug:${p.drug}`] = NODES[p.drug]
    }
    await route.fulfill({ json: body })
  })
}

async function addMeds(page: Page, meds: string[]) {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  for (const m of meds) {
    await input.fill(m)
    await input.press('Enter')
  }
}

test('My meds lists Helps to take with, below Foods to watch, with Sources and no Severity', async ({
  page,
}) => {
  await withFixturePairings(page)
  await addMeds(page, ['metformin'])
  const helps = page.locator('section.meds__helps')
  await expect(helps.getByRole('heading', { name: 'Helps to take with' })).toBeVisible()
  const row = helps.locator('li.irow', { hasText: 'A meal' })
  await expect(row).toContainText('Fixture summary for a-meal and metformin.')
  await expect(row).toContainText('What the source says:')
  await expect(helps.locator('.badge')).toHaveCount(0)
  await row.locator('summary').click()
  await expect(row.getByRole('link', { name: /Fixture label/ })).toBeVisible()

  // Under Foods to watch, before Food check.
  const order = await page.evaluate(() => {
    const at = (s: string) => document.querySelector(s)!.getBoundingClientRect().top
    return [at('#results-title'), at('#helps-title'), at('.foodcheck')]
  })
  expect(order).toEqual([...order].sort((a, b) => a - b))
})

test('My meds shows nothing extra when no listed Drug has a pairing', async ({ page }) => {
  await withFixturePairings(page)
  await addMeds(page, ['warfarin'])
  await expect(page.getByRole('heading', { name: 'Foods to watch' })).toBeVisible()
  await expect(page.locator('section.meds__helps')).toHaveCount(0)
})

test('a warning says when its Food helps another listed Drug, and stays in full', async ({
  page,
}) => {
  await withFixturePairings(page)
  await addMeds(page, ['linezolid', 'metformin'])
  const row = page
    .locator('section.meds__sev:not(.meds__helps) li.warning', { hasText: 'Aged cheeses' })
    .first()
  await expect(row).toContainText('This does not change the warning above')
  await expect(row.locator('.warning__note')).toContainText('Metformin')
  // The warning itself is still there, with its advice.
  await expect(row.locator('.irow__advice').first()).toBeVisible()
  await expect(row.locator('.irow__summary').first()).toBeVisible()
})

test('the Explore panel lists Helpful pairings for a Food and for a Drug', async ({ page }) => {
  await withFixturePairings(page)
  await page.goto('./?node=food%3Aa-meal')
  const panel = page.getByRole('complementary')
  const pairs = panel.locator('section.panel__pairs')
  await expect(pairs.getByRole('heading', { name: /Helpful pairings/ })).toBeVisible()
  await expect(pairs.locator('li.irow')).toContainText('Metformin')
  await expect(pairs.locator('.badge')).toHaveCount(0)

  await page.goto('./?node=drug%3Ametformin')
  await expect(
    page.getByRole('complementary').locator('section.panel__pairs li.irow').first(),
  ).toContainText(/A meal|Aged cheeses/)
})

test('without pairings, the Explore panel has no Helpful pairings section', async ({ page }) => {
  await page.goto('./?node=food%3Agrapefruit')
  await expect(
    page.getByRole('complementary').getByRole('heading', { name: 'Grapefruit' }),
  ).toBeVisible()
  await expect(page.locator('section.panel__pairs')).toHaveCount(0)
})

test('Helps to take with prints with its Sources', async ({ page }) => {
  await withFixturePairings(page)
  await addMeds(page, ['metformin'])
  await page.emulateMedia({ media: 'print' })
  const helps = page.locator('section.meds__helps')
  await expect(helps.getByRole('heading', { name: 'Helps to take with' })).toBeVisible()
  await expect(helps.locator('.irow__cites a').first()).toBeVisible()
  await expect(helps.locator('.irow__more > summary').first()).toBeHidden()
})
