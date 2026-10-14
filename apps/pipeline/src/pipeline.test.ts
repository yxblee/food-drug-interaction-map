import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'
import { parse } from 'yaml'
import type { RawDataset } from '@fdi/schema'
import { runPipeline, type Draft, type DraftInput, type Label, type Ports } from './pipeline.ts'

const fixtures: Record<string, Label[]> = JSON.parse(
  readFileSync(new URL('./fixtures/openfda.json', import.meta.url), 'utf8'),
)

const drug = (id: string, extra: Record<string, unknown> = {}) => ({
  file: `drugs/${id}.yaml`,
  data: { id, name: id[0].toUpperCase() + id.slice(1), ...extra },
})
const food = (id: string, extra: Record<string, unknown> = {}) => ({
  file: `foods/${id}.yaml`,
  data: { id, name: id[0].toUpperCase() + id.slice(1), category: 'other', ...extra },
})
const interaction = (id: string, extra: Record<string, unknown> = {}) => {
  const [f, d] = id.split('--')
  return {
    file: `interactions/${id}.yaml`,
    data: {
      id,
      food: f,
      drug: d,
      mechanisms: ['cyp3a4-inhibition'],
      severity: 'caution',
      effect: 'increases',
      summary: 's',
      advice: 'a',
      details: 'd',
      citations: [{ type: 'label', title: 't', url: 'https://example.org' }],
      status: 'approved',
      source: 'curated',
      reviewed_at: '2026-10-08',
      ...extra,
    },
  }
}

// Catalogue Drugs and Foods the fixtures talk about. Ranolazine and amlodipine are absent on purpose.
function dataset(): RawDataset {
  return {
    drugs: [
      drug('statins', { group: true }),
      drug('simvastatin', { parent: 'statins', rxnorm: '36567' }),
      drug('atorvastatin', { parent: 'statins', rxnorm: '83367' }),
      drug('levothyroxine', { rxnorm: '10582' }),
      drug('verapamil', { rxnorm: '11170' }),
      drug('tadalafil', { rxnorm: '358263' }),
    ],
    foods: [
      food('grapefruit', { aliases: ['grapefruit juice'], category: 'fruit' }),
      food('alcohol', { aliases: ['red wine'], category: 'alcohol' }),
    ],
    mechanisms: [
      {
        file: 'mechanisms/cyp3a4-inhibition.yaml',
        data: {
          id: 'cyp3a4-inhibition',
          name: 'CYP3A4 inhibition',
          kind: 'enzyme',
          explanation: 'x',
        },
      },
      {
        file: 'mechanisms/absorption-delay.yaml',
        data: {
          id: 'absorption-delay',
          name: 'Delayed absorption',
          kind: 'absorption',
          explanation: 'x',
        },
      },
    ],
    interactions: [
      interaction('grapefruit--levothyroxine', { status: 'rejected' }), // existing file, any status
      interaction('alcohol--statins'), // Inherited by every statin
    ],
  }
}

const keep = (excerpt: string, extra: Partial<Draft> = {}): Draft => ({
  keep: true,
  reason: '',
  summary: 'Grapefruit raises the drug level.',
  advice: 'Avoid grapefruit juice.',
  details: 'The label says to avoid it.',
  effect: 'increases',
  mechanisms: ['cyp3a4-inhibition'],
  severity: 'avoid',
  excerpt,
  ...extra,
})
const discard = (reason: string): Draft => ({ ...keep(''), keep: false, reason })

function setup(
  drafts: Record<string, Draft>,
  raw: RawDataset = dataset(),
  prior: Record<string, string> = {},
) {
  const written: Record<string, string> = {}
  const searched: string[] = []
  const drafted: DraftInput[] = []
  const store = new Map(Object.entries(prior))
  const ports: Ports = {
    searchLabels: async (term) => (searched.push(term), fixtures[term.toLowerCase()] ?? []),
    draft: async (input) => {
      drafted.push(input)
      return drafts[`${input.food.id}--${input.drug.id}`] ?? discard('unscripted')
    },
    readDataset: () => raw,
    writeFile: (path, content) => void (written[path] = content),
    cache: { get: async (k) => store.get(k), set: async (k, v) => void store.set(k, v) },
  }
  const run = (limit?: number) =>
    runPipeline('openfda', { limit, dataDir: 'data', reportPath: 'report.md' }, ports)
  return { run, written, searched, drafted, store }
}

const SIMVA = 'Avoid grapefruit juice when taking simvastatin.'

describe('runPipeline (openfda)', () => {
  it('searches every Food name and Alias, and matches label text on an Alias alone', async () => {
    const t = setup({
      'alcohol--tadalafil': keep('Avoid red wine in large amounts while taking tadalafil.'),
    })
    await t.run()
    expect(t.searched).toEqual(
      expect.arrayContaining(['Grapefruit', 'grapefruit juice', 'Alcohol', 'red wine']),
    )
    // that tadalafil label never says "alcohol"; it was found through the Alias
    expect(Object.keys(t.written)).toContain('data/interactions/alcohol--tadalafil.yaml')
  })

  it('writes Pending openfda YAML with a label Citation on the most recent label, and no excerpt', async () => {
    const t = setup({ 'grapefruit--simvastatin': keep(SIMVA) })
    const r = await t.run()
    const file = t.written['data/interactions/grapefruit--simvastatin.yaml']
    const y = parse(file)
    expect(y).toMatchObject({ id: 'grapefruit--simvastatin', status: 'pending', source: 'openfda' })
    expect(y.reviewed_at).toBeUndefined()
    // two simvastatin labels match; the 2026 one (00896fff) beats the 2025 one
    expect(y.citations).toEqual([
      expect.objectContaining({
        type: 'label',
        setid: '00896fff-081d-4553-be8c-1999a8a73dda',
        url: expect.stringContaining('setid=00896fff-081d-4553-be8c-1999a8a73dda'),
      }),
    ])
    expect(file).not.toContain(SIMVA)
    expect(r.report).toContain(SIMVA)
  })

  it('groups labels by ingredient: salt names map to the catalogue Drug, and the drafter sees the cited label text', async () => {
    const t = setup({})
    await t.run()
    const atorva = t.drafted.find((d) => d.drug.id === 'atorvastatin')
    expect(atorva?.text).toContain('atorvastatin calcium')
    expect(t.drafted.find((d) => d.drug.id === 'simvastatin')?.mechanisms.map((m) => m.id)).toEqual(
      ['cyp3a4-inhibition', 'absorption-delay'],
    )
  })

  it('reports noise discards with their reasons', async () => {
    const t = setup({
      'grapefruit--atorvastatin': discard('dose-quantity wording, not a clear food effect'),
    })
    const r = await t.run()
    expect(r.report).toContain(
      'grapefruit--atorvastatin: dose-quantity wording, not a clear food effect',
    )
    expect(t.written['data/interactions/grapefruit--atorvastatin.yaml']).toBeUndefined()
  })

  it('drops a draft whose excerpt is not verbatim in the label, and says so', async () => {
    const t = setup({
      'grapefruit--verapamil': keep('Verapamil must never be taken with grapefruit.'),
    })
    const r = await t.run()
    expect(t.written['data/interactions/grapefruit--verapamil.yaml']).toBeUndefined()
    expect(r.report).toMatch(/Dropped[^]*grapefruit--verapamil/)
  })

  it('skips combination products, uncatalogued ingredients and labels without ingredient data, and counts them', async () => {
    const r = await setup({}).run()
    expect(r.report).toContain('Combination-product labels: 2')
    expect(r.report).toContain('Ingredients not in the catalogue: 1') // ranolazine
    expect(r.report).toContain('Labels without ingredient data: 1')
  })

  it('skips pairs with an existing file in any status, or covered by an Inherited interaction', async () => {
    const t = setup({})
    const r = await t.run()
    expect(t.drafted.map((d) => `${d.food.id}--${d.drug.id}`)).not.toContain(
      'grapefruit--levothyroxine',
    )
    expect(t.drafted.map((d) => `${d.food.id}--${d.drug.id}`)).not.toContain('alcohol--simvastatin')
    expect(r.report).toContain('Existing Interaction file: 1')
    expect(r.report).toContain('Inherited interaction: 1')
  })

  it('skips a pair covered by a Food group × Drug class Interaction', async () => {
    const raw = dataset()
    raw.foods = [
      food('grapefruit-relatives', { group: true, category: 'fruit' }),
      food('grapefruit', {
        aliases: ['grapefruit juice'],
        category: 'fruit',
        parent: 'grapefruit-relatives',
      }),
      ...raw.foods.filter((f) => f.file !== 'foods/grapefruit.yaml'),
    ]
    raw.interactions.push(interaction('grapefruit-relatives--statins'))
    const t = setup({}, raw)
    await t.run()
    const drafted = t.drafted.map((d) => `${d.food.id}--${d.drug.id}`)
    expect(drafted).not.toContain('grapefruit--simvastatin')
    expect(drafted).not.toContain('grapefruit--atorvastatin')
  })

  it('ranks pairs by label mentions and takes the first --limit', async () => {
    const t = setup({ 'grapefruit--simvastatin': keep(SIMVA) })
    const r = await t.run(1)
    expect(t.drafted.map((d) => d.drug.id)).toEqual(['simvastatin']) // two labels beat one
    expect(r.report).toContain('Pairs beyond the limit: ')
    expect(r.report).not.toContain('Pairs beyond the limit: 0')
  })

  it('reuses the cache on a second run', async () => {
    const t = setup({})
    await t.run()
    const calls = t.searched.length
    await t.run()
    expect(t.searched.length).toBe(calls)
  })

  it('marks Severity as suggested and reports the expected unreferenced-Drug errors without aborting', async () => {
    const t = setup({ 'grapefruit--simvastatin': keep(SIMVA, { severity: 'monitor' }) })
    const r = await t.run()
    expect(r.report).toContain(
      'Severity: monitor (suggested, confirm against the primary Citation)',
    )
    expect(r.expectedErrors.length).toBeGreaterThan(0)
    expect(r.expectedErrors.every((e) => /no approved interaction references/.test(e))).toBe(true)
  })

  it('aborts, writing nothing, when a proposed file fails Dataset validation for any other reason', async () => {
    const t = setup({ 'grapefruit--simvastatin': keep(SIMVA, { summary: '' }) })
    await expect(t.run()).rejects.toThrow(/validation failed/)
    expect(t.written).toEqual({})
  })

  it('drops a draft whose Mechanisms are all unknown', async () => {
    const t = setup({ 'grapefruit--simvastatin': keep(SIMVA, { mechanisms: ['made-up'] }) })
    const r = await t.run()
    expect(t.written['data/interactions/grapefruit--simvastatin.yaml']).toBeUndefined()
    expect(r.report).toContain('no existing Mechanism fits')
  })
})
