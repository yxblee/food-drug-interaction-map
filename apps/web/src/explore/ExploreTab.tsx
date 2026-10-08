import type { GraphPayload } from '@fdi/schema'
import type { Palette } from '../theme/tokens.ts'
import type { ViewState } from '../urlState.ts'
import { Search } from './Search.tsx'

export interface ExploreTabProps {
  graph: GraphPayload
  state: ViewState
  update: (patch: Partial<ViewState>, opts?: { push?: boolean }) => void
  palette: Palette
  medsFilter: Set<string> | null
  clearMedsFilter: () => void
}

export function ExploreTab({ graph, state, update }: ExploreTabProps) {
  return (
    <>
      <Search graph={graph} state={state} update={update} />
      <p className="mono-label">{graph.nodes.length} nodes</p>
    </>
  )
}
