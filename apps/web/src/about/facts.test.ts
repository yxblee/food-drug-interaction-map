import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import type { GraphPayload } from '@fdi/schema'
import { RXNORM_ATTRIBUTION, datasetFacts, formatReviewed } from './facts.ts'

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
