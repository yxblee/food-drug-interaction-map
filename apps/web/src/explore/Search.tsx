import { useEffect, useMemo, useRef, useState } from 'react'
import type { GraphInteraction, GraphNode } from '@fdi/schema'
import { groupTerm, nodeKey, searchNodes } from '@fdi/schema/domain'
import type { ViewState } from '../urlState.ts'
import { ClearButton } from '../ClearButton.tsx'
import { plural } from '../plural.ts'
import {
  browseGroups,
  browseLabel,
  isSlashFocus,
  matchCountLabel,
  searchPlaceholder,
} from './searchUi.ts'

interface Props {
  nodes: GraphNode[]
  interactions: GraphInteraction[]
  state: ViewState
  update: (patch: Partial<ViewState>, opts?: { push?: boolean }) => void
}

export function Search({ nodes, interactions, state, update }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const searching = state.q.trim() !== ''
  const browse = useMemo(() => browseGroups(nodes, interactions), [nodes, interactions])
  // An empty box lists every Drug then every Food A-Z; typing narrows to matches.
  const matches = useMemo(() => searchNodes(nodes, state.q), [nodes, state.q])
  const results = searching ? matches : [...browse.drugs, ...browse.foods]
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

  useEffect(() => {
    if (open)
      document.getElementById(`search-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

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
          onFocus={() => setClosed(false)}
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
              setClosed(false)
              input.current?.focus()
            }}
          />
        )}
      </div>
      <p className="search__count mono-label" role="status" aria-live="polite">
        {searching
          ? matchCountLabel(results.length)
          : open
            ? browseLabel(browse.drugs.length, browse.foods.length)
            : ''}
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
        className={`search__results combo__list${searching ? '' : ' combo__list--browse'}`}
        hidden={!open}
        // Keep focus in the input when an option is pressed, so the blur above does not eat the click.
        onMouseDown={(e) => e.preventDefault()}
      >
        {searching
          ? matches.map((r, i) => (
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
                  {r.matched !== r.name && (
                    <em className="search__alias"> (matched “{r.matched}”)</em>
                  )}
                </span>
              </li>
            ))
          : [
              { label: 'Drugs', rows: browse.drugs, offset: 0 },
              { label: 'Foods', rows: browse.foods, offset: browse.drugs.length },
            ].map(({ label, rows, offset }) => (
              <li key={label} role="group" aria-labelledby={`browse-${label}`}>
                <span id={`browse-${label}`} className="combo__heading mono-label">
                  {label}
                </span>
                <ul role="presentation" className="combo__group">
                  {rows.map((r, k) => (
                    <li
                      key={nodeKey(r.kind, r.id)}
                      id={`search-option-${offset + k}`}
                      role="option"
                      aria-selected={active === offset + k}
                      className="combo__option combo__option--browse"
                      onClick={() => select(r)}
                    >
                      <span data-name>{r.name}</span>
                      <span className="mono-label">
                        {plural(r.count, 'Interaction', 'Interactions')}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
      </ul>
    </div>
  )
}
