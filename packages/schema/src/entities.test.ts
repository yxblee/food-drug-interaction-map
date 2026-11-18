import { describe, expect, it } from 'vite-plus/test'
import { Drug, Food, Interaction, Mechanism, Pairing } from './entities.ts'

const interaction = {
  id: 'grapefruit--simvastatin',
  food: 'grapefruit',
  drug: 'simvastatin',
  mechanisms: ['cyp3a4-inhibition'],
  severity: 'avoid',
  effect: 'increases',
  summary: 'Grapefruit can raise simvastatin levels.',
  advice: 'Avoid grapefruit.',
  details: 'Furanocoumarins inhibit intestinal CYP3A4.',
  citations: [{ type: 'label', title: 'Simvastatin label', url: 'https://dailymed.nlm.nih.gov/x' }],
  status: 'approved',
  source: 'curated',
  reviewed_at: '2026-10-08',
}

describe('Drug', () => {
  it('fills defaults for aliases and group', () => {
    expect(Drug.parse({ id: 'warfarin', name: 'Warfarin' })).toEqual({
      id: 'warfarin',
      name: 'Warfarin',
      aliases: [],
      group: false,
    })
  })
  it('rejects non-kebab-case ids', () => {
    expect(Drug.safeParse({ id: 'Warfarin', name: 'Warfarin' }).success).toBe(false)
  })
  it('rejects unknown fields', () => {
    expect(Drug.safeParse({ id: 'warfarin', name: 'W', colour: 'red' }).success).toBe(false)
  })
  it('takes an optional DailyMed setid that must be a UUID', () => {
    const base = { id: 'warfarin', name: 'Warfarin' }
    const setid = '1b4121ee-a733-4456-a917-be2603477839'
    expect(Drug.parse({ ...base, dailymed: setid }).dailymed).toBe(setid)
    expect(Drug.safeParse({ ...base, dailymed: 'not-a-setid' }).success).toBe(false)
    expect(Drug.safeParse({ ...base, dailymed: setid.slice(1) }).success).toBe(false)
    expect(Drug.safeParse({ ...base, dailymed: `https://x.test/${setid}` }).success).toBe(false)
  })
  it('takes an optional https MedlinePlus URL', () => {
    const base = { id: 'warfarin', name: 'Warfarin' }
    const link = 'https://medlineplus.gov/druginfo/meds/a682277.html'
    expect(Drug.parse({ ...base, medlineplus: link }).medlineplus).toBe(link)
    expect(Drug.safeParse({ ...base, medlineplus: link.replace('https', 'http') }).success).toBe(
      false,
    )
    expect(Drug.safeParse({ ...base, medlineplus: 'not a url' }).success).toBe(false)
  })
})

describe('Food', () => {
  it('requires a known category', () => {
    expect(Food.safeParse({ id: 'kale', name: 'Kale', category: 'vegetable' }).success).toBe(true)
    expect(Food.safeParse({ id: 'kale', name: 'Kale', category: 'veg' }).success).toBe(false)
  })
})

describe('Mechanism', () => {
  it('requires kind and explanation', () => {
    expect(Mechanism.safeParse({ id: 'm', name: 'M', kind: 'enzyme' }).success).toBe(false)
    expect(
      Mechanism.safeParse({ id: 'm', name: 'M', kind: 'enzyme', explanation: 'x' }).success,
    ).toBe(true)
  })
})

describe('Interaction', () => {
  it('accepts a complete interaction', () => {
    expect(Interaction.parse(interaction).severity).toBe('avoid')
  })
  it('requires at least one citation and one mechanism', () => {
    expect(Interaction.safeParse({ ...interaction, citations: [] }).success).toBe(false)
    expect(Interaction.safeParse({ ...interaction, mechanisms: [] }).success).toBe(false)
  })
  it('rejects an unknown severity, bad url and bad date', () => {
    expect(Interaction.safeParse({ ...interaction, severity: 'severe' }).success).toBe(false)
    expect(
      Interaction.safeParse({
        ...interaction,
        citations: [{ type: 'label', title: 't', url: 'not a url' }],
      }).success,
    ).toBe(false)
    expect(Interaction.safeParse({ ...interaction, reviewed_at: '08/10/2026' }).success).toBe(false)
  })
  it('requires the id to look like food--drug', () => {
    expect(Interaction.safeParse({ ...interaction, id: 'grapefruit-simvastatin' }).success).toBe(
      false,
    )
  })
})

describe('Pairing', () => {
  const pairing = {
    id: 'a-meal--metformin',
    food: 'a-meal',
    drug: 'metformin',
    summary: 'Taking metformin with a meal is better tolerated.',
    advice: 'The label says to take it with meals.',
    citations: [{ type: 'label', title: 'Metformin label', url: 'https://dailymed.nlm.nih.gov/x' }],
    status: 'approved',
    source: 'curated',
    reviewed_at: '2026-11-17',
  }
  it('accepts a pairing, with mechanisms optional and defaulting to none', () => {
    expect(Pairing.parse(pairing).mechanisms).toEqual([])
  })
  it('has no severity, effect or details', () => {
    for (const extra of [{ severity: 'avoid' }, { effect: 'increases' }, { details: 'x' }])
      expect(Pairing.safeParse({ ...pairing, ...extra }).success).toBe(false)
  })
  it('requires a citation', () => {
    expect(Pairing.safeParse({ ...pairing, citations: [] }).success).toBe(false)
  })
  it('needs a label, review or guideline citation to be approved', () => {
    const study = [{ type: 'study', title: 't', url: 'https://example.org' }]
    expect(Pairing.safeParse({ ...pairing, citations: study }).success).toBe(false)
    expect(Pairing.safeParse({ ...pairing, citations: study, status: 'pending' }).success).toBe(
      true,
    )
  })
  it('needs reviewed_at once it is not pending', () => {
    const { reviewed_at: _, ...rest } = pairing
    expect(Pairing.safeParse(rest).success).toBe(false)
    expect(Pairing.safeParse({ ...rest, status: 'pending' }).success).toBe(true)
  })
})
