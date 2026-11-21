import type { Citation, GraphPayload, Severity } from '@fdi/schema'
import { nodeKey } from '@fdi/schema/domain'

/** Counts and dates shown in "About the data", read from the loaded Dataset, never hard-coded. */
export function datasetFacts(graph: GraphPayload) {
  const count = (kind: 'drug' | 'food') =>
    graph.nodes.filter((n) => n.kind === kind && !n.group).length
  return {
    drugs: count('drug'),
    foods: count('food'),
    interactions: graph.interactions.length,
    reviewedAt: graph.stats.reviewedAt,
    citationTypes: graph.stats.citationTypes,
  }
}

/** Plain-words names for the Citation types, shown to people under "Sources". */
export const SOURCE_KINDS: Record<Citation['type'], string> = {
  label: 'Drug labels (the official prescribing information, from DailyMed)',
  review: 'Peer-reviewed reviews',
  study: 'Individual studies',
  guideline: 'Clinical guidelines',
}

export function formatReviewed(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** NLM asks apps that use RxNorm to show this. Kept word for word as in docs/data-sources.md. */
export const RXNORM_ATTRIBUTION =
  'This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.'

export interface RecentInteraction {
  id: string
  food: { id: string; name: string }
  drug: { id: string; name: string }
  severity: Severity
  reviewedAt: string
}

const RECENT_LIMIT = 8

/**
 * The most recently reviewed Approved Interactions, newest first, ties by Food then Drug name.
 * The graph holds only Approved Interactions; one with no review date has nothing to show.
 */
export function recentlyReviewed(graph: GraphPayload): RecentInteraction[] {
  const names = new Map(graph.nodes.map((n) => [nodeKey(n.kind, n.id), n.name]))
  const named = (kind: 'food' | 'drug', id: string) => ({
    id,
    name: names.get(nodeKey(kind, id)) ?? id,
  })
  return graph.interactions
    .flatMap((i) =>
      i.reviewed_at
        ? [
            {
              id: i.id,
              food: named('food', i.food),
              drug: named('drug', i.drug),
              severity: i.severity,
              reviewedAt: i.reviewed_at,
            },
          ]
        : [],
    )
    .sort(
      (a, b) =>
        b.reviewedAt.localeCompare(a.reviewedAt) ||
        a.food.name.localeCompare(b.food.name) ||
        a.drug.name.localeCompare(b.drug.name),
    )
    .slice(0, RECENT_LIMIT)
}
