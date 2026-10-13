import { useEffect, useMemo, useRef, useState } from 'react'
import type { GraphNode } from '@fdi/schema'
import { groupTerm, nodeKey, searchNodes } from '@fdi/schema/domain'
import type { ViewState } from '../urlState.ts'
import { isSlashFocus, matchCountLabel } from './searchUi.ts'

interface Props {
  nodes: GraphNode[]
  state: ViewState
  update: (patch: Partial<ViewState>, opts?: { push?: boolean }) => void
}

export function Search({ nodes, state, update }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => searchNodes(nodes, state.q), [nodes, state.q])
  const searching = state.q.trim() !== ''
  // Picking a result closes the list (it would cover the panel) until the query changes.
  const [picked, setPicked] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSlashFocus(e)) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const select = (r: (typeof results)[number]) => {
    setPicked(true)
    update({ node: nodeKey(r.kind, r.id) }, { push: true })
  }

  return (
    <div className="search" role="search">
      <input
        ref={input}
        type="search"
        className="search__input"
        placeholder="Search drugs, foods, mechanisms  ( / )"
        aria-label="Search drugs, foods and mechanisms"
        value={state.q}
        onChange={(e) => {
          setPicked(false)
          update({ q: e.target.value })
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) select(results[0])
          if (e.key === 'Escape') update({ q: '' })
        }}
      />
      <p className="search__count mono-label" role="status" aria-live="polite">
        {searching ? matchCountLabel(results.length) : ''}
      </p>
      {searching && results.length === 0 && (
        <p className="search__empty">
          Check the spelling or try the generic name. Not being in our dataset doesn't mean a
          combination is safe.
        </p>
      )}
      {results.length > 0 && !picked && (
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
