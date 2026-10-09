import { useEffect, useRef } from 'react'
import type { Palette } from '../theme/tokens.ts'
import { create2d } from './render2d.ts'
import type { RenderGraph } from './renderGraph.ts'
import type { Focus, GraphRenderer } from './types.ts'
import './graph.css'

interface Props {
  graph: RenderGraph
  view: '3d' | '2d'
  motion: boolean
  focus: Focus
  palette: Palette
  onSelect: (key: string | null) => void
}

export function GraphView(props: Props) {
  const host = useRef<HTMLDivElement>(null)
  const renderer = useRef<GraphRenderer | null>(null)
  const applied = useRef<RenderGraph | null>(null)
  const latest = useRef(props)
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

  useEffect(() => renderer.current?.setFocus(props.focus), [props.focus])
  useEffect(() => renderer.current?.setTheme(props.palette), [props.palette])

  return <div ref={host} className="graph-host" />
}
