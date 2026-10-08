import { describe, expect, it } from 'vite-plus/test'
import type { GraphInteraction, GraphNode } from './api.ts'
import {
  buildIndex,
  interactionsForDrug,
  interactionsForFood,
  interactionsForMechanism,
  nodeKey,
  searchNodes,
  splitKey,
} from './domain.ts'

const n = (
  kind: GraphNode['kind'],
  id: string,
  name: string,
  extra: Partial<GraphNode> = {},
): GraphNode => ({
  kind,
  id,
  name,
  aliases: [],
  group: false,
  ...extra,
})

const nodes: GraphNode[] = [
  n('drug', 'statins', 'Statins', { group: true }),
  n('drug', 'simvastatin', 'Simvastatin', { aliases: ['Zocor'], parent: 'statins' }),
  n('drug', 'atorvastatin', 'Atorvastatin', { aliases: ['Lipitor'], parent: 'statins' }),
  n('drug', 'warfarin', 'Warfarin', { aliases: ['Coumadin'] }),
  n('food', 'citrus', 'Citrus', { group: true }),
  n('food', 'grapefruit', 'Grapefruit', { parent: 'citrus' }),
  n('food', 'orange', 'Orange', { parent: 'citrus' }),
  n('food', 'leafy-greens', 'Leafy greens', { group: true }),
  n('food', 'kale', 'Kale', { parent: 'leafy-greens', aliases: ['curly kale'] }),
  n('mechanism', 'cyp3a4-inhibition', 'CYP3A4 inhibition'),
  n('mechanism', 'vitamin-k-antagonism', 'Vitamin K counteraction'),
]

const i = (
  food: string,
  drug: string,
  severity: GraphInteraction['severity'],
  mechanisms = ['cyp3a4-inhibition'],
): GraphInteraction => ({
  id: `${food}--${drug}`,
  food,
  drug,
  mechanisms,
  severity,
  effect: 'increases',
  summary: 's',
  advice: 'a',
})

const interactions = [
  i('citrus', 'statins', 'caution'),
  i('grapefruit', 'statins', 'caution'),
  i('grapefruit', 'simvastatin', 'avoid'),
  i('orange', 'simvastatin', 'minimal'),
  i('leafy-greens', 'warfarin', 'caution', ['vitamin-k-antagonism']),
]
const ix = buildIndex(nodes, interactions)
const ids = (rows: { interaction: { id: string }; via?: string }[]) =>
  rows.map((r) => [r.interaction.id, r.via])

describe('keys', () => {
  it('round-trips', () => {
    expect(nodeKey('food', 'kale')).toBe('food:kale')
    expect(splitKey('food:kale')).toEqual(['food', 'kale'])
  })
})

describe('interactionsForDrug', () => {
  it('lets an exact drug interaction replace the inherited class one for the same food', () => {
    expect(ids(interactionsForDrug(ix, 'simvastatin'))).toEqual([
      ['grapefruit--simvastatin', undefined],
      ['citrus--statins', 'statins'],
      ['orange--simvastatin', undefined],
    ])
  })
  it('inherits class interactions for a drug with none of its own', () => {
    expect(ids(interactionsForDrug(ix, 'atorvastatin'))).toEqual([
      ['citrus--statins', 'statins'],
      ['grapefruit--statins', 'statins'],
    ])
  })
  it('returns [] for unknown ids', () => {
    expect(interactionsForDrug(ix, 'nope')).toEqual([])
  })
})

describe('interactionsForFood', () => {
  it('inherits group interactions, exact ones win per drug', () => {
    expect(ids(interactionsForFood(ix, 'kale'))).toEqual([
      ['leafy-greens--warfarin', 'leafy-greens'],
    ])
    expect(ids(interactionsForFood(ix, 'grapefruit'))).toEqual([
      ['grapefruit--simvastatin', undefined],
      ['grapefruit--statins', undefined],
    ])
  })
})

describe('interactionsForMechanism', () => {
  it('lists every interaction using the mechanism, by severity', () => {
    expect(ids(interactionsForMechanism(ix, 'vitamin-k-antagonism'))).toEqual([
      ['leafy-greens--warfarin', undefined],
    ])
    expect(interactionsForMechanism(ix, 'cyp3a4-inhibition')[0].interaction.id).toBe(
      'grapefruit--simvastatin',
    )
  })
})

describe('searchNodes', () => {
  it('matches brand aliases and reports what matched', () => {
    expect(searchNodes(nodes, 'zoc')).toEqual([
      { kind: 'drug', id: 'simvastatin', name: 'Simvastatin', matched: 'Zocor', group: false },
    ])
  })
  it('ranks prefix matches above substring matches', () => {
    expect(searchNodes(nodes, 'gr').map((r) => r.id)).toEqual(['grapefruit', 'leafy-greens'])
  })
  it('is case-insensitive and includes mechanisms', () => {
    expect(searchNodes(nodes, 'CYP3A4').map((r) => r.id)).toEqual(['cyp3a4-inhibition'])
  })
  it('treats special characters literally and ignores blank queries', () => {
    expect(searchNodes(nodes, '(')).toEqual([])
    expect(searchNodes(nodes, '.*')).toEqual([])
    expect(searchNodes(nodes, '   ')).toEqual([])
  })
  it('respects the limit', () => {
    expect(searchNodes(nodes, 'a', 2)).toHaveLength(2)
  })
})
