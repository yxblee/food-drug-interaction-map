import { useEffect, useRef } from 'react'
import type { Palette } from '../theme/tokens.ts'
import { create2d } from './render2d.ts'
import { NO_INSET, type Inset, type RenderGraph } from './renderGraph.ts'
import type { Focus, GraphRenderer } from './types.ts'
import './graph.css'

interface Props {
  graph: RenderGraph
  view: '3d' | '2d'
  motion: boolean
  focus: Focus
  panelOpen: boolean
  palette: Palette
  onSelect: (key: string | null) => void
}

// The side panel overlays the map: full-width on phones (covers the bottom), else a right column.
function insetOf(host: HTMLElement): Inset {
  const panel = host.parentElement?.querySelector('.panel')
  if (!panel) return NO_INSET
  const h = host.getBoundingClientRect()
  const p = panel.getBoundingClientRect()
  return p.width >= h.width * 0.9
    ? { right: 0, bottom: Math.max(0, h.bottom - p.top) }
    : { right: Math.max(0, h.right - p.left), bottom: 0 }
}

export function GraphView(props: Props) {
  const host = useRef<HTMLDivElement>(null)
  const renderer = useRef<GraphRenderer | null>(null)
  const applied = useRef<RenderGraph | null>(null)
  const latest = useRef(props)
  const inset = useRef<Inset>(NO_INSET)
  useEffect(() => {
    latest.current = props
  })

  useEffect(() => {
    let cancelled = false
    const el = host.current!
    const start = (r: GraphRenderer) => {
      const { graph, focus, palette } = latest.current
      r.mount(el)
      r.onSelect((key) => latest.current.onSelect(key))
      r.setTheme(palette)
      r.setInset(inset.current)
      r.setData(graph)
      r.setFocus(focus)
      applied.current = graph
      renderer.current = r
    }
    // The 3D renderer (three.js) is its own chunk, fetched only when 3D is shown.
    if (props.view === '3d') {
      void import('./render3d.ts').then(({ create3d }) => {
        if (!cancelled) start(create3d({ motion: props.motion }))
      })
    } else {
      start(create2d({ motion: props.motion }))
    }
    return () => {
      cancelled = true
      renderer.current?.destroy()
      renderer.current = null
    }
  }, [props.view, props.motion])

  useEffect(() => {
    if (!renderer.current || applied.current === props.graph) return
    renderer.current.setData(props.graph)
    renderer.current.setFocus(latest.current.focus)
    applied.current = props.graph
  }, [props.graph])

  // Frame the selection in the space the panel leaves, and again as the panel resizes.
  useEffect(() => {
    const el = host.current!
    const panel = props.panelOpen ? el.parentElement?.querySelector('.panel') : null
    if (!panel) return
    const ro = new ResizeObserver(() => {
      inset.current = insetOf(el)
      renderer.current?.setInset(inset.current)
      renderer.current?.fit()
    })
    ro.observe(panel)
    return () => {
      ro.disconnect()
      inset.current = NO_INSET
      renderer.current?.setInset(NO_INSET)
    }
  }, [props.panelOpen])

  useEffect(() => renderer.current?.setFocus(props.focus), [props.focus])
  useEffect(() => renderer.current?.setTheme(props.palette), [props.palette])

  return <div ref={host} className="graph-host" />
}
