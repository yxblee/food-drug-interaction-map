import { DatabaseSync } from 'node:sqlite'
import {
  Citation,
  type Drug,
  type Food,
  type GraphNode,
  type GraphPayload,
  type Interaction,
  type Kind,
  type Mechanism,
  type NodeDetail,
  type Pairing,
  type SearchResult,
} from '@fdi/schema'
import {
  buildIndex,
  interactionsForDrug,
  interactionsForFood,
  interactionsForMechanism,
  nodeKey,
  pairingsForDrug,
  pairingsForFood,
  searchNodes,
} from '@fdi/schema/domain'

const CITATION_TYPES = Citation.shape.type.options

export interface Store {
  version: string
  graph: GraphPayload
  search(q: string): SearchResult[]
  detail(kind: Kind, id: string): NodeDetail | undefined
}

function toNode(kind: 'drug' | 'food', e: Drug | Food): GraphNode {
  const node: GraphNode = { kind, id: e.id, name: e.name, aliases: e.aliases, group: e.group }
  if (e.parent) node.parent = e.parent
  if ('medlineplus' in e && e.medlineplus) node.medlineplus = e.medlineplus
  if ('dailymed' in e && e.dailymed) node.dailymed = e.dailymed
  return node
}

export function loadStore(dbPath: string): Store {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  const rows = <T>(sql: string): T[] =>
    db
      .prepare(sql)
      .all()
      .map((r) => JSON.parse((r as { json: string }).json) as T)
  const drugs = rows<Drug>('SELECT json FROM drugs ORDER BY id')
  const foods = rows<Food>('SELECT json FROM foods ORDER BY id')
  const mechanisms = rows<Mechanism>('SELECT json FROM mechanisms ORDER BY id')
  const interactions = rows<Interaction>(
    "SELECT json FROM interactions WHERE status = 'approved' ORDER BY id",
  )
  const pairings = rows<Pairing>('SELECT json FROM pairings ORDER BY id')
  const { value: version } = db.prepare("SELECT value FROM meta WHERE key = 'version'").get() as {
    value: string
  }
  db.close()

  const entities = new Map<string, Drug | Food | Mechanism>()
  for (const d of drugs) entities.set(nodeKey('drug', d.id), d)
  for (const f of foods) entities.set(nodeKey('food', f.id), f)
  for (const m of mechanisms) entities.set(nodeKey('mechanism', m.id), m)
  const mechanismById = new Map(mechanisms.map((m) => [m.id, m]))

  const nodes: GraphNode[] = [
    ...drugs.map((d) => toNode('drug', d)),
    ...foods.map((f) => toNode('food', f)),
    ...mechanisms.map((m): GraphNode => ({
      kind: 'mechanism',
      id: m.id,
      name: m.name,
      aliases: [],
      group: false,
    })),
  ]
  const ix = buildIndex(nodes, interactions, pairings)
  const graph: GraphPayload = {
    version,
    stats: {
      reviewedAt: interactions.reduce<string | null>(
        (max, i) => (i.reviewed_at && (!max || i.reviewed_at > max) ? i.reviewed_at : max),
        null,
      ),
      citationTypes: CITATION_TYPES.filter((t) =>
        interactions.some((i) => i.citations.some((c) => c.type === t)),
      ),
    },
    nodes,
    pairings,
    interactions: interactions.map(
      ({ id, food, drug, mechanisms, severity, effect, summary, advice }) => ({
        id,
        food,
        drug,
        mechanisms,
        severity,
        effect,
        summary,
        advice,
      }),
    ),
  }

  function detail(kind: Kind, id: string): NodeDetail | undefined {
    const node = ix.nodes.get(nodeKey(kind, id))
    if (!node) return undefined
    const resolved =
      kind === 'drug'
        ? interactionsForDrug(ix, id)
        : kind === 'food'
          ? interactionsForFood(ix, id)
          : interactionsForMechanism(ix, id)
    const resolvedPairings =
      kind === 'drug' ? pairingsForDrug(ix, id) : kind === 'food' ? pairingsForFood(ix, id) : []
    const refNodes: Record<string, GraphNode> = {}
    const refMechanisms: Record<string, Mechanism> = {}
    for (const { interaction: i } of resolved) {
      for (const key of [nodeKey('food', i.food), nodeKey('drug', i.drug)]) {
        refNodes[key] = ix.nodes.get(key)!
      }
      for (const m of i.mechanisms) refMechanisms[m] = mechanismById.get(m)!
    }
    for (const { pairing: p } of resolvedPairings) {
      for (const key of [nodeKey('food', p.food), nodeKey('drug', p.drug)]) {
        refNodes[key] = ix.nodes.get(key)!
      }
      for (const m of p.mechanisms) refMechanisms[m] = mechanismById.get(m)!
    }
    return {
      node,
      entity: entities.get(nodeKey(kind, id))!,
      parent: node.parent ? (ix.nodes.get(nodeKey(kind, node.parent)) ?? null) : null,
      children: node.group ? nodes.filter((n) => n.kind === kind && n.parent === id) : [],
      interactions: resolved,
      pairings: resolvedPairings,
      mechanisms: refMechanisms,
      nodes: refNodes,
    }
  }

  return { version, graph, search: (q) => searchNodes(nodes, q), detail }
}
