import type { GraphInteraction, GraphNode, Kind, ResolvedInteraction, SearchResult } from './api.ts'
import type { Severity } from './entities.ts'

export const KINDS: readonly Kind[] = ['drug', 'food', 'mechanism']
export const SEVERITY_RANK: Record<Severity, number> = {
  avoid: 0,
  caution: 1,
  monitor: 2,
  minimal: 3,
}

export const nodeKey = (kind: Kind, id: string) => `${kind}:${id}`

export function splitKey(key: string): [Kind, string] {
  const at = key.indexOf(':')
  return [key.slice(0, at) as Kind, key.slice(at + 1)]
}

export interface Index<I extends GraphInteraction = GraphInteraction> {
  nodes: Map<string, GraphNode>
  interactions: I[]
}

export function buildIndex<I extends GraphInteraction>(
  nodes: GraphNode[],
  interactions: I[],
): Index<I> {
  return { nodes: new Map(nodes.map((n) => [nodeKey(n.kind, n.id), n])), interactions }
}

function sortRows<I extends GraphInteraction>(rows: ResolvedInteraction<I>[]) {
  return rows.sort(
    (a, b) =>
      SEVERITY_RANK[a.interaction.severity] - SEVERITY_RANK[b.interaction.severity] ||
      a.interaction.id.localeCompare(b.interaction.id),
  )
}

// One row per counterpart. An interaction filed under this exact node replaces one
// inherited from its parent group/class for the same counterpart (spec §2 group resolution).
function resolveRows<I extends GraphInteraction>(ix: Index<I>, side: 'drug' | 'food', id: string) {
  const self = ix.nodes.get(nodeKey(side, id))
  if (!self) return []
  const other = side === 'drug' ? 'food' : 'drug'
  const rows = new Map<string, ResolvedInteraction<I>>()
  for (const i of ix.interactions) if (i[side] === id) rows.set(i[other], { interaction: i })
  if (self.parent) {
    for (const i of ix.interactions) {
      if (i[side] === self.parent && !rows.has(i[other])) {
        rows.set(i[other], { interaction: i, via: self.parent })
      }
    }
  }
  return sortRows([...rows.values()])
}

export const interactionsForDrug = <I extends GraphInteraction>(ix: Index<I>, drugId: string) =>
  resolveRows(ix, 'drug', drugId)

export const interactionsForFood = <I extends GraphInteraction>(ix: Index<I>, foodId: string) =>
  resolveRows(ix, 'food', foodId)

export const interactionsForMechanism = <I extends GraphInteraction>(
  ix: Index<I>,
  mechanismId: string,
) =>
  sortRows(
    ix.interactions
      .filter((i) => i.mechanisms.includes(mechanismId))
      .map((interaction) => ({ interaction })),
  )

export function searchNodes(nodes: GraphNode[], q: string, limit = 20): SearchResult[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  const hits: { rank: number; matched: string; node: GraphNode }[] = []
  for (const node of nodes) {
    let best: { rank: number; matched: string } | undefined
    for (const term of [node.name, ...node.aliases]) {
      const t = term.toLowerCase()
      const rank = t.startsWith(needle) ? 0 : t.includes(needle) ? 1 : -1
      if (rank >= 0 && (!best || rank < best.rank)) best = { rank, matched: term }
    }
    if (best) hits.push({ ...best, node })
  }
  hits.sort((a, b) => a.rank - b.rank || a.node.name.localeCompare(b.node.name))
  return hits.slice(0, limit).map(({ node, matched }) => ({
    kind: node.kind,
    id: node.id,
    name: node.name,
    matched,
    group: node.group,
  }))
}
