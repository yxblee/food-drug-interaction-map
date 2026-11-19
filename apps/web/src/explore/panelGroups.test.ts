import { describe, expect, it } from 'vite-plus/test'
import type { Interaction, ResolvedInteraction, Severity } from '@fdi/schema'
import { jumpLinks, panelGroups } from './panelGroups.ts'

const row = (id: string, severity: Severity, inheritedFrom?: string) =>
  ({ interaction: { id, severity }, inheritedFrom }) as ResolvedInteraction<Interaction>

const many = [
  row('a', 'caution'),
  row('b', 'avoid'),
  row('c', 'minimal'),
  row('d', 'caution'),
  row('e', 'avoid'),
  row('f', 'caution'),
]

describe('panelGroups', () => {
  it('groups rows by Severity, most severe first, skipping empty groups', () => {
    const { groups } = panelGroups(many)
    expect(groups.map((g) => [g.severity, g.rows.map((r) => r.interaction.id)])).toEqual([
      ['avoid', ['b', 'e']],
      ['caution', ['a', 'd', 'f']],
      ['minimal', ['c']],
    ])
  })

  it('collapses rows only when the panel has more than five', () => {
    expect(panelGroups(many).collapsed).toBe(true)
    expect(panelGroups(many.slice(0, 5)).collapsed).toBe(false)
    expect(panelGroups([])).toEqual({ collapsed: false, groups: [] })
  })

  it('names the Drug class or Food group a whole Severity group is inherited from', () => {
    const { groups } = panelGroups([
      row('a', 'avoid', 'statins'),
      row('b', 'avoid', 'statins'),
      row('c', 'caution', 'statins'),
      row('d', 'caution'),
    ])
    expect(groups.map((g) => g.inheritedFrom)).toEqual(['statins', undefined])
  })
})

describe('jumpLinks', () => {
  it('lists one link per Severity group in panel order, with counts', () => {
    expect(jumpLinks(panelGroups(many).groups, false)).toEqual([
      { id: 'sev-avoid', severity: 'avoid', count: 2 },
      { id: 'sev-caution', severity: 'caution', count: 3 },
      { id: 'sev-minimal', severity: 'minimal', count: 1 },
    ])
  })

  it('adds Helpful pairings last', () => {
    const links = jumpLinks(panelGroups(many).groups, true)
    expect(links.at(-1)).toEqual({ id: 'pairs-title', count: 0 })
  })

  it('is empty with a single Severity group, even with pairings', () => {
    const one = panelGroups([row('a', 'caution'), row('b', 'caution')]).groups
    expect(jumpLinks(one, false)).toEqual([])
    expect(jumpLinks(one, true)).toEqual([])
  })
})
