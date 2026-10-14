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
  Vector3,
  type PerspectiveCamera,
} from 'three'
import { SEVERITY_RANK } from '@fdi/schema/domain'
import { SEVERITY_COLORS, type Palette } from '../theme/tokens.ts'
import {
  NO_INSET,
  fitCamera,
  nodeRadius,
  type Inset,
  type RenderLink,
  type RenderNode,
} from './renderGraph.ts'
import type { Focus, GraphRenderer, RendererOptions } from './types.ts'

type FGNode = RenderNode & { x?: number; y?: number; z?: number }
type FGLink = Omit<RenderLink, 'source' | 'target'> & {
  source: string | FGNode
  target: string | FGNode
}
const endKey = (e: string | FGNode) => (typeof e === 'string' ? e : e.key)

// Fit uses node centres; near nodes render big under perspective, so leave extra room.
const NODE_MARGIN = 96

// d3-force-3d isn't a direct dependency, so use a minimal custom force.
function originPull(k: number) {
  let nodes: { x: number; y: number; z: number; vx: number; vy: number; vz: number }[] = []
  const force = (alpha: number) => {
    for (const n of nodes) {
      n.vx -= n.x * k * alpha
      n.vy -= n.y * k * alpha
      n.vz -= n.z * k * alpha
    }
  }
  force.initialize = (ns: typeof nodes) => (nodes = ns)
  return force
}

export function create3d(opts: RendererOptions): GraphRenderer {
  let fg: InstanceType<typeof ForceGraph3D> | null = null
  let host: HTMLElement | null = null
  let observer: ResizeObserver | null = null
  let palette: Palette | null = null
  let focus: Focus = { selected: null, focus: null }
  let onSelect: (key: string | null) => void = () => {}
  let active: string | null = null
  const groups = new Map<string, Group>()
  const materials = new Map<string, MeshLambertMaterial>()
  const labels = new Map<string, SpriteText>()

  const inFocus = (key: string) => !focus.focus || focus.focus.has(key)
  const linkInFocus = (l: FGLink) =>
    !!focus.focus && inFocus(endKey(l.source)) && inFocus(endKey(l.target))

  function styleNode(key: string) {
    if (!palette) return
    const m = materials.get(key)
    groups.get(key)?.scale.setScalar(key === active ? 1.7 : 1)
    if (m) {
      m.color.set(key === focus.selected || key === active ? palette.ink : palette.muted)
      m.opacity = inFocus(key) ? 0.95 : 0.12
    }
    const s = labels.get(key)
    if (s) {
      s.color = inFocus(key) ? palette.ink : palette.muted
      s.material.opacity = inFocus(key) ? 1 : 0.15
    }
  }

  // Frames the focused nodes (or all); coalesced so a
  // selection and the panel opening animate as one move.
  let fitTimer: ReturnType<typeof setTimeout> | undefined
  let inset: Inset = NO_INSET
  let fogNear = 600
  function requestFit() {
    clearTimeout(fitTimer)
    fitTimer = setTimeout(doFit, 50)
  }
  function doFit() {
    if (!fg || !host) return
    const f = focus.selected ? focus.focus : null
    const pts = (fg.graphData().nodes as FGNode[]).filter(
      (n) => (!f || f.has(n.key)) && n.x != null && n.y != null && n.z != null,
    )
    if (!pts.length) return
    const cam = fg.camera() as PerspectiveCamera
    // Keep the viewing direction; work in camera axes so the fit is exact under perspective.
    const look = (fg.controls() as { target: Vector3 }).target
    const back = cam.position.clone().sub(look)
    if (back.lengthSq() < 1e-6) back.set(0, 0, 1)
    back.normalize()
    const right = new Vector3(0, 1, 0).cross(back)
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0)
    right.normalize()
    const up = back.clone().cross(right)
    const { distance, target, depth } = fitCamera(
      pts.map((n) => {
        const p = new Vector3(n.x, n.y, n.z)
        return { x: p.dot(right), y: p.dot(up), z: p.dot(back) }
      }),
      cam.fov,
      { width: host.clientWidth, height: host.clientHeight },
      inset,
      NODE_MARGIN,
    )
    const at = right
      .clone()
      .multiplyScalar(target.x)
      .addScaledVector(up, target.y)
      .addScaledVector(back, target.z)
    const pos = at.clone().addScaledVector(back, distance)
    fogNear = distance + depth
    paint()
    fg.cameraPosition(pos, at, opts.motion ? 800 : 0)
  }

  function paint() {
    if (!fg || !palette) return
    fg.backgroundColor(palette.paper)
    fg.scene().fog = new Fog(palette.paper, fogNear, fogNear + 1200)
    for (const key of materials.keys()) styleNode(key)
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
    groups.set(n.key, group)
    group.add(new Mesh(geometry, material))
    if (n.group) group.add(new Mesh(new TorusGeometry(r * 1.45, 0.35, 8, 40), material))
    const label = new SpriteText(n.name.toUpperCase(), 3)
    label.fontFace = 'ui-monospace, Menlo, monospace'
    label.material.transparent = true
    label.position.y = r + 6
    labels.set(n.key, label)
    group.add(label)
    styleNode(n.key)
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
          // Severity ink at rest and on focused paths; other links use muted ink (hairline is too faint).
          return link.severity && (!focus.focus || linkInFocus(link))
            ? SEVERITY_COLORS[link.severity]
            : palette.muted
        })
        .linkOpacity(0.7)
        .linkWidth((l) => {
          const link = l as FGLink
          if (!focus.selected) return link.severity ? 0.5 : 0
          if (!linkInFocus(link)) return 0
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
        // Lay out up front so the first frame is already settled and can be framed.
        .warmupTicks(250)
        .cooldownTicks(100)
      // Weak pull to the origin so disconnected clusters sit close together.
      fg.d3Force('charge')?.strength(-70)
      fg.d3Force('pull', originPull(0.05) as never)
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
      groups.clear()
      fg.graphData({
        nodes: g.nodes.map((n) => ({ ...n })),
        links: g.links.map((l) => ({ ...l })),
      })
      paint()
      requestFit()
    },

    setFocus(f) {
      const reframe = f.selected !== focus.selected
      focus = f
      paint()
      if (!fg) return
      const controls = fg.controls() as unknown as { autoRotate: boolean }
      controls.autoRotate = opts.motion && !f.selected
      if (reframe) requestFit()
    },

    points() {
      if (!fg) return []
      const f = focus.focus
      return (fg.graphData().nodes as FGNode[])
        .filter((n) => (!f || f.has(n.key)) && n.x != null)
        .map((n) => {
          const s = fg!.graph2ScreenCoords(n.x!, n.y!, n.z!)
          return {
            key: n.key,
            label: `${n.kind[0]!.toUpperCase()}${n.kind.slice(1)}: ${n.name}`,
            x: s.x,
            y: s.y,
          }
        })
    },

    setActive(key) {
      const prev = active
      active = key
      if (prev) styleNode(prev)
      if (key) styleNode(key)
    },

    setInset(i) {
      inset = i
    },

    fit: requestFit,

    setTheme(p) {
      palette = p
      paint()
    },

    onSelect(cb) {
      onSelect = cb
    },

    destroy() {
      clearTimeout(fitTimer)
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
