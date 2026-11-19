import { describe, expect, it } from 'vite-plus/test'
import type { GraphInteraction, GraphNode } from '@fdi/schema'
import { nodeKey } from '@fdi/schema/domain'
import { browseKeys } from './browse.ts'
import {
  browseGroups,
  browseLabel,
  isSlashFocus,
  matchCountLabel,
  searchPlaceholder,
} from './searchUi.ts'

describe('matchCountLabel', () => {
  it('announces the count with correct plurals', () => {
    expect(matchCountLabel(0)).toBe('0 matches')
    expect(matchCountLabel(1)).toBe('1 match')
    expect(matchCountLabel(12)).toBe('12 matches')
  })
})

describe('isSlashFocus', () => {
  const key = (k: string, tag = 'DIV', mods = {}) =>
    ({ key: k, target: { tagName: tag, isContentEditable: false }, ...mods }) as never
  it('fires on "/" outside text fields only', () => {
    expect(isSlashFocus(key('/'))).toBe(true)
    expect(isSlashFocus(key('/', 'INPUT'))).toBe(false)
    expect(isSlashFocus(key('/', 'TEXTAREA'))).toBe(false)
    expect(isSlashFocus(key('a'))).toBe(false)
    expect(isSlashFocus(key('/', 'DIV', { ctrlKey: true }))).toBe(false)
  })
})

describe('searchPlaceholder', () => {
  it('shows the "/" hint only when a keyboard is likely', () => {
    expect(searchPlaceholder(true)).toContain('( / )')
    expect(searchPlaceholder(false)).not.toContain('/')
  })
})

describe('browseGroups (empty query)', () => {
  const n = (kind: GraphNode['kind'], id: string, name: string, extra = {}): GraphNode => ({
    kind,
    id,
    name,
    aliases: [],
    group: false,
    ...extra,
  })
  const nodes = [
    n('food', 'orange', 'Orange'),
    n('drug', 'warfarin', 'Warfarin'),
    n('mechanism', 'cyp3a4', 'CYP3A4'),
    n('food', 'grapefruit', 'Grapefruit'),
    n('drug', 'statins', 'Statins', { group: true }),
    n('drug', 'simvastatin', 'Simvastatin', { parent: 'statins' }),
  ]
  const ix = (food: string, drug: string) =>
    ({
      id: `${food}--${drug}`,
      food,
      drug,
      mechanisms: [],
      severity: 'major',
    }) as unknown as GraphInteraction
  const interactions = [ix('grapefruit', 'statins'), ix('orange', 'warfarin')]

  it('lists Drugs then Foods, A-Z, with Interaction counts (inherited ones included)', () => {
    const { drugs, foods } = browseGroups(nodes, interactions)
    expect(drugs.map((r) => [r.name, r.count])).toEqual([
      ['Simvastatin', 1],
      ['Statins', 1],
      ['Warfarin', 1],
    ])
    expect(foods.map((r) => [r.name, r.count])).toEqual([
      ['Grapefruit', 1],
      ['Orange', 1],
    ])
  })

  it('has the same keys as browseKeys, minus Mechanisms', () => {
    const { drugs, foods } = browseGroups(nodes, interactions)
    const keys = [...drugs, ...foods].map((r) => nodeKey(r.kind, r.id))
    const expected = browseKeys(nodes, '').filter((k) => !k.startsWith('mechanism:'))
    expect([...keys].sort()).toEqual([...expected].sort())
    expect(drugs.map((r) => r.id)).toEqual(
      expected.filter((k) => k.startsWith('drug:')).map((k) => k.slice(5)),
    )
  })

  it('announces the counts', () => {
    expect(browseLabel(75, 37)).toBe('75 Drugs, 37 Foods')
    expect(browseLabel(1, 1)).toBe('1 Drug, 1 Food')
  })
})
