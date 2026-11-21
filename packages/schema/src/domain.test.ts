import { describe, expect, it } from 'vite-plus/test'
import type { GraphInteraction, GraphNode } from './api.ts'
import type { Pairing } from './entities.ts'
import {
  buildIndex,
  interactionsForDrug,
  interactionsForFood,
  interactionsForMechanism,
  nodeKey,
  pairingsForDrug,
  pairingsForFood,
  searchNodes,
  splitKey,
  suggestNodes,
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
  n('food', 'sample-fruits', 'Sample fruits', { group: true }),
  n('food', 'grapefruit', 'Grapefruit', { parent: 'sample-fruits' }),
  n('food', 'orange', 'Orange', { parent: 'sample-fruits' }),
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
  citations: [],
})

const interactions = [
  i('sample-fruits', 'statins', 'caution'),
  i('grapefruit', 'statins', 'caution'),
  i('grapefruit', 'simvastatin', 'avoid'),
  i('orange', 'simvastatin', 'minimal'),
  i('leafy-greens', 'warfarin', 'caution', ['vitamin-k-antagonism']),
]
const ix = buildIndex(nodes, interactions)
const ids = (rows: { interaction: { id: string }; inheritedFrom?: string }[]) =>
  rows.map((r) => [r.interaction.id, r.inheritedFrom])

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
      ['sample-fruits--statins', 'statins'],
      ['orange--simvastatin', undefined],
    ])
  })
  it('inherits class interactions for a drug with none of its own', () => {
    expect(ids(interactionsForDrug(ix, 'atorvastatin'))).toEqual([
      ['grapefruit--statins', 'statins'],
      ['sample-fruits--statins', 'statins'],
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

describe('suggestNodes', () => {
  const ids = (q: string) => suggestNodes(nodes, q).map((r) => r.id)
  it('suggests the nearest name for a typo', () => {
    expect(ids('atorvastain')).toEqual(['atorvastatin'])
    expect(ids('grapefuit')).toEqual(['grapefruit'])
  })
  it('suggests the Drug behind a misspelled brand and reports it', () => {
    expect(suggestNodes(nodes, 'Lipiter')).toEqual([
      { kind: 'drug', id: 'atorvastatin', name: 'Atorvastatin', matched: 'Lipitor', group: false },
    ])
  })
  it('matches typos in Aliases and caps long queries at 2 edits', () => {
    expect(ids('coumadim')).toEqual(['warfarin'])
    expect(ids('atorvastatim')).toEqual(['atorvastatin'])
    expect(ids('atorvastxtxn')).toEqual(['atorvastatin'])
    expect(ids('atorvaxtxtxn')).toEqual([])
  })
  it('suggests nothing when something matches exactly or partially', () => {
    expect(ids('grape')).toEqual([])
    expect(ids('atorvastatin')).toEqual([])
  })
  it('never guesses for queries under 4 characters', () => {
    expect(ids('kal')).toEqual([])
    expect(ids('kaly')).toEqual(['kale'])
  })
  it('returns nothing for far-off queries and caps at 3', () => {
    expect(ids('zzzzzzzz')).toEqual([])
    expect(ids('a'.repeat(5000))).toEqual([])
    const many = ['aaaab', 'aaaac', 'aaaad', 'aaaae'].map((x) => n('drug', x, x))
    expect(suggestNodes(many, 'aaaaf')).toHaveLength(3)
  })
})

describe('pairings', () => {
  const pairing = (food: string, drug: string): Pairing => ({
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
  const ix = buildIndex(
    nodes,
    [],
    [
      pairing('kale', 'statins'),
      pairing('kale', 'simvastatin'),
      pairing('leafy-greens', 'warfarin'),
      pairing('orange', 'atorvastatin'),
    ],
  )
  it('inherits Drug class pairings, an exact one replacing the class one for the same Food', () => {
    expect(pairingsForDrug(ix, 'simvastatin').map((r) => [r.pairing.id, r.inheritedFrom])).toEqual([
      ['kale--simvastatin', undefined],
    ])
    expect(pairingsForDrug(ix, 'atorvastatin').map((r) => [r.pairing.id, r.inheritedFrom])).toEqual(
      [
        ['kale--statins', 'statins'],
        ['orange--atorvastatin', undefined],
      ],
    )
  })
  it('inherits Food group pairings for a member Food', () => {
    expect(pairingsForFood(ix, 'kale').map((r) => [r.pairing.id, r.inheritedFrom])).toEqual([
      ['kale--simvastatin', undefined],
      ['kale--statins', undefined],
      ['leafy-greens--warfarin', 'leafy-greens'],
    ])
  })
  it('returns [] for unknown ids and for an index built without pairings', () => {
    expect(pairingsForDrug(ix, 'nope')).toEqual([])
    expect(pairingsForFood(buildIndex(nodes, []), 'kale')).toEqual([])
  })
})
