import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'
import { parse } from 'yaml'
import type { RawDataset } from '@fdi/schema'
import { parseCsv } from './ddid.ts'
import {
  runPipeline,
  type Draft,
  type DraftInput,
  type DdidPorts,
  type FooDrugsPorts,
  type Ports,
} from './pipeline.ts'

const csv = readFileSync(new URL('./fixtures/ddid.csv', import.meta.url), 'utf8')

const entity = (dir: string, id: string, extra: Record<string, unknown>) => ({
  file: `${dir}/${id}.yaml`,
  data: { id, name: id[0].toUpperCase() + id.slice(1), ...extra },
})
const dataset = (): RawDataset => ({
  drugs: [
    entity('drugs', 'simvastatin', { rxnorm: '36567' }),
    entity('drugs', 'atorvastatin', { rxnorm: '83367' }),
    entity('drugs', 'verapamil', { rxnorm: '11170' }),
    entity('drugs', 'tadalafil', { rxnorm: '358263' }),
  ],
  foods: [
    entity('foods', 'grapefruit', { aliases: ['Grapefruit Juice'], category: 'fruit' }),
    entity('foods', 'pomegranate', { category: 'fruit' }),
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
  ],
  interactions: [],
})

const CUIS: Record<string, string> = {
  simvastatin: '36567',
  atorvastatin: '83367',
  verapamil: '11170',
  tadalafil: '358263',
}
const SIMVA = 'Avoid grapefruit juice when taking simvastatin.'
const ABSTRACTS: Record<string, { title: string; abstract: string }> = {
  '2000001': { title: 'Grapefruit and simvastatin', abstract: `Background. ${SIMVA} More.` },
  '2000002': { title: 'Second study', abstract: 'Grapefruit juice raised simvastatin AUC.' },
  // the known mismatch: DDID attaches this grapefruit study to its pomegranate row
  '2000003': {
    title: 'Grapefruit only',
    abstract: 'Grapefruit juice raised simvastatin exposure.',
  },
  '2000007': { title: 'Tadalafil', abstract: 'Grapefruit juice raised tadalafil exposure.' },
}

const keep = (excerpt: string): Draft => ({
  keep: true,
  reason: '',
  summary: 's',
  advice: 'a',
  details: 'd',
  effect: 'increases',
  mechanisms: ['cyp3a4-inhibition'],
  severity: 'avoid',
  excerpt,
  parent: '',
  new_mechanisms: [],
})

function setup(drafts: Record<string, Draft>) {
  const written: Record<string, string> = {}
  const drafted: DraftInput[] = []
  const pubmedCalls: string[] = []
  const store = new Map<string, string>()
  const ports: Ports & DdidPorts & Pick<FooDrugsPorts, 'pubmed'> = {
    searchLabels: async () => [],
    draft: async (input) => {
      drafted.push(input)
      return (
        drafts[`${input.food.id}--${input.drug.id}`] ?? { ...keep(''), keep: false, reason: 'x' }
      )
    },
    readDataset: dataset,
    writeFile: (path, content) => void (written[path] = content),
    cache: { get: async (k) => store.get(k), set: async (k, v) => void store.set(k, v) },
    ddidCsv: () => csv,
    ingredientCui: async (name) => CUIS[name.toLowerCase()],
    pubmed: async (pmid) => (pubmedCalls.push(pmid), ABSTRACTS[pmid]),
  }
  const run = (limit?: number) =>
    runPipeline('ddid', { limit, dataDir: 'data', reportPath: 'report.md' }, ports)
  return { run, written, drafted, pubmedCalls }
}

const SIM = 'data/interactions/grapefruit--simvastatin.yaml'

describe('parseCsv', () => {
  it('handles quoted commas, doubled quotes, CRLF, embedded newlines and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, ""y""","line\nbreak"\r\nlast,')).toEqual([
      ['a', 'b'],
      ['x, "y"', 'line\nbreak'],
      ['last', ''],
    ])
  })
})

describe('runPipeline (ddid)', () => {
  it('keeps only rows graded harmful or negative, ignoring case', async () => {
    const t = setup({})
    await t.run()
    // verapamil rows are graded Positive, Possible and No Effect only
    expect(t.drafted.map((d) => `${d.food.id}--${d.drug.id}`).sort()).toEqual([
      'grapefruit--simvastatin',
      'grapefruit--tadalafil',
      'pomegranate--simvastatin',
    ])
    expect(t.pubmedCalls).not.toContain('2000004')
  })

  it('groups PMIDs per pair, matching Foods by name or Alias, and cites them as study Citations', async () => {
    const t = setup({ 'grapefruit--simvastatin': keep(SIMVA) })
    await t.run()
    const y = parse(t.written[SIM])
    // "Grapefruit", "Grapefruit Juice" and "grapefruit" rows meet in one pair; 2000001 appears twice
    expect(y.citations).toEqual([
      expect.objectContaining({ type: 'study', pmid: '2000001' }),
      expect.objectContaining({
        type: 'study',
        pmid: '2000002',
        url: 'https://pubmed.ncbi.nlm.nih.gov/2000002/',
      }),
    ])
    expect(y).toMatchObject({ status: 'pending', source: 'ddid' })
  })

  it('copies no DDID text into the YAML or report, and the grade never becomes Severity', async () => {
    const t = setup({ 'grapefruit--simvastatin': keep(SIMVA) })
    const r = await t.run()
    const out = t.written[SIM] + r.report
    expect(out).not.toMatch(/Fixture text|Fixture title|AUC rose/)
    expect(parse(t.written[SIM]).severity).toBe('avoid') // the drafter's, not 'Harmful'
  })

  it('drops the simvastatin and pomegranate row that cites a grapefruit study', async () => {
    const t = setup({
      'grapefruit--simvastatin': keep(SIMVA),
      'pomegranate--simvastatin': keep('Pomegranate juice raised simvastatin exposure.'),
    })
    const r = await t.run()
    expect(t.drafted.find((d) => d.food.id === 'pomegranate')?.text).toContain(
      '[PMID 2000003] Grapefruit juice',
    )
    expect(t.written['data/interactions/pomegranate--simvastatin.yaml']).toBeUndefined()
    expect(r.report).toMatch(/Dropped[^]*pomegranate--simvastatin/)
    expect(t.written[SIM]).toBeDefined()
  })

  it('reports rows without a usable PMID, unmatched Foods and unresolved Drugs', async () => {
    const r = await setup({}).run()
    expect(r.report).toContain('Rows without a usable PMID: 2')
    expect(r.report).toMatch(/Unmatched food names[^]*- noni: 2/)
    expect(r.report).toMatch(/did not resolve[^]*- mysterydrug: 1/)
    expect(r.report).toContain('(DDID)')
  })

  it('refuses to run without the CSV port', async () => {
    const t = setup({})
    await expect(
      runPipeline(
        'ddid',
        { dataDir: 'data', reportPath: 'r.md' },
        {
          searchLabels: async () => [],
          draft: async () => keep(''),
          ingredientCui: async () => undefined,
          readDataset: dataset,
          writeFile: () => {},
          cache: { get: async () => undefined, set: async () => {} },
          pubmed: async () => undefined,
        },
      ),
    ).rejects.toThrow(/ddid/)
    expect(t.written).toEqual({})
  })
})
