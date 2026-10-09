import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GraphPayload } from '@fdi/schema'
import { buildIndex, nodeKey, searchNodes } from '@fdi/schema/domain'
import { chooseView } from '../graph/chooseView.ts'
import { GraphView } from '../graph/GraphView.tsx'
import { useEnv } from '../graph/useEnv.ts'
import { srRows } from '../graph/srRows.ts'
import { computeFocus, filterRenderGraph, toRenderGraph } from '../graph/renderGraph.ts'
import type { Palette } from '../theme/tokens.ts'
import type { ViewState } from '../urlState.ts'
import { browseKeys, stepKey } from './browse.ts'
import { SidePanel } from './SidePanel.tsx'
import { Search } from './Search.tsx'
import './explore.css'

export interface ExploreTabProps {
  graph: GraphPayload
  state: ViewState
  update: (patch: Partial<ViewState>, opts?: { push?: boolean }) => void
  palette: Palette
  medsFilter: Set<string> | null
  clearMedsFilter: () => void
}

export function ExploreTab({
  graph,
  state,
  update,
  palette,
  medsFilter,
  clearMedsFilter,
}: ExploreTabProps) {
  // Search, browsing and highlighting all work within what the graph currently shows.
  const nodes = useMemo(
    () =>
      medsFilter ? graph.nodes.filter((n) => medsFilter.has(nodeKey(n.kind, n.id))) : graph.nodes,
    [graph, medsFilter],
  )
  const keys = useMemo(() => browseKeys(nodes, state.q), [nodes, state.q])
  const known = useMemo(() => new Set(graph.nodes.map((n) => nodeKey(n.kind, n.id))), [graph])
  const node = state.node
  const selected = node && known.has(node) ? node : null

  // A link to an item that is no longer in the dataset: say so, then clear it from the URL.
  const [staleNode, setStaleNode] = useState<string | null>(null)
  if (node && !selected && staleNode !== node) setStaleNode(node)
  else if (selected && staleNode) setStaleNode(null)
  const stale = staleNode !== null && !selected
  useEffect(() => {
    if (node && !selected) update({ node: null })
  }, [node, selected, update])
  const onNotFound = useCallback(() => {
    setStaleNode(node)
    update({ node: null })
  }, [node, update])

  const select = useCallback((key: string) => update({ node: key }, { push: true }), [update])
  const step = useCallback(
    (dir: 1 | -1) => {
      const to = node && stepKey(keys, node, dir)
      if (to) update({ node: to })
    },
    [node, keys, update],
  )
  const prev = useCallback(() => step(-1), [step])
  const next = useCallback(() => step(1), [step])
  const close = useCallback(() => update({ node: null }), [update])

  const renderGraph = useMemo(() => {
    const full = toRenderGraph(graph, { mechanisms: state.mech })
    return medsFilter ? filterRenderGraph(full, medsFilter) : full
  }, [graph, state.mech, medsFilter])
  const ix = useMemo(() => buildIndex(graph.nodes, graph.interactions), [graph])
  const matches = useMemo(
    () =>
      state.q.trim()
        ? new Set(searchNodes(nodes, state.q, Infinity).map((r) => nodeKey(r.kind, r.id)))
        : null,
    [nodes, state.q],
  )
  const focus = useMemo(
    () => ({ selected, focus: computeFocus(ix, selected, matches) }),
    [ix, selected, matches],
  )
  const env = useEnv()
  const { view, canToggle } = chooseView(env, state.view)
  const srList = useMemo(() => srRows(ix, selected), [ix, selected])
  const onGraphSelect = useCallback(
    (key: string | null) => (key ? select(key) : update({ node: null }, { push: true })),
    [select, update],
  )

  return (
    <div className="explore">
      <GraphView
        graph={renderGraph}
        view={view}
        motion={!env.reducedMotion}
        focus={focus}
        palette={palette}
        onSelect={onGraphSelect}
      />
      <div className="explore__bar">
        <Search nodes={nodes} state={state} update={update} />
        {medsFilter && (
          <button className="pill-button" onClick={clearMedsFilter}>
            Showing your meds ✕
          </button>
        )}
        {canToggle && (
          <button
            className="pill-button"
            onClick={() => update({ view: view === '3d' ? '2d' : '3d' })}
          >
            {view === '3d' ? '2D' : '3D'}
          </button>
        )}
        <button
          className="pill-button"
          aria-pressed={state.mech}
          onClick={() => update({ mech: !state.mech })}
        >
          Mechanisms
        </button>
      </div>
      {view === '3d' && selected && (
        <div className="sr-only" aria-live="polite">
          <p>Interactions for the selected item:</p>
          <ul>
            {srList.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {stale && (
        <p className="notice" role="status">
          That item is no longer in the dataset.
        </p>
      )}
      {selected && (
        <SidePanel
          nodeKey={selected}
          position={{ index: Math.max(keys.indexOf(selected), 0), total: keys.length }}
          onSelect={select}
          onPrev={prev}
          onNext={next}
          onClose={close}
          onNotFound={onNotFound}
        />
      )}
    </div>
  )
}
