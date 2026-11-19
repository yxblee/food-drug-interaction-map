import type { Interaction } from './entities.ts'

/** Ids of Approved `avoid` Interactions with fewer than two Citations (#135). */
export function citationGaps(interactions: Interaction[]): string[] {
  return interactions
    .filter((i) => i.status === 'approved' && i.severity === 'avoid' && i.citations.length < 2)
    .map((i) => i.id)
}
