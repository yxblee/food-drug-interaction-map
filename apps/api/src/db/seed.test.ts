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
    expect(ds!.interactions.filter((i) => i.source === 'curated').length).toBe(81)
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
  it('has the salt substitute and licorice Interactions Approved with a label and a second Citation (#207)', () => {
    // [Interaction, Severity, label setid when not the Drug's own, other Citations]
    const mp = 'https://medlineplus.gov/druginfo/meds/'
    const salt = 'potassium-salt-substitutes--'
    // the only current label found naming liquorice for hydrochlorothiazide is a combination's
    const hyzaar = '4116ccde-2e23-45f4-b12f-6337df877744'
    for (const [id, severity, setid, others] of [
      [`${salt}aliskiren`, 'caution', undefined, [`${mp}a607039.html`]],
      [`${salt}amiloride`, 'avoid', undefined, [`${mp}a615029.html`]],
      [`${salt}eplerenone`, 'caution', undefined, [`${mp}a603004.html`]],
      [`${salt}finerenone`, 'caution', undefined, [`${mp}a621038.html`]],
      [`${salt}triamterene`, 'avoid', undefined, [`${mp}a682337.html`]],
      ['licorice--furosemide', 'caution', undefined, ['37764649']],
      ['licorice--hydrochlorothiazide', 'caution', hyzaar, ['37764649', '19562574']],
    ] as const) {
      const i = get(id)
      expect(i?.status, id).toBe('approved')
      expect(i?.reviewed_at, id).toBe('2026-11-27')
      expect(i?.severity, id).toBe(severity)
      const own = ds!.drugs.find((d) => d.id === i?.drug)?.dailymed
      expect(own, id).toBeTruthy()
      expect(
        i?.citations.map((c) => c.setid ?? c.pmid ?? c.url),
        id,
      ).toEqual([setid ?? own, ...others])
    }
  })
  it('does not answer to veterinary furosemide brands (#207)', () => {
    expect(ds!.drugs.find((d) => d.id === 'furosemide')?.aliases).toEqual(['Lasix', 'Furoscix'])
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
  it('gives 11 Caution Interactions a second Citation from MedlinePlus (#216)', () => {
    // [Interaction, page, review date: 2026-11-28 where the owner has seen all of the new text]
    for (const [id, page, reviewed] of [
      ['alcohol--acetaminophen', 'a681004', '2026-11-28'],
      ['alcohol--isoniazid', 'a682401', '2026-11-28'],
      ['alcohol--metformin', 'a696005', '2026-11-28'],
      ['alcohol--quetiapine', 'a698019', '2026-11-18'],
      ['calcium-fortified-juice--fluoroquinolones', 'a688016', '2026-11-28'],
      ['calcium-supplements--dolutegravir', 'a613043', '2026-11-28'],
      ['dairy--fluoroquinolones', 'a688016', '2026-11-28'],
      ['iron-supplements--levodopa', 'a601068', '2026-11-28'],
      ['iron-supplements--levothyroxine', 'a682461', '2026-11-28'],
      ['magnesium-supplements--fluoroquinolones', 'a688016', '2026-11-18'],
      ['zinc-supplements--fluoroquinolones', 'a688016', '2026-11-18'],
    ]) {
      const i = get(id!)
      expect(i?.status, id).toBe('approved')
      expect(i?.reviewed_at, id).toBe(reviewed)
      expect(i?.severity, id).toBe('caution')
      expect(i?.citations.length, id).toBe(2)
      expect(i?.citations[1], id).toMatchObject({
        type: 'guideline',
        url: `https://medlineplus.gov/druginfo/meds/${page}.html`,
      })
    }
  })
  it('words the advice no looser than the second Citation (#216)', () => {
    expect(get('alcohol--acetaminophen')?.advice).toBe(
      'If you have 3 or more alcoholic drinks every day, do not take acetaminophen unless your doctor says it is safe, and never take more than the labelled daily limit.',
    )
    expect(get('alcohol--quetiapine')?.advice).toBe(
      'Do not drink alcohol while taking quetiapine unless your prescriber says it is safe. Avoid driving or operating machinery until you know how it affects you. Be extra careful when starting the drug or raising the dose, because drowsiness and dizziness are most common then.',
    )
    expect(get('alcohol--quetiapine')?.summary).not.toContain('limited')
    // the label's Medication Guide says not to drink too; only its interactions section says limit
    expect(get('alcohol--quetiapine')?.details).toContain('Medication Guide')
    expect(get('magnesium-supplements--fluoroquinolones')?.details).toContain('magnesium hydroxide')
    expect(get('iron-supplements--levodopa')?.advice).toBe(
      'Iron supplements and multivitamins with iron may interact with levodopa. Tell your pharmacist or prescriber about any iron product you take and ask how to space them.',
    )
    for (const mineral of ['magnesium', 'zinc']) {
      const i = get(`${mineral}-supplements--fluoroquinolones`)
      expect(i?.advice, mineral).toBe(
        `Take the antibiotic at least 2 hours before or 6 hours after ${mineral} supplements, or antacids or multivitamins that contain ${mineral}, unless your pharmacist advises otherwise.`,
      )
      expect(i?.details, mineral).not.toMatch(/timing above|spacing above/)
    }
  })
  it('gives every Approved Avoid Interaction two Citations (#135, #160)', () => {
    expect(citationGaps(ds!.interactions)).toEqual([])
  })
})
