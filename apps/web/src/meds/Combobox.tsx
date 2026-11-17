import { useState, type ReactNode, type Ref } from 'react'
import { ClearButton } from '../ClearButton.tsx'

export interface ComboRow {
  key: string
  label: ReactNode
  pick: () => void
}

/**
 * A labelled text input over a listbox. ArrowUp/Down move the active row, Enter picks it
 * (the first by default). Escape closes the list; a second Escape clears the query.
 * Leaving the field closes it; typing reopens it.
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
  const [open, setOpen] = useState(true)
  const shown = open ? rows : []
  const active = Math.min(activeIdx, Math.max(shown.length - 1, 0))
  return (
    <>
      <label htmlFor={`${id}-input`} className="mono-label">
        {label}
      </label>
      <div className="combo">
        <input
          id={`${id}-input`}
          ref={inputRef}
          type="search"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          aria-activedescendant={shown.length > 0 ? `${id}-option-${active}` : undefined}
          onChange={(e) => {
            onQuery(e.target.value)
            setActiveIdx(0)
            setOpen(true)
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              shown[active]?.pick()
            } else if (e.key === 'Escape' && (shown.length || query)) {
              e.preventDefault()
              if (shown.length) setOpen(false)
              else onQuery('')
            } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) {
              e.preventDefault()
              if (!open) setOpen(true)
              else
                setActiveIdx((active + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length)
            }
          }}
        />
        {query && (
          <ClearButton
            onClear={() => {
              onQuery('')
              document.getElementById(`${id}-input`)?.focus()
            }}
          />
        )}
      </div>
      {children}
      <ul
        id={`${id}-options`}
        role="listbox"
        aria-label={listLabel}
        className="meds__options combo__list"
        hidden={shown.length === 0}
        // Keep focus in the input when an option is pressed, so the blur above does not eat the click.
        onMouseDown={(e) => e.preventDefault()}
      >
        {shown.map((r, i) => (
          <li
            key={r.key}
            id={`${id}-option-${i}`}
            role="option"
            aria-selected={active === i}
            className="combo__option"
            onClick={r.pick}
          >
            <span>{r.label}</span>
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
