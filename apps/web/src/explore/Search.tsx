import { useEffect, useMemo, useRef } from 'react'
import type { GraphPayload } from '@fdi/schema'
import { groupTerm, nodeKey, searchNodes } from '@fdi/schema/domain'
import type { ViewState } from '../urlState.ts'
import { isSlashFocus, matchCountLabel } from './searchUi.ts'

interface Props {
  graph: GraphPayload
  state: ViewState
  update: (patch: Partial<ViewState>, opts?: { push?: boolean }) => void
}

export function Search({ graph, state, update }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => searchNodes(graph.nodes, state.q), [graph.nodes, state.q])
  const searching = state.q.trim() !== ''

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSlashFocus(e)) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const select = (r: (typeof results)[number]) => update({ node: nodeKey(r.kind, r.id) }, { push: true })

  return (
    <div className="search" role="search">
      <input
        ref={input}
        type="search"
        className="search__input"
        placeholder="Search drugs, foods, mechanisms  ( / )"
        aria-label="Search drugs, foods and mechanisms"
        value={state.q}
        onChange={(e) => update({ q: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) select(results[0])
          if (e.key === 'Escape') update({ q: '' })
        }}
      />
      <p className="search__count mono-label" role="status" aria-live="polite">
        {searching ? matchCountLabel(results.length) : ''}
      </p>
      {results.length > 0 && (
        <ul className="search__results">
          {results.map((r) => (
            <li key={nodeKey(r.kind, r.id)}>
              <button type="button" className="search__item" onClick={() => select(r)}>
                <span className="mono-label">
                  {r.kind}
                  {r.group ? ` · ${groupTerm(r.kind)}` : ''}
                </span>{' '}
                {r.name}
                {r.matched !== r.name && (
                  <em className="search__alias"> (matched “{r.matched}”)</em>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
