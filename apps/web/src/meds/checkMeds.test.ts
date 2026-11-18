import { describe, expect, it } from 'vite-plus/test'
import type { GraphInteraction, GraphNode, Pairing } from '@fdi/schema'
import { buildIndex } from '@fdi/schema/domain'
import {
  checkFood,
  checkMeds,
  helpedBy,
  mapKeysFor,
  namesOnlyDrug,
  pairingsFor,
} from './checkMeds.ts'

const node = (kind: GraphNode['kind'], id: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  kind,
  id,
  name: id[0].toUpperCase() + id.slice(1),
  aliases: [],
  group: false,
  ...extra,
})
const ia = (
  food: string,
  drug: string,
  severity: GraphInteraction['severity'],
  mechanisms = ['m'],
): GraphInteraction => ({
  id: `${food}--${drug}`,
  food,
  drug,
  mechanisms,
  severity,
  effect: 'increases',
  summary: '',
  advice: '',
})

const ix = buildIndex(
  [
    node('drug', 'statins', { group: true }),
    node('drug', 'simvastatin', { parent: 'statins' }),
    node('drug', 'atorvastatin', { parent: 'statins' }),
    node('drug', 'sartans', { group: true }),
    node('drug', 'losartan', { parent: 'sartans' }),
    node('drug', 'warfarin'),
    node('food', 'grapefruit'),
    node('food', 'alcohol'),
    node('food', 'greens'),
  ],
  [
    ia('grapefruit', 'statins', 'caution'),
    ia('grapefruit', 'simvastatin', 'avoid'),
    ia('alcohol', 'warfarin', 'caution'),
    ia('alcohol', 'statins', 'monitor'),
    ia('greens', 'losartan', 'monitor'),
    ia('greens', 'warfarin', 'caution', ['k']),
  ],
)

describe('checkMeds', () => {
  it('returns [] with no meds or unknown ids', () => {
    expect(checkMeds(ix, [])).toEqual([])
    expect(checkMeds(ix, ['nope'])).toEqual([])
  })

  it('shows inherited class interactions with inheritedFrom', () => {
    const [w] = checkMeds(ix, ['atorvastatin']).filter((w) => w.food.id === 'grapefruit')
    expect(w.severity).toBe('caution')
    expect(w.affected.map((h) => [h.drug.id, h.interaction.id, h.inheritedFrom])).toEqual([
      ['atorvastatin', 'grapefruit--statins', 'statins'],
    ])
  })

  it('lists each food once at its highest severity with every affected drug', () => {
    const warnings = checkMeds(ix, ['warfarin', 'simvastatin', 'atorvastatin'])
    expect(warnings.map((w) => [w.food.id, w.severity])).toEqual([
      ['grapefruit', 'avoid'],
      ['alcohol', 'caution'],
      ['greens', 'caution'],
    ])
    const grapefruit = warnings[0]
    expect(grapefruit.affected.map((h) => [h.drug.id, h.interaction.severity])).toEqual([
      ['simvastatin', 'avoid'],
      ['atorvastatin', 'caution'],
    ])
    const alcohol = warnings[1]
    expect(alcohol.affected.map((h) => h.drug.id)).toEqual([
      'warfarin',
      'atorvastatin',
      'simvastatin',
    ])
  })

  it('includes the Drug class of a Medication that has only Direct interactions', () => {
    const keys = mapKeysFor(ix, checkMeds(ix, ['losartan']), ['losartan'])
    expect(keys.has('drug:sartans')).toBe(true)
  })

  it('collects map keys for drugs, foods, interaction drugs and mechanisms', () => {
    const keys = mapKeysFor(ix, checkMeds(ix, ['atorvastatin']), ['atorvastatin'])
    expect([...keys].sort()).toEqual([
      'drug:atorvastatin',
      'drug:statins',
      'food:alcohol',
      'food:grapefruit',
      'mechanism:m',
    ])
  })
})

describe('checkFood', () => {
  const fx = buildIndex(
    [
      node('drug', 'statins', { group: true }),
      node('drug', 'simvastatin', { parent: 'statins' }),
      node('drug', 'atorvastatin', { parent: 'statins' }),
      node('drug', 'warfarin'),
      node('food', 'relatives', { group: true }),
      node('food', 'grapefruit', { parent: 'relatives' }),
      node('food', 'pomelo', { parent: 'relatives' }),
      node('food', 'alcohol'),
      node('food', 'rice'),
    ],
    [
      ia('relatives', 'statins', 'caution'),
      ia('relatives', 'simvastatin', 'avoid'),
      ia('pomelo', 'warfarin', 'monitor'),
      ia('alcohol', 'warfarin', 'caution'),
    ],
  )

  it('answers one Food against the listed Drugs only', () => {
    const [w, ...rest] = checkFood(fx, 'alcohol', ['warfarin', 'simvastatin'])
    expect(rest).toEqual([])
    expect([w.food.id, w.severity, w.affected.map((h) => h.drug.id)]).toEqual([
      'alcohol',
      'caution',
      ['warfarin'],
    ])
  })

  it('gives a member Food the warnings of its Food group', () => {
    const ws = checkFood(fx, 'grapefruit', ['simvastatin', 'atorvastatin'])
    expect(ws.map((w) => [w.food.id, w.severity])).toEqual([['relatives', 'avoid']])
  })

  it('gives a Food group the warnings of its members', () => {
    const ws = checkFood(fx, 'relatives', ['warfarin', 'atorvastatin'])
    expect(ws.map((w) => [w.food.id, w.severity])).toEqual([
      ['relatives', 'caution'],
      ['pomelo', 'monitor'],
    ])
  })

  it('lets a Direct interaction take the place of the Food group one for the same Drug', () => {
    const direct = buildIndex(
      [...fx.nodes.values()],
      [...fx.interactions, ia('grapefruit', 'simvastatin', 'minimal')],
    )
    const ws = checkFood(direct, 'grapefruit', ['simvastatin', 'atorvastatin'])
    expect(ws.map((w) => [w.food.id, w.severity, w.affected.map((h) => h.drug.id)])).toEqual([
      ['relatives', 'caution', ['atorvastatin']],
      ['grapefruit', 'minimal', ['simvastatin']],
    ])
    expect(checkFood(direct, 'grapefruit', ['simvastatin']).map((w) => w.food.id)).toEqual([
      'grapefruit',
    ])
  })

  it('returns [] for an unknown Food, an empty list or no Interaction', () => {
    expect(checkFood(fx, 'nope', ['warfarin'])).toEqual([])
    expect(checkFood(fx, 'alcohol', [])).toEqual([])
    expect(checkFood(fx, 'rice', ['warfarin', 'simvastatin'])).toEqual([])
  })
})

const pr = (food: string, drug: string): Pairing => ({
  id: `${food}--${drug}`,
  food,
  drug,
  mechanisms: [],
  summary: '',
  advice: '',
  citations: [{ type: 'label', title: 't', url: 'https://example.org' }],
  status: 'approved',
  source: 'curated',
  reviewed_at: '2026-11-17',
})
const pix = buildIndex(
  [
    node('drug', 'statins', { group: true }),
    node('drug', 'simvastatin', { parent: 'statins' }),
    node('drug', 'atorvastatin', { parent: 'statins' }),
    node('drug', 'warfarin'),
    node('drug', 'metformin'),
    node('food', 'meal'),
    node('food', 'greens', { group: true }),
    node('food', 'kale', { parent: 'greens' }),
  ],
  [ia('kale', 'warfarin', 'caution')],
  [
    pr('meal', 'metformin'),
    pr('meal', 'statins'),
    pr('meal', 'simvastatin'),
    pr('greens', 'atorvastatin'),
  ],
)

describe('pairingsFor', () => {
  it('returns [] with no meds, unknown ids or no pairings', () => {
    expect(pairingsFor(pix, [])).toEqual([])
    expect(pairingsFor(pix, ['nope'])).toEqual([])
    expect(pairingsFor(pix, ['warfarin'])).toEqual([])
  })
  it('gives one entry per listed Drug that has pairings, in list order', () => {
    const out = pairingsFor(pix, ['warfarin', 'metformin', 'simvastatin'])
    expect(out.map((d) => d.drug.id)).toEqual(['metformin', 'simvastatin'])
    expect(out[0].pairings.map((p) => p.food.id)).toEqual(['meal'])
  })
  it('covers a Drug class: members inherit it, and their own pairing replaces it', () => {
    const [d] = pairingsFor(pix, ['atorvastatin'])
    expect(d.pairings.map((p) => [p.food.id, p.inheritedFrom])).toEqual([
      ['greens', undefined],
      ['meal', 'statins'],
    ])
    const [s] = pairingsFor(pix, ['simvastatin'])
    expect(s.pairings.map((p) => [p.food.id, p.inheritedFrom])).toEqual([['meal', undefined]])
  })
  it('names a Food group pairing by its group', () => {
    const [d] = pairingsFor(pix, ['atorvastatin'])
    expect(d.pairings[0].food).toMatchObject({ id: 'greens', group: true })
  })
})

describe('helpedBy', () => {
  const helps = pairingsFor(pix, ['atorvastatin', 'metformin', 'warfarin'])
  const food = (id: string) => pix.nodes.get(`food:${id}`)!
  it('names the listed Drugs a Food helps, directly or through its Food group', () => {
    expect(helpedBy(helps, food('meal'), new Set()).map((d) => d.id)).toEqual([
      'atorvastatin',
      'metformin',
    ])
    expect(helpedBy(helps, food('kale'), new Set()).map((d) => d.id)).toEqual(['atorvastatin'])
  })
  it('leaves out Drugs the same warning already covers', () => {
    expect(helpedBy(helps, food('meal'), new Set(['metformin'])).map((d) => d.id)).toEqual([
      'atorvastatin',
    ])
  })
})

describe('namesOnlyDrug', () => {
  it('is true when the lead sentence names one Drug, so its rows need not repeat it', () => {
    const [w] = checkMeds(ix, ['simvastatin']).filter((w) => w.food.id === 'grapefruit')
    expect(namesOnlyDrug(w)).toBe(true)
  })

  it('is false when the lead names several Drugs', () => {
    const [grapefruit, alcohol] = checkMeds(ix, ['warfarin', 'simvastatin', 'atorvastatin'])
    expect(namesOnlyDrug(grapefruit)).toBe(false)
    expect(namesOnlyDrug(alcohol)).toBe(false)
  })
})
