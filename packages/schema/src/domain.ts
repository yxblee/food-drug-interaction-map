import type {
  GraphInteraction,
  GraphNode,
  Kind,
  ResolvedInteraction,
  ResolvedPairing,
  SearchResult,
} from './api.ts'
import type { Pairing, Severity } from './entities.ts'

export const KINDS: readonly Kind[] = ['drug', 'food', 'mechanism']
export const SEVERITY_RANK: Record<Severity, number> = {
  avoid: 0,
  caution: 1,
  monitor: 2,
  minimal: 3,
}

// Glossary term for a group of this kind (Drug class / Food group).
export const groupTerm = (kind: Kind) => (kind === 'drug' ? 'Drug class' : 'Food group')

export const nodeKey = (kind: Kind, id: string) => `${kind}:${id}`

export function splitKey(key: string): [Kind, string] {
  const at = key.indexOf(':')
  return [key.slice(0, at) as Kind, key.slice(at + 1)]
}

export interface Index<I extends GraphInteraction = GraphInteraction> {
  nodes: Map<string, GraphNode>
  interactions: I[]
  pairings: Pairing[]
}

export function buildIndex<I extends GraphInteraction>(
  nodes: GraphNode[],
  interactions: I[],
  pairings: Pairing[] = [],
): Index<I> {
  return { nodes: new Map(nodes.map((n) => [nodeKey(n.kind, n.id), n])), interactions, pairings }
}

// Helpful pairings resolve like Interactions: one row per counterpart, the exact node's own
// pairing replacing one inherited from its parent class/group. Sorted by id; there is no Severity.
function resolvePairings(ix: Index, side: 'drug' | 'food', id: string): ResolvedPairing[] {
  const self = ix.nodes.get(nodeKey(side, id))
  if (!self) return []
  const other = side === 'drug' ? 'food' : 'drug'
  const rows = new Map<string, ResolvedPairing>()
  for (const pairing of ix.pairings) if (pairing[side] === id) rows.set(pairing[other], { pairing })
  if (self.parent) {
    for (const pairing of ix.pairings) {
      if (pairing[side] === self.parent && !rows.has(pairing[other]))
        rows.set(pairing[other], { pairing, inheritedFrom: self.parent })
    }
  }
  return [...rows.values()].sort((a, b) => a.pairing.id.localeCompare(b.pairing.id))
}

export const pairingsForDrug = (ix: Index, drugId: string) => resolvePairings(ix, 'drug', drugId)
export const pairingsForFood = (ix: Index, foodId: string) => resolvePairings(ix, 'food', foodId)

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
        rows.set(i[other], { interaction: i, inheritedFrom: self.parent })
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
  const found: { rank: number; matched: string; node: GraphNode }[] = []
  for (const node of nodes) {
    let best: { rank: number; matched: string } | undefined
    for (const term of [node.name, ...node.aliases]) {
      const t = term.toLowerCase()
      const rank = t.startsWith(needle) ? 0 : t.includes(needle) ? 1 : -1
      if (rank >= 0 && (!best || rank < best.rank)) best = { rank, matched: term }
    }
    if (best) found.push({ ...best, node })
  }
  found.sort((a, b) => a.rank - b.rank || a.node.name.localeCompare(b.node.name))
  return found.slice(0, limit).map(({ node, matched }) => ({
    kind: node.kind,
    id: node.id,
    name: node.name,
    matched,
    group: node.group,
  }))
}

// Damerau–Levenshtein (adjacent swap = 1 edit), so "atorvastain" is one edit from "atorvastatin".
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array<number>(b.length).fill(0),
  ])
  for (let j = 1; j <= b.length; j++) d[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1)
    }
  }
  return d[a.length]![b.length]!
}

/**
 * "Did you mean" fallback: when nothing matches `q` by prefix or substring, the nearest names
 * and Aliases by edit distance (about 1 edit per 4 characters, at most 2). Queries under 4
 * characters never guess. Kept apart from searchNodes so graph filtering never sees guesses.
 */
export function suggestNodes(nodes: GraphNode[], q: string, limit = 3): SearchResult[] {
  const needle = q.trim().toLowerCase()
  if (needle.length < 4 || searchNodes(nodes, needle, 1).length) return []
  const max = Math.min(2, Math.floor(needle.length / 4))
  const found: { dist: number; matched: string; node: GraphNode }[] = []
  for (const node of nodes) {
    let best: { dist: number; matched: string } | undefined
    for (const term of [node.name, ...node.aliases]) {
      const dist = editDistance(needle, term.toLowerCase())
      if (dist <= max && (!best || dist < best.dist)) best = { dist, matched: term }
    }
    if (best) found.push({ ...best, node })
  }
  found.sort((a, b) => a.dist - b.dist || a.node.name.localeCompare(b.node.name))
  return found.slice(0, limit).map(({ node, matched }) => ({
    kind: node.kind,
    id: node.id,
    name: node.name,
    matched,
    group: node.group,
  }))
}
