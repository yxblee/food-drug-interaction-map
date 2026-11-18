import { expect, test, type Page } from '@playwright/test'

async function addMeds(page: Page, meds = ['simvastatin', 'Coumadin', 'Eliquis']) {
  await page.goto('./?tab=meds')
  const input = page.getByLabel('Add a medication')
  for (const m of meds) {
    await input.fill(m)
    await input.press('Enter')
  }
  await expect(page.locator('.warning').first()).toBeVisible()
}

test('Print pill appears only with a medication, and calls window.print()', async ({ page }) => {
  await page.goto('./?tab=meds')
  await expect(page.getByRole('button', { name: 'Print' })).toHaveCount(0)
  await page.evaluate(() => {
    const w = window as unknown as { printed: number }
    w.printed = 0
    window.print = () => {
      w.printed++
    }
  })
  await page.getByLabel('Add a medication').fill('warfarin')
  await page.getByLabel('Add a medication').press('Enter')
  await page.getByRole('button', { name: 'Print' }).click()
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1)
})

for (const scheme of ['light', 'dark'] as const) {
  test(`print (${scheme}): one document, ink on white, all groups open, sources as URLs`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await addMeds(page)
    await page.getByLabel('Add a medication').fill('Zzyzxine')
    await page.getByLabel('Add a medication').press('Enter')
    // Every row has fetched its advice by the time a person reaches for Print.
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.warning')].every((w) => w.querySelector('.irow')),
    )
    await page.emulateMedia({ media: 'print', colorScheme: scheme })
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))

    const r = await page.evaluate(() => {
      const q = (s: string) => [...document.querySelectorAll(s)]
      const vis = (el: Element) => {
        const b = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0
      }
      return {
        bg: getComputedStyle(document.body).backgroundColor,
        ink: getComputedStyle(document.body).color,
        visibleControls: [
          'header.app__bar',
          '.meds__actions',
          '.meds input',
          '.foodcheck',
          '.chip button',
        ].filter((s) => q(s).some(vis)),
        shown: ['.meds__printhead', '.app__footer-full', '.meds__unchecked'].filter((s) =>
          q(s).some(vis),
        ),
        text: document.body.innerText,
        openAll: q('.meds details, .app__footer details')
          .filter((d) => !(d as HTMLDetailsElement).open)
          .map((d) => d.className + '|' + d.parentElement?.className),
        urls: q('.irow__cites a').map((a) => ({
          href: (a as HTMLAnchorElement).href,
          after: getComputedStyle(a, '::after').content,
        })),
        clipped: q('html, body, #root, .app, .app__main, .app__panel, .meds')
          .filter((el) => {
            const cs = getComputedStyle(el)
            return /auto|scroll|hidden/.test(cs.overflowY) || cs.position === 'absolute'
          })
          .map((e) => e.className || e.tagName),
      }
    })
    expect(r.bg).toBe('rgb(255, 255, 255)')
    expect(r.ink).toBe('rgb(0, 0, 0)')
    expect(r.visibleControls).toEqual([])
    expect(r.shown).toEqual(['.meds__printhead', '.app__footer-full', '.meds__unchecked'])
    expect(r.text).toContain('Food–Drug Interaction Map')
    expect(r.text).toMatch(/Warfarin \(Coumadin\)/i)
    expect(r.text).toContain('Zzyzxine')
    expect(r.text).toContain('What to do:')
    expect(r.text).toMatch(/not medical advice/i)
    expect(r.openAll).toEqual([])
    expect(r.urls.length).toBeGreaterThan(0)
    for (const u of r.urls) expect(u.after).toBe(`"${u.href}"`)
    expect(r.clipped).toEqual([])
  })
}

test('print: PDF renders and nothing leaves the device', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one PDF run is enough')
  await addMeds(page)
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.warning')].every((w) => w.querySelector('.irow')),
  )
  const requests: string[] = []
  page.on('request', (req) => requests.push(req.url()))
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  const pdf = await page.pdf({ format: 'Letter' })
  expect(pdf.length).toBeGreaterThan(5000)
  expect(requests.filter((u) => !u.startsWith('http://localhost:4173/'))).toEqual([])
})
