import { describe, expect, it } from 'vite-plus/test'
import type { GraphNode } from '@fdi/schema'
import { browseKeys, stepKey } from './browse.ts'

const nodes: GraphNode[] = [
  { kind: 'food', id: 'kale', name: 'Kale', aliases: [], group: false },
  { kind: 'drug', id: 'warfarin', name: 'Warfarin', aliases: ['Coumadin'], group: false },
  { kind: 'food', id: 'apple', name: 'Apple', aliases: [], group: false },
]

describe('browseKeys', () => {
  it('orders all nodes alphabetically when there is no query', () => {
    expect(browseKeys(nodes, '')).toEqual(['food:apple', 'food:kale', 'drug:warfarin'])
  })
  it('uses search results when there is a query', () => {
    expect(browseKeys(nodes, 'coum')).toEqual(['drug:warfarin'])
  })
})

describe('stepKey', () => {
  const keys = ['a', 'b', 'c']
  it('steps and wraps', () => {
    expect(stepKey(keys, 'a', 1)).toBe('b')
    expect(stepKey(keys, 'c', 1)).toBe('a')
    expect(stepKey(keys, 'a', -1)).toBe('c')
  })
  it('starts from an end when the current item is not in the list', () => {
    expect(stepKey(keys, 'zzz', 1)).toBe('a')
    expect(stepKey(keys, 'zzz', -1)).toBe('c')
  })
  it('returns null for an empty list', () => {
    expect(stepKey([], 'a', 1)).toBeNull()
  })
})
