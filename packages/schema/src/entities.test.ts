import { describe, expect, it } from 'vite-plus/test'
import { Drug, Food, Interaction, Mechanism } from './entities.ts'

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
