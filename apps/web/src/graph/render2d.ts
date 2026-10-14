import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  select,
  zoom,
  zoomIdentity,
} from 'd3'
import type { Selection, Simulation, ZoomBehavior } from 'd3'
import {
  NO_INSET,
  fitTransform,
  nodeRadius,
  type Inset,
  type RenderLink,
  type RenderNode,
} from './renderGraph.ts'
import type { Focus, GraphRenderer, RendererOptions } from './types.ts'

type SimNode = RenderNode & { x?: number; y?: number }
type SimLink = Omit<RenderLink, 'source' | 'target'> & {
  source: string | SimNode
  target: string | SimNode
}

const endKey = (e: string | SimNode) => (typeof e === 'string' ? e : e.key)
const nodeDomId = (key: string) => `g2d-${key.replace(/[^\w-]/g, '_')}`
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

// Weak pull to the origin: forceCenter only shifts the mean, so it never draws
// disconnected clusters together.
export function createSim(nodes: SimNode[], links: SimLink[]): Simulation<SimNode, SimLink> {
  return forceSimulation(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((n) => n.key)
        .distance((l) => (l.kind === 'member' ? 40 : 80))
        .strength((l) => (l.kind === 'member' ? 0.3 : 0.6)),
    )
    .force('charge', forceManyBody().strength(-110))
    .force(
      'collide',
      forceCollide<SimNode>((n) => nodeRadius(n) + 10),
    )
    .force('center', forceCenter(0, 0))
    .force('x', forceX(0).strength(0.05))
    .force('y', forceY(0).strength(0.05))
    .stop()
    .tick(300)
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
  let inset: Inset = NO_INSET
  let fitTimer: ReturnType<typeof setTimeout> | undefined

  function resize() {
    if (!host || !svg) return
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    svg.attr('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`)
  }

  // Frames the focused nodes (or all); coalesced so a
  // selection and the panel opening animate as one move.
  function requestFit() {
    clearTimeout(fitTimer)
    fitTimer = setTimeout(doFit, 50)
  }
  function doFit() {
    if (!host || !svg || !zoomer) return
    const f = focus.selected ? focus.focus : null
    const pts = nodes.filter((n) => (!f || f.has(n.key)) && n.x != null && n.y != null) as {
      x: number
      y: number
    }[]
    const t = fitTransform(pts, { width: host.clientWidth, height: host.clientHeight }, inset)
    if (!t) return
    const to = zoomIdentity.translate(t.x, t.y).scale(t.k)
    if (opts.motion) zoomer.transform(svg.transition().duration(500), to)
    else zoomer.transform(svg, to)
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
      .classed('is-labelled', (n) => !!n.group || (!!f && f.has(n.key)))
    root
      .selectAll<SVGLineElement, SimLink>('line.link')
      .classed('is-dim', (l) => !!f && !(f.has(endKey(l.source)) && f.has(endKey(l.target))))
      .classed(
        'is-focus',
        (l) => !!f && !!selected && f.has(endKey(l.source)) && f.has(endKey(l.target)),
      )
  }

  function paintHover(key: string | null) {
    if (!root) return
    root.selectAll<SVGGElement, SimNode>('g.node').classed('is-hover', (n) => n.key === key)
    root
      .selectAll<SVGLineElement, SimLink>('line.link')
      .classed('is-hover', (l) => !!key && (endKey(l.source) === key || endKey(l.target) === key))
  }

  return {
    mount(el) {
      host = el
      svg = select(el).append('svg').attr('class', 'graph2d').attr('role', 'presentation')
      root = svg.append('g')
      zoomer = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (e) => root?.attr('transform', e.transform.toString()))
      svg.call(zoomer)
      svg.on('click', (e: MouseEvent) => {
        if (e.target === svg?.node()) onSelect(null)
      })
      observer = new ResizeObserver(resize)
      observer.observe(el)
      resize()
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
        .attr('id', (n) => nodeDomId(n.key))
        .attr('role', 'button')
        .attr('aria-label', (n) => `${KIND_LABEL[n.kind]}${n.group ? ' group' : ''}: ${n.name}`)
        .on('click', (e: MouseEvent, n) => {
          e.stopPropagation()
          onSelect(n.key)
        })
        // Mouse only, so touch never leaves a stuck hover.
        .on('pointerenter', (e: PointerEvent, n) => {
          if (e.pointerType === 'mouse') paintHover(n.key)
        })
        .on('pointerleave', (e: PointerEvent) => {
          if (e.pointerType === 'mouse') paintHover(null)
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

      sim = createSim(nodes, links)
      // createSim lays out up front so the first frame is already settled and can be framed.
      positions()
      requestFit()
      paintFocus()
    },

    setFocus(f) {
      const reframe = f.selected !== focus.selected
      focus = f
      paintFocus()
      if (reframe) requestFit()
    },

    points() {
      if (!root) return []
      const f = focus.focus
      return nodes
        .filter((n) => !f || f.has(n.key))
        .map((n) => {
          const r = document.getElementById(nodeDomId(n.key))?.getBoundingClientRect()
          return {
            key: n.key,
            label: `${KIND_LABEL[n.kind]}: ${n.name}`,
            x: r ? r.x + r.width / 2 : 0,
            y: r ? r.y + r.height / 2 : 0,
          }
        })
    },

    setActive(key) {
      root?.selectAll<SVGGElement, SimNode>('g.node').classed('is-active', (n) => n.key === key)
      if (key) host?.setAttribute('aria-activedescendant', nodeDomId(key))
      else host?.removeAttribute('aria-activedescendant')
    },

    setInset(i) {
      inset = i
    },

    fit: requestFit,

    setTheme() {
      // 2D colors come from CSS custom properties set by useTheme
    },

    onSelect(cb) {
      onSelect = cb
    },

    destroy() {
      clearTimeout(fitTimer)
      sim?.stop()
      observer?.disconnect()
      svg?.remove()
      host?.removeAttribute('aria-activedescendant')
      host = null
      svg = null
      root = null
    },
  }
}
