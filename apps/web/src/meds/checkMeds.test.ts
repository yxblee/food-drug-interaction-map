import { describe, expect, it } from 'vite-plus/test'
import type { GraphInteraction, GraphNode } from '@fdi/schema'
import { buildIndex } from '@fdi/schema/domain'
import { checkMeds, mapKeysFor } from './checkMeds.ts'

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
    ia('greens', 'warfarin', 'caution', ['k']),
  ],
)

describe('checkMeds', () => {
  it('returns [] with no meds or unknown ids', () => {
    expect(checkMeds(ix, [])).toEqual([])
    expect(checkMeds(ix, ['nope'])).toEqual([])
  })

  it('shows inherited class interactions with via', () => {
    const [w] = checkMeds(ix, ['atorvastatin']).filter((w) => w.food.id === 'grapefruit')
    expect(w.severity).toBe('caution')
    expect(w.hits.map((h) => [h.drug.id, h.interaction.id, h.via])).toEqual([
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
    expect(grapefruit.hits.map((h) => [h.drug.id, h.interaction.severity])).toEqual([
      ['simvastatin', 'avoid'],
      ['atorvastatin', 'caution'],
    ])
    const alcohol = warnings[1]
    expect(alcohol.hits.map((h) => h.drug.id)).toEqual(['warfarin', 'atorvastatin', 'simvastatin'])
  })

  it('collects map keys for drugs, foods, interaction drugs and mechanisms', () => {
    const keys = mapKeysFor(checkMeds(ix, ['atorvastatin']), ['atorvastatin'])
    expect([...keys].sort()).toEqual([
      'drug:atorvastatin',
      'drug:statins',
      'food:alcohol',
      'food:grapefruit',
      'mechanism:m',
    ])
  })
})
