import { useState, type ReactNode, type Ref } from 'react'

export interface ComboRow {
  key: string
  label: ReactNode
  pick: () => void
}

/**
 * A labelled text input over a listbox. ArrowUp/Down move the active row, Enter picks it
 * (the first by default), Escape clears the query, which closes the list.
 */
export function Combobox({
  id,
  label,
  placeholder,
  listLabel,
  query,
  onQuery,
  rows,
  inputRef,
  children,
}: {
  id: string
  label: string
  placeholder: string
  listLabel: string
  query: string
  onQuery: (q: string) => void
  rows: ComboRow[]
  inputRef?: Ref<HTMLInputElement>
  /** Shown between the input and the list, e.g. a no-match note. */
  children?: ReactNode
}) {
  const [activeIdx, setActiveIdx] = useState(0)
  const active = Math.min(activeIdx, Math.max(rows.length - 1, 0))
  return (
    <>
      <label htmlFor={`${id}-input`} className="mono-label">
        {label}
      </label>
      <input
        id={`${id}-input`}
        ref={inputRef}
        type="search"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        role="combobox"
        aria-expanded={rows.length > 0}
        aria-controls={`${id}-options`}
        aria-autocomplete="list"
        aria-activedescendant={rows.length > 0 ? `${id}-option-${active}` : undefined}
        onChange={(e) => {
          onQuery(e.target.value)
          setActiveIdx(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            rows[active]?.pick()
          } else if (e.key === 'Escape' && query) {
            // Closes the list; typing again reopens it.
            e.preventDefault()
            onQuery('')
          } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) {
            e.preventDefault()
            setActiveIdx((active + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length)
          }
        }}
      />
      {children}
      <ul
        id={`${id}-options`}
        role="listbox"
        aria-label={listLabel}
        className="meds__options"
        hidden={rows.length === 0}
      >
        {rows.map((r, i) => (
          <li
            key={r.key}
            id={`${id}-option-${i}`}
            role="option"
            aria-selected={active === i}
            className="meds__option"
            onClick={r.pick}
          >
            {r.label}
          </li>
        ))}
      </ul>
    </>
  )
}

export function NoMatch({ hint }: { hint: string }) {
  return (
    <div className="meds__nomatch">
      <p className="mono-label">No match in our dataset</p>
      <p className="meds__hint">
        {hint} Not being in our dataset doesn't mean a combination is safe.
      </p>
    </div>
  )
}
