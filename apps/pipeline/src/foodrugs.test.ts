import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'
import { parse } from 'yaml'
import { dumpLines } from './foodrugs.ts'
import { validateDataset, type RawDataset } from '@fdi/schema'
import {
  runPipeline,
  type Draft,
  type DraftInput,
  type FooDrugsPorts,
  type Ports,
} from './pipeline.ts'

const dump = new URL('./fixtures/foodrugs.sql', import.meta.url)

const entity = (dir: string, id: string, extra: Record<string, unknown>) => ({
  file: `${dir}/${id}.yaml`,
  data: { id, name: id[0].toUpperCase() + id.slice(1), ...extra },
})
const mechanism = {
  file: 'mechanisms/cyp3a4-inhibition.yaml',
  data: { id: 'cyp3a4-inhibition', name: 'CYP3A4 inhibition', kind: 'enzyme', explanation: 'x' },
}
const approved = (id: string) => {
  const [food, drug] = id.split('--')
  return {
    file: `interactions/${id}.yaml`,
    data: {
      id,
      food,
      drug,
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
    },
  }
}

function dataset(): RawDataset {
  return {
    drugs: [
      entity('drugs', 'statins', { group: true }),
      entity('drugs', 'simvastatin', { parent: 'statins', rxnorm: '36567' }),
      entity('drugs', 'atorvastatin', { parent: 'statins', rxnorm: '83367' }),
      entity('drugs', 'verapamil', { rxnorm: '11170' }),
      entity('drugs', 'tadalafil', { rxnorm: '358263' }),
    ],
    foods: [
      entity('foods', 'grapefruit', { aliases: ['Grapefruit Juice'], category: 'fruit' }),
      entity('foods', 'alcohol', { category: 'alcohol' }),
    ],
    mechanisms: [mechanism],
    interactions: [],
  }
}

// RxNav stand-in: names (lowercase) -> RxNorm CUI.
const CUIS: Record<string, string> = {
  simvastatin: '36567',
  zocor: '36567',
  verapamil: '11170',
  atorvastatin: '83367',
  ranolazine: '35829', // real CUI, but not in the catalogue
}
const abstract = (text: string) => ({ title: `Study: ${text.slice(0, 20)}`, abstract: text })
const SIMVA = 'Avoid grapefruit juice when taking simvastatin.'
const ABSTRACTS: Record<string, { title: string; abstract: string }> = {
  '1000001': {
    title: 'Grapefruit juice and simvastatin',
    abstract: `Background text. ${SIMVA} More.`,
  },
  '1000002': abstract('Zocor exposure rose with grapefruit juice.'),
  '1000003': abstract('Grapefruit raised simvastatin AUC.'),
  '1000004': abstract('A fourth simvastatin study.'),
  '1000005': abstract('Verapamil levels with grapefruit.'),
  '1000007': abstract('Grapefruit juice study.'),
  '1000012': abstract('Atorvastatin and grapefruit juice.'),
  '1000009': abstract('Grapefruit raised ranolazine exposure.'),
}

const keep = (excerpt: string, extra: Partial<Draft> = {}): Draft => ({
  keep: true,
  reason: '',
  summary: 'Grapefruit raises the drug level.',
  advice: 'Avoid grapefruit juice.',
  details: 'The abstract says to avoid it.',
  effect: 'increases',
  mechanisms: ['cyp3a4-inhibition'],
  severity: 'avoid',
  excerpt,
  parent: '',
  new_mechanisms: [],
  ...extra,
})

function setup(drafts: Record<string, Draft>, raw: RawDataset = dataset()) {
  const written: Record<string, string> = {}
  const drafted: DraftInput[] = []
  const rxnavCalls: string[] = []
  const pubmedCalls: string[] = []
  const store = new Map<string, string>()
  const ports: Ports & FooDrugsPorts = {
    searchLabels: async () => [],
    draft: async (input) => {
      drafted.push(input)
      return (
        drafts[`${input.food.id}--${input.drug.id}`] ?? {
          ...keep(''),
          keep: false,
          reason: 'unscripted',
        }
      )
    },
    readDataset: () => raw,
    writeFile: (path, content) => void (written[path] = content),
    cache: { get: async (k) => store.get(k), set: async (k, v) => void store.set(k, v) },
    foodrugsLines: () => dumpLines(fileURLToPath(dump)),
    ingredientCui: async (name) => (rxnavCalls.push(name), CUIS[name.toLowerCase()]),
    pubmed: async (pmid) => (pubmedCalls.push(pmid), ABSTRACTS[pmid]),
  }
  const run = (limit?: number) =>
    runPipeline('foodrugs', { limit, dataDir: 'data', reportPath: 'report.md' }, ports)
  return { run, written, drafted, rxnavCalls, pubmedCalls }
}

const SIM = 'data/interactions/grapefruit--simvastatin.yaml'

describe('runPipeline (foodrugs)', () => {
  it('uses text-mined records only, and PubMed documents only', async () => {
    const t = setup({})
    await t.run()
    const pairs = t.drafted.map((d) => `${d.food.id}--${d.drug.id}`).sort()
    // topTable's grapefruit--tadalafil, the clinical-trial-only alcohol--verapamil and a ClinicalTrials.gov
    // document never become pairs; grapefruit--verapamil survives through its PubMed document 5
    expect(pairs).toEqual([
      'grapefruit--atorvastatin',
      'grapefruit--ranolazine',
      'grapefruit--simvastatin',
      'grapefruit--verapamil',
    ])
    expect(t.pubmedCalls).not.toContain('1000006') // pomelo document
  })

  it('matches Foods exactly, ignoring case, by name or Alias, and reports unmatched names by frequency', async () => {
    const r = await setup({}).run()
    // "Grapefruit Juice" and "GRAPEFRUIT" match; "pomelo" (x2) is no Alias of grapefruit
    expect(r.report).toMatch(/Unmatched food names[^]*- pomelo: 2[^]*- seville orange: 1/)
    expect(r.report).not.toMatch(/- grapefruit: \d/)
  })

  it('resolves Drug names to RxNorm CUIs through RxNav, caching lookups', async () => {
    const t = setup({})
    const r = await t.run()
    // brand "Zocor" and "simvastatin" resolve to the same CUI, hence the same pair
    expect(t.drafted.find((d) => d.drug.id === 'simvastatin')).toBeDefined()
    expect(t.rxnavCalls.filter((n) => n.toLowerCase() === 'simvastatin')).toHaveLength(1)
    expect(r.report).toMatch(/Drug names that did not resolve[^]*- 6'-acetyl-mystery, x: 1/)
  })

  it('proposes a Drug whose ingredient CUI is not in the catalogue, with its CUI and suggested class', async () => {
    const raw = dataset()
    raw.drugs.push(entity('drugs', 'antianginals', { group: true }))
    const t = setup(
      {
        'grapefruit--ranolazine': keep('Grapefruit raised ranolazine exposure.', {
          parent: 'antianginals',
        }),
      },
      raw,
    )
    const r = await t.run()
    expect(parse(t.written['data/drugs/ranolazine.yaml'])).toEqual({
      id: 'ranolazine',
      name: 'Ranolazine',
      rxnorm: '35829',
      parent: 'antianginals',
    })
    expect(t.drafted.find((d) => d.drug.id === 'ranolazine')?.classes.map((c) => c.id)).toEqual([
      'statins',
      'antianginals',
    ])
    expect(t.rxnavCalls.filter((n) => n === 'ranolazine')).toHaveLength(1)
    expect(r.report).toMatch(/Proposed new Drugs \(1\)[^]*- ranolazine: Ranolazine; rxnorm 35829/)
  })

  it('cites up to 3 PMIDs per pair as study Citations, most-mentioning first', async () => {
    const t = setup({ 'grapefruit--simvastatin': keep(SIMVA) })
    await t.run()
    const y = parse(t.written[SIM])
    expect(y.citations).toEqual([
      {
        type: 'study',
        title: 'Grapefruit juice and simvastatin',
        url: 'https://pubmed.ncbi.nlm.nih.gov/1000001/',
        pmid: '1000001',
      },
      expect.objectContaining({ type: 'study', pmid: '1000002' }),
      expect.objectContaining({ type: 'study', pmid: '1000003' }),
    ])
    expect(t.pubmedCalls).not.toContain('1000004')
    expect(t.pubmedCalls).not.toContain('1000007')
  })

  it('writes Pending foodrugs YAML without reviewed_at, and the excerpt only in the report', async () => {
    const t = setup({ 'grapefruit--simvastatin': keep(SIMVA) })
    const r = await t.run()
    const file = t.written[SIM]
    expect(parse(file)).toMatchObject({ status: 'pending', source: 'foodrugs' })
    expect(parse(file).reviewed_at).toBeUndefined()
    expect(file).not.toContain(SIMVA)
    expect(r.report).toContain(SIMVA)
    expect(r.report).toContain('https://pubmed.ncbi.nlm.nih.gov/1000001/')
  })

  it('shows the drafter the abstracts', async () => {
    const t = setup({})
    await t.run()
    expect(t.drafted.find((d) => d.drug.id === 'simvastatin')?.text).toContain(SIMVA)
  })

  it('drops a draft whose excerpt is not verbatim in any abstract, and says so', async () => {
    const t = setup({
      'grapefruit--simvastatin': keep(SIMVA),
      'grapefruit--verapamil': keep('Verapamil must never be taken with grapefruit.'),
    })
    const r = await t.run()
    expect(t.written['data/interactions/grapefruit--verapamil.yaml']).toBeUndefined()
    expect(r.report).toMatch(/Dropped[^]*grapefruit--verapamil/)
    expect(t.written[SIM]).toBeDefined()
  })

  it('ranks pairs by how many documents mention them and respects --limit', async () => {
    const t = setup({})
    const r = await t.run(1)
    expect(t.drafted.map((d) => d.drug.id)).toEqual(['simvastatin'])
    expect(r.report).toContain('Pairs beyond the limit: 3')
  })

  it('skips a pair covered by a Food × Drug class Interaction', async () => {
    const raw = dataset()
    raw.interactions.push(approved('grapefruit--statins'))
    const t = setup({}, raw)
    const r = await t.run()
    expect(t.drafted.map((d) => d.drug.id)).toEqual(['ranolazine', 'verapamil'])
    expect(r.report).toContain('Inherited interaction: 2')
  })

  it('validates Pending study-only interactions, but not once Approved', async () => {
    const t = setup({ 'grapefruit--simvastatin': keep(SIMVA) })
    await t.run()
    const data = parse(t.written[SIM])
    const check = (extra: object) =>
      validateDataset({
        ...dataset(),
        interactions: [
          { file: 'interactions/grapefruit--simvastatin.yaml', data: { ...data, ...extra } },
        ],
      })
    const errors = (r: ReturnType<typeof check>) => ('errors' in r ? r.errors : [])
    expect(errors(check({})).filter((e) => !/no approved interaction references/.test(e))).toEqual(
      [],
    )
    expect(errors(check({ status: 'approved', reviewed_at: '2026-10-14' }))).toContainEqual(
      expect.stringContaining('approved interaction needs a label, review or guideline citation'),
    )
  })

  it('refuses to run without the dump port', async () => {
    const t = setup({})
    await expect(
      runPipeline(
        'foodrugs',
        { dataDir: 'data', reportPath: 'r.md' },
        {
          searchLabels: async () => [],
          draft: async () => keep(''),
          ingredientCui: async () => undefined,
          readDataset: dataset,
          writeFile: () => {},
          cache: { get: async () => undefined, set: async () => {} },
        },
      ),
    ).rejects.toThrow(/foodrugs/)
    expect(t.written).toEqual({})
  })
})
