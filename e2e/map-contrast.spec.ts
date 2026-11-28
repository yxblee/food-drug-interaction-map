import { expect, test, type Locator, type Page } from '@playwright/test'
import { waitForRouteHandlersAtTeardown } from './route-teardown.ts'

waitForRouteHandlersAtTeardown()

// Axe gives no contrast verdict ("incomplete") for text over the 2D map and the frosted controls.
// Here the screen is shot three times with the text under test painted black, white, then
// transparent: pixels that differ between black and white are the text's, and the transparent shot
// holds what is really behind them. The ratio asserted is the worst of those pixels against the
// computed text colour. Labels and controls take separate passes, so a control's backdrop still
// has the labels under it. Label pixels under a shape or control painted over the label are left
// out: that is not what is behind the text. WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text and glyph-only buttons.
// Control hairlines are not measured: each control is identified by its text or glyph
// (Understanding SC 1.4.11).

const PILL = '.explore__bar .pill-button'
// A pressed pill is opaque ink; the others are frosted and need their own parked pass.
const FROSTED_PILL = `${PILL}:not([aria-pressed='true'])`

const CONTROLS = [
  '.search__input',
  '.combo__clear',
  '.search__count',
  PILL,
  FROSTED_PILL,
  '.explore__hint',
  '.sev-filter__note p',
  '.legend summary',
  '.graph-zoom button',
  '.graph-status__notice',
]
// Dimmed nodes (15% opacity, DESIGN.md) are pushed back on purpose; their labels are not measured.
const LABELS = 'svg.graph2d g.node:not(.is-dim) text.label'
/** What can lie over the map. */
const OVERLAYS = '.explore__bar :is(input, button, p), .legend, .graph-zoom button, .panel'

const STATES = [
  { name: 'no selection', query: '?view=2d', has: ['.explore__hint', '.legend summary'] },
  { name: 'no selection, Color on', query: '?view=2d&tint=1', has: ['.explore__hint'] },
  { name: 'Food selected', query: '?view=2d&node=food:grapefruit', has: [] },
  {
    name: 'Food selected, Severities and Mechanisms off',
    query: '?view=2d&node=food:grapefruit&sev=avoid&mech=0',
    has: [FROSTED_PILL, '.sev-filter__note p'],
  },
  {
    name: 'Food selected while searching',
    query: '?view=2d&node=food:grapefruit&q=grape',
    has: ['.combo__clear', '.search__count'],
  },
  { name: 'Food selected, Color on', query: '?view=2d&node=food:grapefruit&tint=1', has: [] },
  { name: 'Drug selected, Color on', query: '?view=2d&node=drug:warfarin&tint=1', has: [] },
  {
    name: 'Mechanism selected, Color on',
    query: '?view=2d&node=mechanism:cyp3a4-inhibition&tint=1',
    has: [],
  },
  {
    name: 'search, Severities and Mechanisms off, Medication list',
    query: '?view=2d&q=simva&sev=avoid&mech=0&meds=1',
    has: ['.combo__clear', '.sev-filter__note p'],
    // The one match's label can run off a phone screen, where it is hidden.
    phoneLabels: false,
  },
]

type Box = { x: number; y: number; width: number; height: number }

interface Result {
  name: string
  selector: string
  ratio: number
  need: number
}

/**
 * Each match's worst contrast over the pixels its text covers. Matches with no such pixel on screen
 * (off it, or under an opaque surface) are left out.
 */
async function measure(page: Page, selectors: string[], clip?: Box): Promise<Result[]> {
  const targets = selectors.join(',')
  const shots: string[] = []
  for (const paint of ['black', 'white', 'hidden']) {
    await page.locator(targets).evaluateAll((all, p) => {
      for (const e of all) e.setAttribute('data-probe', p)
    }, paint)
    shots.push((await page.screenshot({ clip })).toString('base64'))
  }
  await page.locator(targets).evaluateAll((all) => {
    for (const e of all) e.removeAttribute('data-probe')
  })
  return page.evaluate(
    async ([pngs, selectors, area, overlays]) => {
      const canvas = new OffscreenCanvas(1, 1)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const decode = async (png: string) => {
        const img = new Image()
        img.src = `data:image/png;base64,${png}`
        await img.decode()
        return img
      }
      const [black, white, bg] = await Promise.all(pngs.map(decode))
      const scale = bg.width / (area?.width ?? innerWidth)
      const pixels = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
        canvas.width = w
        canvas.height = h
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h)
        return ctx.getImageData(0, 0, w, h).data
      }
      // Any CSS colour (the tokens compute to oklab) as sRGB plus alpha.
      const rgba = (colour: string) => {
        canvas.width = canvas.height = 1
        ctx.fillStyle = colour
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data]
      }
      const luminance = (rgb: number[]) => {
        const [r, g, b] = rgb.map((v) => {
          const c = v / 255
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const results: Result[] = []
      for (const selector of selectors)
        for (const e of document.querySelectorAll(selector)) {
          const style = getComputedStyle(e)
          if (style.visibility === 'hidden') continue
          const box = e.getBoundingClientRect()
          const [left, top] = [box.left - (area?.x ?? 0), box.top - (area?.y ?? 0)]
          const x = Math.max(0, Math.floor(left * scale))
          const y = Math.max(0, Math.floor(top * scale))
          const w = Math.min(bg.width, Math.ceil((left + box.width) * scale)) - x
          const h = Math.min(bg.height, Math.ceil((top + box.height) * scale)) - y
          if (w <= 0 || h <= 0) continue
          const onBlack = pixels(black, x, y, w, h)
          const onWhite = pixels(white, x, y, w, h)
          const behindAll = pixels(bg, x, y, w, h)
          const colour = rgba(
            e instanceof SVGElement
              ? style.fill
              : e instanceof HTMLInputElement && !e.value
                ? getComputedStyle(e, '::placeholder').color
                : style.color,
          )
          let alpha = colour[3] / 255
          for (let n: Element | null = e; n; n = n.parentElement)
            alpha *= Number(getComputedStyle(n).opacity)
          // Painted over a label: the shapes of nodes after its own, and the controls.
          const above = !(e instanceof SVGElement)
            ? []
            : [...document.querySelectorAll(`svg.graph2d :is(.shape, .shape-ring), ${overlays}`)]
                .filter(
                  (o) =>
                    !(o instanceof SVGElement) ||
                    (!e.parentElement!.contains(o) &&
                      e.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING),
                )
                .map((o) => o.getBoundingClientRect())
          const covered = (px: number, py: number) =>
            above.some(
              (r) => px > r.left - 1 && px < r.right + 1 && py > r.top - 1 && py < r.bottom + 1,
            )
          let ratio = Infinity
          for (let i = 0; i < behindAll.length; i += 4) {
            // Covered at least half: skips anti-aliased fringes and what only shows through a blur.
            if (Math.max(...[0, 1, 2].map((c) => onWhite[i + c] - onBlack[i + c])) < 128) continue
            const [col, row] = [(i / 4) % w, Math.floor(i / 4 / w)]
            if (covered((x + col) / scale + (area?.x ?? 0), (y + row) / scale + (area?.y ?? 0)))
              continue
            const behind = [behindAll[i], behindAll[i + 1], behindAll[i + 2]]
            const text = behind.map((v, c) => colour[c] * alpha + v * (1 - alpha))
            const [hi, lo] = [luminance(text), luminance(behind)].sort((a, b) => b - a)
            ratio = Math.min(ratio, (hi + 0.05) / (lo + 0.05))
          }
          if (ratio === Infinity) continue
          const size = parseFloat(style.fontSize)
          const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
          // A button with no letter or digit in it is a glyph: a UI component, not text.
          const glyph = e.matches('button') && !/[\p{L}\p{N}]/u.test(e.textContent ?? '')
          const label = (e.getAttribute('aria-label') ?? e.textContent ?? '').slice(0, 40)
          results.push({
            name: `${selector} "${label}"`,
            selector,
            ratio,
            need: large || glyph ? 3 : 4.5,
          })
        }
      return results
    },
    [shots, selectors, clip, OVERLAYS] as const,
  )
}

const failing = (results: Result[]) =>
  results.filter((r) => r.ratio < r.need).map((r) => `${r.name}: ${r.ratio.toFixed(2)} < ${r.need}`)

async function openMap(page: Page, query: string) {
  await page.addInitScript(() => localStorage.setItem('fdi:meds', '["warfarin","simvastatin"]'))
  await page.goto(`./${query}`)
  await expect(page.locator('svg.graph2d g.node').first()).toBeAttached({ timeout: 20_000 })
  if (query.includes('node=')) {
    await expect(page.getByRole('complementary').locator('li.irow').first()).toBeVisible()
    await expect(page.locator('svg.graph2d g.node.is-selected')).toHaveCount(1)
  }
  // Nothing moving, and the film grain off: it lies over text and background alike.
  await page.addStyleTag({
    content: `
      *, *::before, *::after { transition: none !important }
      body::before { display: none }
      [data-probe='black'], [data-probe='black'] *, [data-probe='black']::placeholder,
      [data-probe='black'] *::before { color: #000 !important }
      [data-probe='white'], [data-probe='white'] *, [data-probe='white']::placeholder,
      [data-probe='white'] *::before { color: #fff !important }
      [data-probe='hidden'], [data-probe='hidden'] *, [data-probe='hidden']::placeholder,
      [data-probe='hidden'] *::before { color: transparent !important }
      text[data-probe='black'] { fill: #000 !important }
      text[data-probe='white'] { fill: #fff !important }
      text[data-probe='hidden'] { fill: transparent !important }
      input[data-probe] { caret-color: transparent }
    `,
  })
  // The map's fit runs on a short timer after the data and the panel land.
  let last: string | null = null
  await expect
    .poll(
      async () => {
        const now = await page.locator('svg.graph2d > g').getAttribute('transform')
        const still = now !== null && now === last
        last = now
        return still
      },
      { intervals: [300], timeout: 20_000 },
    )
    .toBe(true)
}

/**
 * Moves the map, at its closest zoom, so a node sits behind the start of a control's text: the
 * selected (solid ink) one, the hardest backdrop a person can drag there, or with no selection any
 * undimmed one. Returns whether the node landed there.
 */
async function parkNode(page: Page, box: Box) {
  return page.evaluate(
    ([x, y]) => {
      const svg = document.querySelector<SVGSVGElement>('svg.graph2d')!
      const node =
        svg.querySelector<SVGGElement>('g.node.is-selected') ??
        svg.querySelector<SVGGElement>('g.node:not(.is-dim)')!
      const at = node.transform.baseVal.consolidate()!.matrix
      const r = svg.getBoundingClientRect()
      // 4 is render2d's closest zoom; the viewBox puts 0,0 at the centre.
      const tx = x - (r.x + r.width / 2) - 4 * at.e
      const ty = y - (r.y + r.height / 2) - 4 * at.f
      svg.style.setProperty('--k', '4')
      svg.querySelector(':scope > g')!.setAttribute('transform', `translate(${tx},${ty}) scale(4)`)
      const at2 = node.querySelector('.shape')!.getBoundingClientRect()
      return at2.left <= x && x <= at2.right && at2.top <= y && y <= at2.bottom
    },
    [box.x + Math.min(box.width / 2, 28), box.y + box.height / 2],
  )
}

/** Failures for the first visible match of `selector` with a node parked behind it. */
async function measureParked(page: Page, selector: string) {
  const control = page.locator(selector).filter({ visible: true }).first()
  const box = (await control.count()) ? await control.boundingBox() : null
  if (!box) return []
  expect(await parkNode(page, box), `node behind ${selector}`).toBe(true)
  const results = await measure(page, [selector], box)
  expect(results, `measured behind ${selector}`).not.toHaveLength(0)
  return failing(results).map((f) => `node behind ${f}`)
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`map text contrast, ${colorScheme}`, () => {
    test.use({ colorScheme, contextOptions: { reducedMotion: 'reduce' } })
    // Screenshots on software GL are slow.
    test.slow()

    for (const state of STATES) {
      test(`labels and controls: ${state.name}`, async ({ page }, info) => {
        await openMap(page, state.query)
        const results = [...(await measure(page, [LABELS])), ...(await measure(page, CONTROLS))]
        const measured = new Set(results.map((r) => r.selector))
        // Guards against a vacuous pass.
        const labels = info.project.name !== 'mobile' || state.phoneLabels !== false
        for (const selector of [
          ...(labels ? [LABELS] : []),
          PILL,
          '.search__input',
          '.graph-zoom button',
          ...state.has,
        ])
          expect([...measured], 'measured').toContain(selector)
        const failures = failing(results)
        // One control per selector: its siblings share the backdrop recipe and colours.
        for (const selector of CONTROLS)
          if (measured.has(selector)) failures.push(...(await measureParked(page, selector)))
        // One line per element, however many passes it failed.
        expect([...new Set(failures)]).toEqual([])
      })
    }

    test('the 3D-failed notice', async ({ page }, info) => {
      test.skip(info.project.name === 'mobile', '3D is desktop only')
      await page.route(/render3d/, (route) => route.abort())
      await openMap(page, '?view=3d&node=food:grapefruit')
      const results = await measure(page, ['.graph-status__notice'])
      expect(results).toHaveLength(1)
      expect([
        ...failing(results),
        ...(await measureParked(page, '.graph-status__notice')),
      ]).toEqual([])
    })
  })
}

test('every glyph-only button in Explore has an accessible name', async ({ page }) => {
  // A selection and a typed query together show every glyph: zoom, clear and the panel's three.
  await openMap(page, '?view=2d&node=food:grapefruit&q=grape')
  const glyphs: Locator[] = []
  for (const button of await page.locator('.explore button').filter({ visible: true }).all())
    if (!/[\p{L}\p{N}]/u.test(await button.innerText())) glyphs.push(button)
  // Zoom in, out and reset; clear search; previous, next and close.
  expect(glyphs).toHaveLength(7)
  for (const button of glyphs) await expect(button).toHaveAccessibleName(/\p{L}/u)
})
