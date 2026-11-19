import { readdirSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { Drug } from '@fdi/schema'
import { describe, expect, it } from 'vite-plus/test'
import { addDailymed, brandLabels, withDailymed } from './dailymed.ts'

// Responses recorded from https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?rxcui=…
// 1545063 (tafamidis): one label. 233698 (dronedarone): three. 37546 (talinolol): none.
const spls: Record<string, unknown> = JSON.parse(
  readFileSync(new URL('./fixtures/dailymed-spls.json', import.meta.url), 'utf8'),
)
const SETID = '1b4121ee-a733-4456-a917-be2603477839'
const yaml = (s: TemplateStringsArray) => s[0].trimStart()

describe('withDailymed', () => {
  it('adds the setid after the medlineplus line, else after rxnorm, touching nothing else', () => {
    expect(
      withDailymed(
        yaml`
id: "tafamidis"
rxnorm: "1545063"
medlineplus: "https://medlineplus.gov/druginfo/meds/a1.html"
aliases: []
`,
        SETID,
      ),
    ).toBe(yaml`
id: "tafamidis"
rxnorm: "1545063"
medlineplus: "https://medlineplus.gov/druginfo/meds/a1.html"
dailymed: "1b4121ee-a733-4456-a917-be2603477839"
aliases: []
`)
    expect(withDailymed('id: "t"\nrxnorm: "1"\naliases: []\n', SETID)).toBe(
      `id: "t"\nrxnorm: "1"\ndailymed: "${SETID}"\naliases: []\n`,
    )
  })
})

describe('addDailymed', () => {
  const file = (id: string, extra: string) => ({
    file: `${id}.yaml`,
    text: `id: "${id}"\nname: "${id}"\n${extra}\n`,
  })
  const getJson = async (rxcui: string) => spls[rxcui]

  it('writes a setid only for a single match; classes, no-id and already-linked Drugs are skipped', async () => {
    const r = await addDailymed(
      [
        file('tafamidis', 'rxnorm: "1545063"'),
        file('dronedarone', 'rxnorm: "233698"'),
        file('talinolol', 'rxnorm: "37546"'),
        file('statins', 'group: true'),
        file('mystery', 'aliases: []'),
        file('done', `rxnorm: "1545063"\ndailymed: "${SETID}"`),
      ],
      getJson,
    )
    expect(r.changed.map((c) => c.file)).toEqual(['tafamidis.yaml'])
    expect(r.changed[0].text).toContain(`dailymed: "${SETID}"`)
    expect(r.unmatched).toEqual(['talinolol'])
    expect(r.ambiguous.map((a) => a.id)).toEqual(['dronedarone'])
    expect(r.ambiguous[0].labels.map((l) => l.setid)).toEqual([
      '3bd4006a-8bad-4909-ac6d-b6d84390155c',
      '7fa41601-7fb5-4155-8e50-2ae903f0d2d6',
      '236d4549-f44b-4677-b857-acedd10b9920',
    ])
  })

  it("prefers the one setid the Drug's Interactions cite; several are listed, none written; none cited falls back", async () => {
    const calls: string[] = []
    const spy = async (rxcui: string) => (calls.push(rxcui), spls[rxcui])
    const r = await addDailymed(
      [
        file('dronedarone', 'rxnorm: "233698"'),
        file('tafamidis', 'rxnorm: "1545063"'),
        file('talinolol', 'rxnorm: "37546"'),
      ],
      spy,
      { dronedarone: ['aaa'], tafamidis: ['a', 'b'] },
    )
    expect(r.changed.map((c) => c.file)).toEqual(['dronedarone.yaml'])
    expect(r.changed[0].text).toContain('dailymed: "aaa"')
    expect(r.ambiguous.map((a) => [a.id, a.labels.map((l) => l.setid)])).toEqual([
      ['tafamidis', ['a', 'b']],
    ])
    expect(calls).toEqual(['37546'])
    expect(r.unmatched).toEqual(['talinolol'])
  })
})

describe('brandLabels', () => {
  const l = (title: string, n: number) => ({ setid: `s${n}`, title })
  const labels = [
    l('SERTRALINE HYDROCHLORIDE TABLET [ACME REPACK]', 1),
    l('ZOLOFT (SERTRALINE HYDROCHLORIDE) TABLET, FILM COATED [ROERIG]', 2),
    l('ZOLOFT (SERTRALINE HYDROCHLORIDE) TABLET [BOTTLE CO]', 3),
    l('ZOLOFTY (SERTRALINE) TABLET [OTHER]', 4),
  ]
  it('suggests labels whose title starts with a brand alias, as whole words, and ignores the rest', () => {
    expect(brandLabels(labels, ['zoloft', 'iron pills']).map((x) => x.setid)).toEqual(['s2', 's3'])
  })
  it('suggests nothing when no alias matches', () => {
    expect(brandLabels(labels, ['Xanax'])).toEqual([])
  })
})

describe('data/drugs dailymed setids', () => {
  const dir = new URL('../../../data/drugs/', import.meta.url)
  const drugs = readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => Drug.parse(parse(readFileSync(new URL(f, dir), 'utf8'))))
  it('every dailymed value parses with the schema, and no two Drugs share a label', () => {
    const ids = drugs.filter((d) => d.dailymed).map((d) => d.dailymed)
    expect(ids.length).toBeGreaterThan(60)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
