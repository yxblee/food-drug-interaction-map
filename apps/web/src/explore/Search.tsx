import { useEffect, useMemo, useRef, useState } from 'react'
import type { GraphNode } from '@fdi/schema'
import { groupTerm, nodeKey, searchNodes } from '@fdi/schema/domain'
import type { ViewState } from '../urlState.ts'
import { ClearButton } from '../ClearButton.tsx'
import { isSlashFocus, matchCountLabel, searchPlaceholder } from './searchUi.ts'

interface Props {
  nodes: GraphNode[]
  state: ViewState
  update: (patch: Partial<ViewState>, opts?: { push?: boolean }) => void
}

export function Search({ nodes, state, update }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => searchNodes(nodes, state.q), [nodes, state.q])
  const searching = state.q.trim() !== ''
  // Picking a result, Escape or leaving the field closes the list until the query changes.
  const [closed, setClosed] = useState(false)
  const [finePointer] = useState(() => matchMedia('(pointer: fine)').matches)
  const [activeIdx, setActiveIdx] = useState(0)
  const open = results.length > 0 && !closed
  const active = Math.min(activeIdx, Math.max(results.length - 1, 0))

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
    setClosed(true)
    update({ node: nodeKey(r.kind, r.id) }, { push: true })
  }

  return (
    <div className="search" role="search">
      <div className="combo">
        <input
          ref={input}
          type="search"
          className="search__input"
          placeholder={searchPlaceholder(finePointer)}
          aria-label="Search drugs, foods and mechanisms"
          autoComplete="off"
          value={state.q}
          role="combobox"
          aria-expanded={open}
          aria-controls="search-options"
          aria-autocomplete="list"
          aria-activedescendant={open ? `search-option-${active}` : undefined}
          onChange={(e) => {
            setClosed(false)
            setActiveIdx(0)
            update({ q: e.target.value })
          }}
          onBlur={() => setClosed(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (open && results[active]) select(results[active])
            } else if (e.key === 'Escape' && (open || state.q)) {
              e.preventDefault()
              if (open) setClosed(true)
              else update({ q: '' })
            } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && results.length) {
              e.preventDefault()
              const n = results.length
              if (!open) setClosed(false)
              else setActiveIdx((active + (e.key === 'ArrowDown' ? 1 : n - 1)) % n)
            }
          }}
        />
        {state.q && (
          <ClearButton
            onClear={() => {
              update({ q: '' })
              input.current?.focus()
            }}
          />
        )}
      </div>
      <p className="search__count mono-label" role="status" aria-live="polite">
        {searching ? matchCountLabel(results.length) : ''}
      </p>
      {searching && results.length === 0 && (
        <p className="search__empty">
          Check the spelling or try the generic name. Not being in our dataset doesn't mean a
          combination is safe.
        </p>
      )}
      <ul
        id="search-options"
        role="listbox"
        aria-label="Matching drugs, foods and mechanisms"
        className="search__results combo__list"
        hidden={!open}
        // Keep focus in the input when an option is pressed, so the blur above does not eat the click.
        onMouseDown={(e) => e.preventDefault()}
      >
        {results.map((r, i) => (
          <li
            key={nodeKey(r.kind, r.id)}
            id={`search-option-${i}`}
            role="option"
            aria-selected={active === i}
            className="combo__option"
            onClick={() => select(r)}
          >
            <span>
              <span className="mono-label">
                {r.kind}
                {r.group ? ` · ${groupTerm(r.kind)}` : ''}
              </span>{' '}
              {r.name}
              {r.matched !== r.name && <em className="search__alias"> (matched “{r.matched}”)</em>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
