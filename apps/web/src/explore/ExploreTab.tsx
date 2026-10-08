import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GraphPayload } from '@fdi/schema'
import { nodeKey } from '@fdi/schema/domain'
import type { Palette } from '../theme/tokens.ts'
import type { ViewState } from '../urlState.ts'
import { browseKeys, stepKey } from './browse.ts'
import { SidePanel } from './SidePanel.tsx'
import './explore.css'

export interface ExploreTabProps {
  graph: GraphPayload
  state: ViewState
  update: (patch: Partial<ViewState>, opts?: { push?: boolean }) => void
  palette: Palette
  medsFilter: Set<string> | null
  clearMedsFilter: () => void
}

export function ExploreTab({ graph, state, update }: ExploreTabProps) {
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

  return (
    <div className="explore">
      <p className="mono-label">{graph.nodes.length} nodes</p>
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
