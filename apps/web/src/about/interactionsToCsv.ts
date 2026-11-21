import type { GraphPayload } from '@fdi/schema'

const NOTE =
  'Approved Interactions from the Food-Drug Interaction Map. Absence from this file does not mean a combination is safe. Informational only, not medical advice.'
const HEADER = [
  'Drug',
  'Food',
  'Severity',
  'Effect',
  'Mechanisms',
  'Summary',
  'Reviewed',
  'Citation URLs',
]

/** RFC 4180: quote a cell holding a comma, quote or line break; double the quotes inside. */
const cell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s)

/**
 * The Approved Interactions as CSV text, one row per recorded Interaction (Drug class and Food
 * group names as recorded, not expanded). Several Mechanisms are joined with "; ", Citation URLs
 * with a space. Helpful pairings are not Interactions and stay out.
 */
export function interactionsToCsv(graph: GraphPayload): string {
  const names = new Map(graph.nodes.map((n) => [`${n.kind}:${n.id}`, n.name]))
  const name = (kind: string, id: string) => names.get(`${kind}:${id}`) ?? id
  const rows = graph.interactions.map((i) => [
    name('drug', i.drug),
    name('food', i.food),
    i.severity,
    i.effect,
    i.mechanisms.map((m) => name('mechanism', m)).join('; '),
    i.summary,
    i.reviewed_at ?? '',
    i.citations.map((c) => c.url).join(' '),
  ])
  return [[NOTE], HEADER, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

export function csvFileName(graph: GraphPayload): string {
  const d = graph.stats.reviewedAt
  return `food-drug-interactions${d ? `-${d}` : ''}.csv`
}
