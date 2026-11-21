import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import type { GraphPayload } from '@fdi/schema'
import { RXNORM_ATTRIBUTION, datasetFacts, formatReviewed, recentlyReviewed } from './facts.ts'

const node = (kind: 'drug' | 'food' | 'mechanism', id: string, group = false) => ({
  kind,
  id,
  name: id,
  aliases: [],
  group,
})
const graph: GraphPayload = {
  version: 'v',
  stats: { reviewedAt: '2026-10-08', citationTypes: ['label', 'review'] },
  nodes: [
    node('drug', 'simvastatin'),
    node('drug', 'statins', true),
    node('food', 'grapefruit'),
    node('food', 'kale'),
    node('mechanism', 'cyp3a4'),
  ],
  interactions: [],
  pairings: [],
}

describe('datasetFacts', () => {
  it('counts individual Drugs and Foods, not groups or Mechanisms', () => {
    expect(datasetFacts(graph)).toMatchObject({ drugs: 1, foods: 2, interactions: 0 })
  })
  it('passes the review date and Source kinds through', () => {
    expect(datasetFacts(graph)).toMatchObject({
      reviewedAt: '2026-10-08',
      citationTypes: ['label', 'review'],
    })
  })
})

it('formats the date without a timezone shift', () => {
  expect(formatReviewed('2026-10-08')).toBe('October 8, 2026')
})

it('RxNorm attribution matches docs/data-sources.md', () => {
  const doc = readFileSync(join(import.meta.dirname, '../../../../docs/data-sources.md'), 'utf8')
  expect(doc).toContain(`> ${RXNORM_ATTRIBUTION}`)
})

describe('recentlyReviewed', () => {
  const ix = (food: string, drug: string, reviewed_at?: string, severity = 'caution') =>
    ({
      id: `${food}-${drug}`,
      food,
      drug,
      severity,
      reviewed_at,
    }) as unknown as GraphPayload['interactions'][number]
  const withIx = (interactions: GraphPayload['interactions'], extra = graph.nodes): GraphPayload => ({
    ...graph,
    nodes: extra,
    interactions,
  })

  it('lists newest first and breaks date ties by Food then Drug name', () => {
    const g = withIx(
      [
        ix('kale', 'simvastatin', '2026-10-01'),
        ix('kale', 'statins', '2026-11-02'),
        ix('grapefruit', 'statins', '2026-11-02'),
        ix('grapefruit', 'simvastatin', '2026-11-02'),
      ],
      [
        node('drug', 'simvastatin'),
        node('drug', 'statins', true),
        node('food', 'grapefruit'),
        node('food', 'kale'),
      ],
    )
    expect(recentlyReviewed(g).map((r) => [r.food.id, r.drug.id, r.reviewedAt])).toEqual([
      ['grapefruit', 'simvastatin', '2026-11-02'],
      ['grapefruit', 'statins', '2026-11-02'],
      ['kale', 'statins', '2026-11-02'],
      ['kale', 'simvastatin', '2026-10-01'],
    ])
  })
  it('keeps at most 8, carries names and Severity, and skips ones with no review date', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...ix('kale', 'simvastatin', `2026-10-${String(i + 1).padStart(2, '0')}`),
      id: `i${i}`,
    }))
    const g = withIx([...many, ix('kale', 'simvastatin', undefined, 'avoid')])
    const out = recentlyReviewed(g)
    expect(out).toHaveLength(8)
    expect(out[0]).toMatchObject({ reviewedAt: '2026-10-10', severity: 'caution' })
    expect(out[0].food).toEqual({ id: 'kale', name: 'kale' })
    expect(out.some((r) => r.severity === 'avoid')).toBe(false)
  })
})
