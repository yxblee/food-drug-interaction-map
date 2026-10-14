import { describe, expect, it } from 'vite-plus/test'
import { createSim } from './render2d.ts'
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
