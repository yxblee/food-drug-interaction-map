import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GraphPayload } from '@fdi/schema'
import { buildIndex, nodeKey, searchNodes } from '@fdi/schema/domain'
import { chooseView, detectEnv } from '../graph/chooseView.ts'
import { GraphView } from '../graph/GraphView.tsx'
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
  const [stale, setStale] = useState(false)
  const keys = useMemo(() => browseKeys(graph.nodes, state.q), [graph, state.q])
  const known = useMemo(() => new Set(graph.nodes.map((n) => nodeKey(n.kind, n.id))), [graph])
  const node = state.node

  // A link to an item that is no longer in the dataset: say so once, then clear it.
  const dropStale = useCallback(() => {
    setStale(true)
    update({ node: null })
  }, [update])
  useEffect(() => {
    if (node && !known.has(node)) dropStale()
    else if (node) setStale(false)
  }, [node, known, dropStale])

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
        ? new Set(searchNodes(graph.nodes, state.q, Infinity).map((r) => nodeKey(r.kind, r.id)))
        : null,
    [graph, state.q],
  )
  const selected = node && known.has(node) ? node : null
  const focus = useMemo(
    () => ({ selected, focus: computeFocus(ix, selected, matches) }),
    [ix, selected, matches],
  )
  const env = useMemo(() => detectEnv(), [])
  const { view, canToggle } = chooseView(env, state.view)
  const srList = useMemo(() => srRows(ix, selected), [ix, selected])
  const clearSelection = useCallback(
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
        onSelect={clearSelection}
      />
      <div className="explore__bar">
        <Search graph={graph} state={state} update={update} />
        <p className="mono-label">{renderGraph.nodes.length} nodes</p>
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
      {node && known.has(node) && (
        <SidePanel
          nodeKey={node}
          position={{ index: Math.max(keys.indexOf(node), 0), total: keys.length }}
          onSelect={select}
          onPrev={prev}
          onNext={next}
          onClose={close}
          onNotFound={dropStale}
        />
      )}
    </div>
  )
}
