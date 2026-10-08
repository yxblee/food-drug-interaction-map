import type { GraphPayload, Kind, Severity } from '@fdi/schema'
import {
  SEVERITY_RANK,
  interactionsForDrug,
  interactionsForFood,
  interactionsForMechanism,
  nodeKey,
  splitKey,
  type Index,
} from '@fdi/schema/domain'

export interface RenderNode {
  key: string
  kind: Kind
  id: string
  name: string
  group: boolean
  weight: number
}
export interface RenderLink {
  source: string
  target: string
  kind: 'interaction' | 'member'
  severity?: Severity
}
export interface RenderGraph {
  nodes: RenderNode[]
  links: RenderLink[]
}

export const nodeRadius = (n: RenderNode) => (n.kind === 'mechanism' ? 5 : 6 + Math.sqrt(n.weight) * 3)

export function toRenderGraph(g: GraphPayload, opts: { mechanisms: boolean }): RenderGraph {
  const weight = new Map<string, number>()
  const bump = (k: string) => weight.set(k, (weight.get(k) ?? 0) + 1)
  const links = new Map<string, RenderLink>()
  const addLink = (source: string, target: string, severity: Severity) => {
    const k = `${source}>${target}`
    const prev = links.get(k)
    if (!prev || SEVERITY_RANK[severity] < SEVERITY_RANK[prev.severity!]) {
      links.set(k, { source, target, kind: 'interaction', severity })
    }
  }
  const usedMechanisms = new Set<string>()

  for (const i of g.interactions) {
    const food = nodeKey('food', i.food)
    const drug = nodeKey('drug', i.drug)
    bump(food)
    bump(drug)
    if (!opts.mechanisms) {
      addLink(food, drug, i.severity)
      continue
    }
    for (const m of i.mechanisms) {
      const mech = nodeKey('mechanism', m)
      usedMechanisms.add(mech)
      bump(mech)
      addLink(food, mech, i.severity)
      addLink(mech, drug, i.severity)
    }
  }

  const nodes = g.nodes
    .map((n) => ({ n, key: nodeKey(n.kind, n.id) }))
    .filter(({ n, key }) => n.kind !== 'mechanism' || usedMechanisms.has(key))
    .map(({ n, key }) => ({ key, kind: n.kind, id: n.id, name: n.name, group: n.group, weight: weight.get(key) ?? 0 }))
  const members: RenderLink[] = g.nodes
    .filter((n) => n.parent)
    .map((n) => ({ source: nodeKey(n.kind, n.id), target: nodeKey(n.kind, n.parent!), kind: 'member' }))
  return { nodes, links: [...links.values(), ...members] }
}

export function filterRenderGraph(rg: RenderGraph, keys: Set<string>): RenderGraph {
  return {
    nodes: rg.nodes.filter((n) => keys.has(n.key)),
    links: rg.links.filter((l) => keys.has(l.source) && keys.has(l.target)),
  }
}

export function computeFocus(ix: Index, selected: string | null, highlighted: Set<string> | null): Set<string> | null {
  if (!selected) return highlighted
  const [kind, id] = splitKey(selected)
  const rows =
    kind === 'drug'
      ? interactionsForDrug(ix, id)
      : kind === 'food'
        ? interactionsForFood(ix, id)
        : interactionsForMechanism(ix, id)
  const focus = new Set([selected])
  const node = ix.nodes.get(selected)
  if (node?.parent) focus.add(nodeKey(kind, node.parent))
  for (const n of ix.nodes.values()) if (n.kind === kind && n.parent === id) focus.add(nodeKey(n.kind, n.id))
  for (const { interaction: i } of rows) {
    focus.add(nodeKey('food', i.food))
    focus.add(nodeKey('drug', i.drug))
    for (const m of i.mechanisms) focus.add(nodeKey('mechanism', m))
  }
  return focus
}
