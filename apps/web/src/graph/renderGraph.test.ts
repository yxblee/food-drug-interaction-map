import { describe, expect, it } from 'vite-plus/test'
import type { GraphPayload } from '@fdi/schema'
import { buildIndex } from '@fdi/schema/domain'
import {
  computeFocus,
  filterRenderGraph,
  fitCamera,
  fitTransform,
  nodeRadius,
  toRenderGraph,
} from './renderGraph.ts'

const g: GraphPayload = {
  version: 'v',
  nodes: [
    { kind: 'drug', id: 'statins', name: 'Statins', aliases: [], group: true },
    {
      kind: 'drug',
      id: 'simvastatin',
      name: 'Simvastatin',
      aliases: [],
      group: false,
      parent: 'statins',
    },
    { kind: 'drug', id: 'felodipine', name: 'Felodipine', aliases: [], group: false },
    { kind: 'food', id: 'grapefruit', name: 'Grapefruit', aliases: [], group: false },
    { kind: 'food', id: 'st-johns-wort', name: "St. John's wort", aliases: [], group: false },
    {
      kind: 'mechanism',
      id: 'cyp3a4-inhibition',
      name: 'CYP3A4 inhibition',
      aliases: [],
      group: false,
    },
    {
      kind: 'mechanism',
      id: 'cyp3a4-induction',
      name: 'CYP3A4 induction',
      aliases: [],
      group: false,
    },
    { kind: 'mechanism', id: 'unused', name: 'Unused', aliases: [], group: false },
  ],
  interactions: [
    {
      id: 'grapefruit--simvastatin',
      food: 'grapefruit',
      drug: 'simvastatin',
      mechanisms: ['cyp3a4-inhibition'],
      severity: 'avoid',
      effect: 'increases',
      summary: '',
      advice: '',
    },
    {
      id: 'grapefruit--felodipine',
      food: 'grapefruit',
      drug: 'felodipine',
      mechanisms: ['cyp3a4-inhibition'],
      severity: 'caution',
      effect: 'increases',
      summary: '',
      advice: '',
    },
    {
      id: 'st-johns-wort--felodipine',
      food: 'st-johns-wort',
      drug: 'felodipine',
      mechanisms: ['cyp3a4-induction'],
      severity: 'monitor',
      effect: 'decreases',
      summary: '',
      advice: '',
    },
  ],
}

const linkIds = (links: { source: string; target: string; severity?: string }[]) =>
  links.map((l) => `${l.source}>${l.target}${l.severity ? `:${l.severity}` : ''}`).sort()

describe('toRenderGraph', () => {
  it('routes edges through mechanisms, keeping the worst severity per edge', () => {
    const rg = toRenderGraph(g, { mechanisms: true })
    expect(linkIds(rg.links)).toEqual([
      'drug:simvastatin>drug:statins',
      'food:grapefruit>mechanism:cyp3a4-inhibition:avoid',
      'food:st-johns-wort>mechanism:cyp3a4-induction:monitor',
      'mechanism:cyp3a4-induction>drug:felodipine:monitor',
      'mechanism:cyp3a4-inhibition>drug:felodipine:caution',
      'mechanism:cyp3a4-inhibition>drug:simvastatin:avoid',
    ])
    expect(rg.nodes.map((n) => n.key)).not.toContain('mechanism:unused')
    expect(rg.nodes.find((n) => n.key === 'food:grapefruit')?.weight).toBe(2)
    expect(rg.nodes.find((n) => n.key === 'mechanism:cyp3a4-inhibition')?.weight).toBe(2)
  })
  it('collapses mechanisms into direct food→drug edges', () => {
    const rg = toRenderGraph(g, { mechanisms: false })
    expect(linkIds(rg.links)).toEqual([
      'drug:simvastatin>drug:statins',
      'food:grapefruit>drug:felodipine:caution',
      'food:grapefruit>drug:simvastatin:avoid',
      'food:st-johns-wort>drug:felodipine:monitor',
    ])
    expect(rg.nodes.some((n) => n.kind === 'mechanism')).toBe(false)
  })
  it('marks member links and keeps groups', () => {
    const rg = toRenderGraph(g, { mechanisms: false })
    expect(rg.links.filter((l) => l.kind === 'member')).toHaveLength(1)
    expect(rg.nodes.find((n) => n.key === 'drug:statins')?.group).toBe(true)
  })
})

describe('nodeRadius', () => {
  it('grows with the number of interactions', () => {
    const rg = toRenderGraph(g, { mechanisms: false })
    const r = (k: string) => nodeRadius(rg.nodes.find((n) => n.key === k)!)
    expect(r('food:grapefruit')).toBeGreaterThan(r('food:st-johns-wort'))
  })
})

describe('filterRenderGraph', () => {
  it('keeps only listed nodes and links between them', () => {
    const rg = filterRenderGraph(
      toRenderGraph(g, { mechanisms: false }),
      new Set(['food:grapefruit', 'drug:simvastatin']),
    )
    expect(rg.nodes.map((n) => n.key).sort()).toEqual(['drug:simvastatin', 'food:grapefruit'])
    expect(linkIds(rg.links)).toEqual(['food:grapefruit>drug:simvastatin:avoid'])
  })
})

describe('computeFocus', () => {
  const ix = buildIndex(g.nodes, g.interactions)
  it('returns null with nothing selected or highlighted', () => {
    expect(computeFocus(ix, null, null)).toBeNull()
  })
  it('returns the highlight set when nothing is selected', () => {
    const h = new Set(['food:grapefruit'])
    expect(computeFocus(ix, null, h)).toBe(h)
  })
  it('includes counterparts, mechanisms and the parent of a selected node, not unrelated paths', () => {
    const f = computeFocus(ix, 'drug:simvastatin', null)!
    expect([...f].sort()).toEqual([
      'drug:simvastatin',
      'drug:statins',
      'food:grapefruit',
      'mechanism:cyp3a4-inhibition',
    ])
  })
  it('includes the members of a selected group', () => {
    expect([...computeFocus(ix, 'drug:statins', null)!]).toContain('drug:simvastatin')
  })
  it('includes every interaction through a selected mechanism', () => {
    expect([...computeFocus(ix, 'mechanism:cyp3a4-inhibition', null)!].sort()).toEqual([
      'drug:felodipine',
      'drug:simvastatin',
      'food:grapefruit',
      'mechanism:cyp3a4-inhibition',
    ])
  })
})

describe('fitTransform', () => {
  const size = { width: 1000, height: 600 }
  const pts = [
    { x: -1000, y: -300 },
    { x: 1000, y: 300 },
  ]
  const project = (t: { k: number; x: number; y: number }, p: { x: number; y: number }) => ({
    x: p.x * t.k + t.x,
    y: p.y * t.k + t.y,
  })

  it('has nothing to frame without points', () => {
    expect(fitTransform([], size, { right: 0, bottom: 0 })).toBeNull()
  })

  it('centres the points and fills the viewport minus padding', () => {
    const t = fitTransform(pts, size, { right: 0, bottom: 0 }, 50)!
    const [a, b] = [project(t, pts[0]!), project(t, pts[1]!)]
    expect(a.x).toBeCloseTo(-450)
    expect(b.x).toBeCloseTo(450)
    expect(a.y + b.y).toBeCloseTo(0)
  })

  it('keeps the points inside the space left of a right inset', () => {
    const t = fitTransform(pts, size, { right: 400, bottom: 0 }, 50)!
    const [a, b] = [project(t, pts[0]!), project(t, pts[1]!)]
    expect(a.x).toBeGreaterThanOrEqual(-500 + 50)
    expect(b.x).toBeLessThanOrEqual(500 - 400 - 50 + 0.001)
  })

  it('keeps the points above a bottom inset', () => {
    const t = fitTransform(pts, size, { right: 0, bottom: 300 }, 50)!
    expect(project(t, pts[1]!).y).toBeLessThanOrEqual(300 - 300 - 30 + 0.001)
  })

  it('does not zoom a single node past the maximum', () => {
    expect(fitTransform([{ x: 5, y: 5 }], size, { right: 0, bottom: 0 })!.k).toBe(2.5)
  })
})

describe('fitCamera', () => {
  const size = { width: 1000, height: 1000 }
  const none = { right: 0, bottom: 0 }
  const line = [
    { x: -100, y: 0, z: 0 },
    { x: 100, y: 0, z: 0 },
  ]
  it('puts the extremes at the edge of the free area', () => {
    // fov 90: one world unit at distance d spans 500 / d pixels
    expect(fitCamera(line, 90, size, none, 0).distance).toBeCloseTo(100)
  })
  it('backs off for bigger spreads and for points nearer the camera', () => {
    expect(
      fitCamera(
        line.map((p) => ({ ...p, x: p.x * 2 })),
        90,
        size,
        none,
        0,
      ).distance,
    ).toBeCloseTo(200)
    const deep = [...line, { x: 100, y: 0, z: 50 }, { x: 100, y: 0, z: -50 }]
    expect(fitCamera(deep, 90, size, none, 0).distance).toBeGreaterThan(100)
  })
  it('slides the look-at point right and down when a panel covers the right or bottom', () => {
    expect(fitCamera(line, 90, size, none, 0).target.x).toBe(0)
    expect(fitCamera(line, 90, size, { right: 400, bottom: 0 }, 0).target.x).toBeGreaterThan(0)
    expect(fitCamera(line, 90, size, { right: 0, bottom: 300 }, 0).target.y).toBeLessThan(0)
  })
})
