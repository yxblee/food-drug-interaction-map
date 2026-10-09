import { describe, expect, it } from 'vite-plus/test'
import type { GraphNode, GraphInteraction } from '@fdi/schema'
import { buildIndex } from '@fdi/schema/domain'
import { srRows } from './srRows.ts'

const node = (kind: GraphNode['kind'], id: string, name: string): GraphNode => ({
  kind,
  id,
  name,
  aliases: [],
  group: false,
})
const nodes = [
  node('drug', 'simvastatin', 'Simvastatin'),
  node('food', 'grapefruit', 'Grapefruit'),
  node('mechanism', 'cyp3a4', 'CYP3A4 inhibition'),
]
const interactions: GraphInteraction[] = [
  {
    id: 'grapefruit--simvastatin',
    food: 'grapefruit',
    drug: 'simvastatin',
    mechanisms: ['cyp3a4'],
    severity: 'avoid',
    effect: 'increases',
    summary: 'Raises statin levels.',
    advice: '',
  },
]
const ix = buildIndex(nodes, interactions)

describe('srRows', () => {
  it('is empty when nothing is selected', () => {
    expect(srRows(ix, null)).toEqual([])
  })
  it.each(['drug:simvastatin', 'food:grapefruit', 'mechanism:cyp3a4'])(
    'describes the interactions of %s',
    (key) => {
      expect(srRows(ix, key)).toEqual(['Grapefruit with Simvastatin: avoid. Raises statin levels.'])
    },
  )
})
