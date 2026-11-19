import { describe, expect, it } from 'vite-plus/test'
import { chooseLabels, createSim } from './render2d.ts'
import type { LabelBox } from './render2d.ts'
import type { RenderLink, RenderNode } from './renderGraph.ts'

// 15 disconnected clusters (a hub plus 7 leaves) plus loose singletons, like the real map.
function clusters() {
  const nodes: (RenderNode & { x?: number; y?: number })[] = []
  const links: RenderLink[] = []
  const node = (key: string, weight: number): RenderNode => ({
    key,
    kind: 'drug',
    id: key,
    name: key,
    group: false,
    weight,
  })
  for (let c = 0; c < 15; c++) {
    nodes.push(node(`h${c}`, 7))
    for (let i = 0; i < 7; i++) {
      nodes.push(node(`h${c}-${i}`, 1))
      links.push({ source: `h${c}`, target: `h${c}-${i}`, kind: 'interaction' })
    }
  }
  for (let i = 0; i < 10; i++) nodes.push(node(`s${i}`, 0))
  return { nodes, links }
}

describe('2D layout', () => {
  it('keeps every node of disconnected clusters near the centre', () => {
    const { nodes, links } = clusters()
    createSim(nodes, links)
    const farthest = Math.max(...nodes.map((n) => Math.hypot(n.x ?? NaN, n.y ?? NaN)))
    expect(farthest).toBeLessThan(RADIUS)
  })
})

const RADIUS = 700

describe('label collisions', () => {
  const box = (key: string, x: number, o: Partial<LabelBox> = {}): LabelBox => ({
    key,
    name: key,
    weight: 1,
    selected: false,
    dimmed: false,
    x,
    y: 0,
    w: 50,
    h: 10,
    ...o,
  })

  it('hides the lower-priority label of an overlapping pair', () => {
    const shown = chooseLabels([box('a', 0, { weight: 1 }), box('b', 20, { weight: 5 })])
    expect([...shown]).toEqual(['b'])
  })

  it('keeps every label that does not overlap', () => {
    expect(chooseLabels([box('a', 0), box('b', 50), box('c', 200)]).size).toBe(3)
  })

  it('always keeps the selected label, then ranks by weight, then A-Z', () => {
    const sel = chooseLabels([box('a', 0, { weight: 9 }), box('z', 20, { selected: true })])
    expect([...sel]).toEqual(['z'])
    const tie = chooseLabels([box('b', 0), box('a', 20)])
    expect([...tie]).toEqual(['a'])
  })

  it('ranks a dimmed label below every undimmed one, whatever its weight', () => {
    const shown = chooseLabels([
      box('a', 0, { weight: 9, dimmed: true }),
      box('b', 20, { weight: 1 }),
    ])
    expect([...shown]).toEqual(['b'])
  })

  it('shows only one of two overlapping dimmed labels, heavier first', () => {
    const shown = chooseLabels([
      box('a', 0, { weight: 1, dimmed: true }),
      box('b', 20, { weight: 5, dimmed: true }),
    ])
    expect([...shown]).toEqual(['b'])
  })

  it('is stable regardless of input order', () => {
    const boxes = [box('a', 0), box('b', 20), box('c', 40, { weight: 3 }), box('d', 300)]
    const first = [...chooseLabels(boxes)].sort()
    expect([...chooseLabels([...boxes].reverse())].sort()).toEqual(first)
  })
})
