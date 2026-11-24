import { describe, expect, it } from 'vite-plus/test'
import type { Interaction, ResolvedInteraction, Severity } from '@fdi/schema'
import { jumpLinks, panelGroups, severityGroups } from './panelGroups.ts'

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

  it('names the Drug class or Food group each run is inherited from', () => {
    const { groups } = panelGroups([
      row('a', 'avoid', 'statins'),
      row('b', 'avoid', 'statins'),
      row('c', 'caution', 'statins'),
      row('d', 'caution'),
    ])
    expect(groups.map((g) => g.runs.map((r) => r.inheritedFrom))).toEqual([
      ['statins'],
      [undefined, 'statins'],
    ])
  })

  it('splits a mixed Severity group into direct rows first, then one run per inherited source', () => {
    const { groups } = panelGroups([
      row('a', 'avoid', 'citrus'),
      row('b', 'avoid'),
      row('c', 'avoid', 'relatives'),
      row('d', 'avoid'),
      row('e', 'avoid', 'citrus'),
    ])
    expect(
      groups[0].runs.map((r) => [r.inheritedFrom, r.rows.map((x) => x.interaction.id)]),
    ).toEqual([
      [undefined, ['b', 'd']],
      ['citrus', ['a', 'e']],
      ['relatives', ['c']],
    ])
    expect(groups[0].rows).toHaveLength(5)
  })

  it('keeps all-direct and all-inherited groups as a single run', () => {
    const { groups } = panelGroups([row('a', 'avoid'), row('b', 'caution', 'statins')])
    expect(groups.map((g) => g.runs.map((r) => r.inheritedFrom))).toEqual([
      [undefined],
      ['statins'],
    ])
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

describe('severityGroups (My meds Foods to watch)', () => {
  const food = (id: string, severity: Severity) => ({ id, severity })
  const foods = [
    food('a', 'caution'),
    food('b', 'avoid'),
    food('c', 'minimal'),
    food('d', 'caution'),
    food('e', 'avoid'),
    food('f', 'monitor'),
  ]

  it('groups Foods by Severity, most severe first, and collapses above five', () => {
    const { collapsed, groups } = severityGroups(foods)
    expect(groups.map((g) => [g.severity, g.rows.map((f) => f.id)])).toEqual([
      ['avoid', ['b', 'e']],
      ['caution', ['a', 'd']],
      ['monitor', ['f']],
      ['minimal', ['c']],
    ])
    expect(collapsed).toBe(true)
  })

  it('leaves five or fewer Foods expanded', () => {
    expect(severityGroups(foods.slice(0, 5)).collapsed).toBe(false)
    expect(severityGroups([])).toEqual({ collapsed: false, groups: [] })
  })

  it('feeds the same jump links as the Explore panel', () => {
    expect(jumpLinks(severityGroups(foods).groups, true, 'helps-title')).toEqual([
      { id: 'sev-avoid', severity: 'avoid', count: 2 },
      { id: 'sev-caution', severity: 'caution', count: 2 },
      { id: 'sev-monitor', severity: 'monitor', count: 1 },
      { id: 'sev-minimal', severity: 'minimal', count: 1 },
      { id: 'helps-title', count: 0 },
    ])
  })
})
