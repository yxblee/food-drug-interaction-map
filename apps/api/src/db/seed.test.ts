import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { citationGaps, validateDataset } from '@fdi/schema'
import { readDataDir } from './build.ts'

const r = validateDataset(readDataDir(join(import.meta.dirname, '../../../../data')))
const ds = 'dataset' in r ? r.dataset : undefined
const get = (id: string) => ds?.interactions.find((i) => i.id === id)

describe('seed dataset', () => {
  it('validates', () => {
    expect('errors' in r ? r.errors : []).toEqual([])
  })
  it('has the catalogue sizes from the ticket', () => {
    const drugs = ds!.drugs.length
    // the curated seed; the curation pipeline only adds to it
    expect(drugs).toBeGreaterThanOrEqual(55)
    expect(ds!.foods.length).toBe(48)
    expect(ds!.mechanisms.length).toBeGreaterThanOrEqual(22)
    expect(ds!.interactions.filter((i) => i.source === 'curated').length).toBe(74)
  })
  it('keeps grapefruit relatives as a group, not citrus (ADR 0001)', () => {
    const rel = ds!.foods.filter((f) => f.parent === 'grapefruit-relatives').map((f) => f.id)
    expect(rel.sort()).toEqual(['grapefruit', 'pomelo', 'seville-orange'])
    expect(ds!.foods.some((f) => f.id === 'citrus')).toBe(false)
  })
  it('has brand-name aliases and drug classes', () => {
    expect(ds!.drugs.find((d) => d.id === 'warfarin')?.aliases).toContain('Coumadin')
    expect(ds!.drugs.find((d) => d.id === 'simvastatin')?.drug_class).toBeTruthy()
  })
  it('pins the e2e interactions', () => {
    expect(get('grapefruit-relatives--simvastatin')?.severity).toBe('avoid')
    expect(get('leafy-greens--warfarin')?.severity).toBe('caution')
  })
  it("has the St John's wort Interactions Approved, with their Citations (#185)", () => {
    // [Drug, PubMed id]; the first Citation is that Drug's own DailyMed label
    for (const [drug, pmid] of [
      ['digoxin', '10546917'],
      ['tacrolimus', '14681346'],
    ] as const) {
      const i = get(`st-johns-wort--${drug}`)
      expect(i?.status, drug).toBe('approved')
      expect(i?.reviewed_at, drug).toBe('2026-11-25')
      const label = ds!.drugs.find((d) => d.id === drug)?.dailymed
      expect(
        i?.citations.map((c) => c.setid ?? c.pmid),
        drug,
      ).toEqual([label, pmid])
    }
  })
  it('has the alcohol Interactions Approved where a DailyMed label names alcohol (#197)', () => {
    // [Drug, Severity from the label's advice, other Sources]; the first Citation is the Drug's label
    const mp = 'https://medlineplus.gov/druginfo/meds/'
    for (const [drug, severity, others] of [
      ['gabapentin', 'caution', [`${mp}a694007.html`]],
      ['glimepiride', 'caution', [`${mp}a696016.html`]],
      ['glipizide', 'avoid', ['3428047', `${mp}a684060.html`]],
      ['glyburide', 'caution', ['10587839', `${mp}a684058.html`]],
      ['nitroglycerin', 'avoid', ['6430619', `${mp}a601086.html`]],
      ['tinidazole', 'avoid', [`${mp}a604036.html`]],
    ] as const) {
      const i = get(`alcohol--${drug}`)
      expect(i?.status, drug).toBe('approved')
      expect(i?.reviewed_at, drug).toBe('2026-11-26')
      expect(i?.severity, drug).toBe(severity)
      const label = ds!.drugs.find((d) => d.id === drug)?.dailymed
      expect(
        i?.citations.map((c) => c.setid ?? c.pmid ?? c.url),
        drug,
      ).toEqual([label, ...others])
    }
  })
  it('finds glimepiride by its brand name Amaryl (#197)', () => {
    expect(ds!.drugs.find((d) => d.id === 'glimepiride')?.aliases).toContain('Amaryl')
  })
  it('does not answer to Horizant with gabapentin’s milder alcohol advice (#197)', () => {
    expect(ds!.drugs.find((d) => d.id === 'gabapentin')?.aliases).not.toContain('Horizant')
  })
  it('backs every interaction with an authoritative citation and no placeholders', () => {
    const ok =
      /^https:\/\/(dailymed\.nlm\.nih\.gov|pubmed\.ncbi\.nlm\.nih\.gov|ods\.od\.nih\.gov|medlineplus\.gov|www\.nccih\.nih\.gov|www\.niaaa\.nih\.gov|www\.ncbi\.nlm\.nih\.gov)\//
    for (const i of ds!.interactions) {
      if (i.source === 'curated' && i.status === 'pending') {
        // hand-curated drafts (#167) wait for owner review: two Citations, not yet reviewed
        expect(i.citations.length, i.id).toBeGreaterThanOrEqual(2)
        expect(i.reviewed_at, i.id).toBeUndefined()
      } else if (i.source === 'curated') expect(i.status, i.id).toBe('approved')
      for (const c of i.citations) expect(c.url, i.id).toMatch(ok)
      expect(JSON.stringify(i), i.id).not.toMatch(/[<>]/)
    }
  })
  it('has the iron and magnesium chelation Interactions Approved with a label and a second source (#178)', () => {
    const ids = [
      'iron-supplements--fluoroquinolones',
      'iron-supplements--tetracyclines',
      'iron-supplements--dolutegravir',
      'magnesium-supplements--dolutegravir',
    ]
    for (const id of ids) {
      const i = get(id)
      expect(i?.status, id).toBe('approved')
      expect(i?.mechanisms, id).toEqual(['chelation'])
      expect(i?.reviewed_at, id).toBe('2026-11-25')
      expect(
        i?.citations.some((c) => c.type === 'label'),
        id,
      ).toBe(true)
      expect(
        i?.citations.some((c) => c.type !== 'label'),
        id,
      ).toBe(true)
    }
  })
  it('gives every Approved Avoid Interaction two Citations (#135, #160)', () => {
    expect(citationGaps(ds!.interactions)).toEqual([])
  })
})
