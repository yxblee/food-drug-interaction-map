import ForceGraph3D from '3d-force-graph'
import SpriteText from 'three-spritetext'
import {
  BoxGeometry,
  Fog,
  Group,
  Mesh,
  MeshLambertMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { SEVERITY_RANK } from '@fdi/schema/domain'
import { SEVERITY_COLORS, type Palette } from '../theme/tokens.ts'
import { nodeRadius, type RenderLink, type RenderNode } from './renderGraph.ts'
import type { Focus, GraphRenderer, RendererOptions } from './types.ts'

type FGNode = RenderNode & { x?: number; y?: number; z?: number }
type FGLink = Omit<RenderLink, 'source' | 'target'> & {
  source: string | FGNode
  target: string | FGNode
}
const endKey = (e: string | FGNode) => (typeof e === 'string' ? e : e.key)

export function create3d(opts: RendererOptions): GraphRenderer {
  let fg: InstanceType<typeof ForceGraph3D> | null = null
  let host: HTMLElement | null = null
  let observer: ResizeObserver | null = null
  let palette: Palette | null = null
  let focus: Focus = { selected: null, focus: null }
  let onSelect: (key: string | null) => void = () => {}
  const materials = new Map<string, MeshLambertMaterial>()
  const labels = new Map<string, SpriteText>()

  const inFocus = (key: string) => !focus.focus || focus.focus.has(key)
  const linkInFocus = (l: FGLink) =>
    !!focus.focus && inFocus(endKey(l.source)) && inFocus(endKey(l.target))

  function paint() {
    if (!fg || !palette) return
    fg.backgroundColor(palette.paper)
    fg.scene().fog = new Fog(palette.paper, 250, 900)
    for (const [key, m] of materials) {
      m.color.set(key === focus.selected ? palette.ink : palette.muted)
      m.opacity = inFocus(key) ? 0.95 : 0.12
    }
    for (const [key, s] of labels) {
      s.color = inFocus(key) ? palette.ink : palette.muted
      s.material.opacity = inFocus(key) ? 1 : 0.15
    }
    // re-set accessors so 3d-force-graph re-evaluates them
    fg.linkColor(fg.linkColor())
    fg.linkWidth(fg.linkWidth())
    fg.linkDirectionalParticles(fg.linkDirectionalParticles())
  }

  function makeNode(n: FGNode) {
    const r = nodeRadius(n)
    const geometry =
      n.kind === 'drug'
        ? new SphereGeometry(r, 20, 14)
        : n.kind === 'food'
          ? new BoxGeometry(r * 1.6, r * 1.6, r * 1.6)
          : new OctahedronGeometry(r)
    const material = new MeshLambertMaterial({
      transparent: true,
      wireframe: n.kind === 'mechanism',
    })
    materials.set(n.key, material)
    const group = new Group()
    group.add(new Mesh(geometry, material))
    if (n.group) group.add(new Mesh(new TorusGeometry(r * 1.45, 0.35, 8, 40), material))
    const label = new SpriteText(n.name.toUpperCase(), 3)
    label.fontFace = 'ui-monospace, Menlo, monospace'
    label.material.transparent = true
    label.position.y = r + 6
    labels.set(n.key, label)
    group.add(label)
    return group
  }

  return {
    mount(el) {
      host = el
      el.classList.add('graph3d')
      fg = new ForceGraph3D(el, { controlType: 'orbit' })
        .nodeId('key')
        .showNavInfo(false)
        .enableNodeDrag(false)
        .nodeThreeObject((n) => makeNode(n as FGNode))
        .linkColor((l) => {
          const link = l as FGLink
          if (!palette) return '#888888'
          return linkInFocus(link) && link.severity && focus.selected
            ? SEVERITY_COLORS[link.severity]
            : palette.line
        })
        .linkOpacity(0.4)
        .linkWidth((l) => {
          const link = l as FGLink
          if (!linkInFocus(link) || !focus.selected) return 0
          return link.severity ? 2 - SEVERITY_RANK[link.severity] * 0.4 : 0.4
        })
        .linkDirectionalParticles((l) =>
          opts.motion &&
          focus.selected &&
          linkInFocus(l as FGLink) &&
          (l as FGLink).kind === 'interaction'
            ? 3
            : 0,
        )
        .linkDirectionalParticleWidth(1.4)
        .linkDirectionalParticleSpeed(0.006)
        .linkDirectionalParticleColor(() => palette?.ink ?? '#000000')
        .onNodeClick((n) => onSelect((n as FGNode).key))
        .onBackgroundClick(() => onSelect(null))
      const controls = fg.controls() as unknown as { autoRotate: boolean; autoRotateSpeed: number }
      controls.autoRotate = opts.motion
      controls.autoRotateSpeed = 0.6
      el.querySelector('canvas')?.setAttribute('aria-hidden', 'true')
      observer = new ResizeObserver(() => fg?.width(el.clientWidth).height(el.clientHeight))
      observer.observe(el)
      paint()
    },

    setData(g) {
      if (!fg) return
      materials.clear()
      labels.clear()
      fg.graphData({
        nodes: g.nodes.map((n) => ({ ...n })),
        links: g.links.map((l) => ({ ...l })),
      })
      paint()
    },

    setFocus(f) {
      focus = f
      paint()
      if (!fg) return
      const controls = fg.controls() as unknown as { autoRotate: boolean }
      controls.autoRotate = opts.motion && !f.selected
      if (!f.selected) return
      const n = (fg.graphData().nodes as FGNode[]).find((n) => n.key === f.selected)
      if (!n || n.x == null || n.y == null || n.z == null) return
      const ratio = 1 + 140 / (Math.hypot(n.x, n.y, n.z) || 1)
      fg.cameraPosition(
        { x: n.x * ratio, y: n.y * ratio, z: n.z * ratio },
        { x: n.x, y: n.y, z: n.z },
        opts.motion ? 800 : 0,
      )
    },

    setTheme(p) {
      palette = p
      paint()
    },

    onSelect(cb) {
      onSelect = cb
    },

    destroy() {
      observer?.disconnect()
      fg?._destructor()
      if (host) {
        host.replaceChildren()
        host.classList.remove('graph3d')
      }
      fg = null
      host = null
    },
  }
}
