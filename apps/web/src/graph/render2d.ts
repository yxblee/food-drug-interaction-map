import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  select,
  zoom,
} from 'd3'
import type { Selection, Simulation, ZoomBehavior } from 'd3'
import { nodeRadius, type RenderLink, type RenderNode } from './renderGraph.ts'
import type { Focus, GraphRenderer, RendererOptions } from './types.ts'

type SimNode = RenderNode & { x?: number; y?: number }
type SimLink = Omit<RenderLink, 'source' | 'target'> & {
  source: string | SimNode
  target: string | SimNode
}

const endKey = (e: string | SimNode) => (typeof e === 'string' ? e : e.key)
const KIND_LABEL = { drug: 'Drug', food: 'Food', mechanism: 'Mechanism' } as const

// Shapes: Drug = circle, Food = square, Mechanism = diamond.
function shapePath(n: RenderNode, scale = 1): string {
  const r = nodeRadius(n) * scale
  if (n.kind === 'drug') return `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`
  if (n.kind === 'food') {
    const s = r * 0.88
    return `M ${-s} ${-s} H ${s} V ${s} H ${-s} Z`
  }
  return `M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`
}

export function create2d(opts: RendererOptions): GraphRenderer {
  let host: HTMLElement | null = null
  let svg: Selection<SVGSVGElement, unknown, null, undefined> | null = null
  let root: Selection<SVGGElement, unknown, null, undefined> | null = null
  let zoomer: ZoomBehavior<SVGSVGElement, unknown> | null = null
  let sim: Simulation<SimNode, SimLink> | null = null
  let observer: ResizeObserver | null = null
  let nodes: SimNode[] = []
  let focus: Focus = { selected: null, focus: null }
  let onSelect: (key: string | null) => void = () => {}

  function fit() {
    if (!host || !svg) return
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    svg.attr('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`)
  }

  function positions() {
    if (!root) return
    root
      .selectAll<SVGLineElement, SimLink>('line.link')
      .attr('x1', (l) => (l.source as SimNode).x ?? 0)
      .attr('y1', (l) => (l.source as SimNode).y ?? 0)
      .attr('x2', (l) => (l.target as SimNode).x ?? 0)
      .attr('y2', (l) => (l.target as SimNode).y ?? 0)
    root
      .selectAll<SVGGElement, SimNode>('g.node')
      .attr('transform', (n) => `translate(${n.x ?? 0},${n.y ?? 0})`)
  }

  function paintFocus() {
    if (!root) return
    const { selected, focus: f } = focus
    const inFocus = (k: string) => !f || f.has(k)
    root
      .selectAll<SVGGElement, SimNode>('g.node')
      .classed('is-dim', (n) => !inFocus(n.key))
      .classed('is-selected', (n) => n.key === selected)
    root
      .selectAll<SVGLineElement, SimLink>('line.link')
      .classed('is-dim', (l) => !!f && !(f.has(endKey(l.source)) && f.has(endKey(l.target))))
      .classed(
        'is-focus',
        (l) => !!f && !!selected && f.has(endKey(l.source)) && f.has(endKey(l.target)),
      )
  }

  return {
    mount(el) {
      host = el
      svg = select(el)
        .append('svg')
        .attr('class', 'graph2d')
        .attr('role', 'group')
        .attr('aria-label', 'Interaction graph')
      root = svg.append('g')
      zoomer = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (e) => root?.attr('transform', e.transform.toString()))
      svg.call(zoomer)
      svg.on('click', (e: MouseEvent) => {
        if (e.target === svg?.node()) onSelect(null)
      })
      observer = new ResizeObserver(fit)
      observer.observe(el)
      fit()
    },

    setData(g) {
      if (!root) return
      sim?.stop()
      const prev = new Map(nodes.map((n) => [n.key, n]))
      nodes = g.nodes.map((n) => ({ ...n, x: prev.get(n.key)?.x, y: prev.get(n.key)?.y }))
      const links: SimLink[] = g.links.map((l) => ({ ...l }))
      root.selectAll('*').remove()

      root
        .append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('class', (l) => `link link--${l.kind}${l.severity ? ` sev-${l.severity}` : ''}`)

      const node = root
        .append('g')
        .attr('class', 'nodes')
        .selectAll<SVGGElement, SimNode>('g')
        .data(nodes)
        .join('g')
        .attr('class', (n) => `node node--${n.kind}${n.group ? ' node--group' : ''}`)
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', (n) => `${KIND_LABEL[n.kind]}${n.group ? ' group' : ''}: ${n.name}`)
        .on('click', (e: MouseEvent, n) => {
          e.stopPropagation()
          onSelect(n.key)
        })
        .on('keydown', (e: KeyboardEvent, n) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(n.key)
          }
        })
      node
        .filter((n) => n.group)
        .append('path')
        .attr('class', 'shape-ring')
        .attr('d', (n) => shapePath(n, 1.4))
      node
        .append('path')
        .attr('class', 'shape')
        .attr('d', (n) => shapePath(n))
      node
        .append('text')
        .attr('class', 'label')
        .attr('text-anchor', 'middle')
        .attr('y', (n) => -nodeRadius(n) - 6)
        .text((n) => n.name.toUpperCase())

      sim = forceSimulation(nodes)
        .force(
          'link',
          forceLink<SimNode, SimLink>(links)
            .id((n) => n.key)
            .distance((l) => (l.kind === 'member' ? 40 : 80))
            .strength((l) => (l.kind === 'member' ? 0.3 : 0.6)),
        )
        .force('charge', forceManyBody().strength(-160))
        .force(
          'collide',
          forceCollide<SimNode>((n) => nodeRadius(n) + 10),
        )
        .force('center', forceCenter(0, 0))
      if (opts.motion) sim.on('tick', positions)
      else {
        sim.stop()
        sim.tick(300)
        positions()
      }
      paintFocus()
    },

    setFocus(f) {
      focus = f
      paintFocus()
      if (!svg || !zoomer || !f.selected) return
      const n = nodes.find((n) => n.key === f.selected)
      if (n?.x == null || n.y == null) return
      if (opts.motion) zoomer.translateTo(svg.transition().duration(500), n.x, n.y)
      else zoomer.translateTo(svg, n.x, n.y)
    },

    setTheme() {
      // 2D colors come from CSS custom properties set by useTheme
    },

    onSelect(cb) {
      onSelect = cb
    },

    destroy() {
      sim?.stop()
      observer?.disconnect()
      svg?.remove()
      host = null
      svg = null
      root = null
    },
  }
}
