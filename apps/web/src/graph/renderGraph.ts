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

export const nodeRadius = (n: RenderNode) =>
  n.kind === 'mechanism' ? 5 : 6 + Math.sqrt(n.weight) * 3

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
    .map(({ n, key }) => ({
      key,
      kind: n.kind,
      id: n.id,
      name: n.name,
      group: n.group,
      weight: weight.get(key) ?? 0,
    }))
  const members: RenderLink[] = g.nodes
    .filter((n) => n.parent)
    .map((n) => ({
      source: nodeKey(n.kind, n.id),
      target: nodeKey(n.kind, n.parent!),
      kind: 'member',
    }))
  return { nodes, links: [...links.values(), ...members] }
}

export function filterRenderGraph(rg: RenderGraph, keys: Set<string>): RenderGraph {
  return {
    nodes: rg.nodes.filter((n) => keys.has(n.key)),
    links: rg.links.filter((l) => keys.has(l.source) && keys.has(l.target)),
  }
}

export function computeFocus(
  ix: Index,
  selected: string | null,
  highlighted: Set<string> | null,
): Set<string> | null {
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
  for (const n of ix.nodes.values())
    if (n.kind === kind && n.parent === id) focus.add(nodeKey(n.kind, n.id))
  for (const { interaction: i } of rows) {
    focus.add(nodeKey('food', i.food))
    focus.add(nodeKey('drug', i.drug))
    for (const m of i.mechanisms) focus.add(nodeKey('mechanism', m))
  }
  return focus
}

/** Screen space covered by the side panel: framing happens in what is left. */
export interface Inset {
  right: number
  bottom: number
}
export const NO_INSET: Inset = { right: 0, bottom: 0 }
const FIT_PADDING = 56
const MAX_FIT_SCALE = 2.5

// A phone panel can leave only a thin strip; padding must not eat it.
const fitPadding = (size: { width: number; height: number }, inset: Inset, padding: number) =>
  Math.min(padding, 0.1 * Math.min(size.width - inset.right, size.height - inset.bottom))

/**
 * 2D: the zoom transform (origin at the viewport centre) that frames `points` in the
 * viewport minus `inset`, or null when there is nothing to frame.
 */
export function fitTransform(
  points: { x: number; y: number }[],
  size: { width: number; height: number },
  inset: Inset,
  padding = FIT_PADDING,
) {
  if (!points.length) return null
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const pad = fitPadding(size, inset, padding)
  const availW = Math.max(1, size.width - inset.right - 2 * pad)
  const availH = Math.max(1, size.height - inset.bottom - 2 * pad)
  const k = Math.min(MAX_FIT_SCALE, availW / Math.max(x1 - x0, 1), availH / Math.max(y1 - y0, 1))
  return {
    k,
    x: -inset.right / 2 - (k * (x0 + x1)) / 2,
    y: -inset.bottom / 2 - (k * (y0 + y1)) / 2,
  }
}

/**
 * 3D: frames `points` (in camera axes, z toward the camera) for a camera with vertical
 * field of view `fovDeg`: the distance from the look-at point and the look-at point itself
 * (camera axes), shifted so the points land in the viewport minus `inset`.
 */
export function fitCamera(
  points: { x: number; y: number; z: number }[],
  fovDeg: number,
  size: { width: number; height: number },
  inset: Inset,
  padding = FIT_PADDING,
) {
  const t = Math.tan((fovDeg * Math.PI) / 360)
  const pad = fitPadding(size, inset, padding)
  const availW = Math.max(1, size.width - inset.right - 2 * pad)
  const availH = Math.max(1, size.height - inset.bottom - 2 * pad)
  const mid = (f: (p: { x: number; y: number; z: number }) => number) => {
    const v = points.map(f)
    return (Math.min(...v) + Math.max(...v)) / 2
  }
  const [cx, cy, cz] = [mid((p) => p.x), mid((p) => p.y), mid((p) => p.z)]
  // A point sits at depth d - z from the camera and must project within half the free area.
  const distance = Math.max(
    ...points.map(
      (p) =>
        p.z -
        cz +
        Math.max(
          (Math.abs(p.x - cx) * size.height) / (t * availW),
          (Math.abs(p.y - cy) * size.height) / (t * availH),
        ),
    ),
    1,
  )
  const perPx = (2 * distance * t) / size.height // world units per pixel at the look-at depth
  return {
    distance,
    target: { x: cx + (inset.right / 2) * perPx, y: cy - (inset.bottom / 2) * perPx, z: cz },
    depth: Math.max(...points.map((p) => Math.abs(p.z - cz))),
  }
}
