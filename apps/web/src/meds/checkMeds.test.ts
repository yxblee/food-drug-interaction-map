import { describe, expect, it } from 'vite-plus/test'
import type { GraphInteraction, GraphNode } from '@fdi/schema'
import { buildIndex } from '@fdi/schema/domain'
import { checkFood, checkMeds, mapKeysFor } from './checkMeds.ts'

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
