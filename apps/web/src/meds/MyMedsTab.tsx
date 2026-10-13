import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { GraphPayload, NodeDetail } from '@fdi/schema'
import { SEVERITIES } from '@fdi/schema'
import { buildIndex, groupTerm, nodeKey, searchNodes, type Index } from '@fdi/schema/domain'
import { fetchNode } from '../api.ts'
import { InteractionRow } from '../explore/InteractionRow.tsx'
import { SEVERITY_LABEL, SEVERITY_LEGEND, SeverityBadge } from '../explore/SeverityBadge.tsx'
import { checkMeds, type FoodWarning } from './checkMeds.ts'
import './meds.css'

export interface MyMedsTabProps {
  graph: GraphPayload
  meds: string[]
  setMeds: (update: (m: string[]) => string[]) => void
  notChecked: string[]
  setNotChecked: (update: (m: string[]) => string[]) => void
  onSeeOnMap: () => void
}

export function MyMedsTab({
  graph,
  meds,
  setMeds,
  notChecked,
  setNotChecked,
  onSeeOnMap,
}: MyMedsTabProps) {
  const ix = useMemo(() => buildIndex(graph.nodes, graph.interactions), [graph])
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  // The list before "Clear all", in memory only, for UNDO_MS.
  const [undo, setUndo] = useState<{ ids: string[]; names: string[] } | null>(null)
  const undoTimer = useRef<number>(undefined)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => () => window.clearTimeout(undoTimer.current), [])
  const dropUndo = () => {
    window.clearTimeout(undoTimer.current)
    setUndo(null)
  }

  const candidates = useMemo(
    () => graph.nodes.filter((n) => n.kind === 'drug' && !n.group),
    [graph],
  )
  const options = useMemo(() => searchNodes(candidates, query, 8), [candidates, query])
  const warnings = useMemo(() => checkMeds(ix, meds), [ix, meds])
  const name = (id: string) => ix.nodes.get(nodeKey('drug', id))?.name ?? id
  const add = (id: string, matched: string) => {
    setQuery('')
    dropUndo()
    if (meds.includes(id)) {
      const typed = matched === name(id) ? '' : ` (${matched})`
      setNotice(`${name(id)}${typed} is already on your list`)
      document.getElementById(chipId(id))?.focus()
      return
    }
    setNotice('')
    setMeds((m) => (m.includes(id) ? m : [...m, id]))
  }
  const addNotChecked = (raw: string) => {
    const typed = raw.trim()
    if (!typed) return
    setQuery('')
    dropUndo()
    if (notChecked.some((n) => n.toLowerCase() === typed.toLowerCase())) {
      setNotice(`No match in our dataset. ${typed} is already on your list as not checked`)
      return
    }
    setNotice(`No match in our dataset. ${typed} added as not checked`)
    setNotChecked((n) => [...n, typed])
  }
  const clearAll = () => {
    setUndo({ ids: meds, names: notChecked })
    setMeds(() => [])
    setNotChecked(() => [])
    setNotice('List cleared')
    window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => {
      setUndo(null)
      setNotice((n) => (n === 'List cleared' ? '' : n))
    }, UNDO_MS)
    input.current?.focus()
  }
  const undoClear = () => {
    if (!undo) return
    setMeds(() => undo.ids)
    setNotChecked(() => undo.names)
    setNotice('List restored')
    dropUndo()
    input.current?.focus()
  }

  return (
    <div className="meds">
      <section className="meds__picker" aria-labelledby="meds-title">
        <h2 id="meds-title">My meds</h2>
        <p className="meds__privacy">
          Your list stays on this device. It is never sent to our server.
        </p>
        <label htmlFor="med-input" className="mono-label">
          Add a medication
        </label>
        <input
          id="med-input"
          ref={input}
          type="search"
          autoComplete="off"
          placeholder="e.g. warfarin or Coumadin"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setNotice('')
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (options[0]) add(options[0].id, options[0].matched)
            else addNotChecked(query)
          }}
        />
        {query && (
          <ul className="meds__options">
            {options.length === 0 && query.trim() && (
              <>
                <li className="mono-label">No match in our dataset</li>
                <li>
                  <button onClick={() => addNotChecked(query)}>
                    Add “{query.trim()}” as not checked
                  </button>
                </li>
              </>
            )}
            {options.map((o) => (
              <li key={o.id}>
                <button onClick={() => add(o.id, o.matched)}>
                  {o.name}
                  {o.matched !== o.name && <span className="mono-label"> ({o.matched})</span>}
                  {meds.includes(o.id) && <span className="mono-label"> · on your list</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p role="status" className="meds__status">
          {undo ? (
            <>
              List cleared · <button onClick={undoClear}>Undo</button>
            </>
          ) : (
            notice
          )}
        </p>
        <ul className="meds__chips" aria-label="Your medications">
          {meds.map((id) => (
            <li key={id} id={chipId(id)} tabIndex={-1} className="chip">
              {name(id)}
              <button
                aria-label={`Remove ${name(id)}`}
                onClick={() => setMeds((m) => m.filter((x) => x !== id))}
              >
                ✕
              </button>
            </li>
          ))}
          {notChecked.map((n) => (
            <li key={n} className="chip chip--unchecked">
              {n}
              <span className="mono-label">not checked</span>
              <button
                aria-label={`Remove ${n}`}
                onClick={() => setNotChecked((l) => l.filter((x) => x !== n))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        {(meds.length > 0 || notChecked.length > 0) && (
          <div className="meds__actions">
            <button className="pill-button" onClick={clearAll}>
              Clear all
            </button>
            {meds.length > 0 && (
              <button className="pill-button" onClick={onSeeOnMap}>
                See on map
              </button>
            )}
          </div>
        )}
      </section>

      <section className="meds__results" aria-labelledby="results-title">
        <h2 id="results-title">Foods to watch</h2>
        <p role="status" className="meds__status">
          {(meds.length > 0 || notChecked.length > 0) &&
            resultsSummary(meds.length > 0 ? warnings : null, notChecked.length)}
        </p>
        {notChecked.length > 0 && (
          <p className="meds__unchecked">
            Not checked: {notChecked.join(', ')}. Being missing here doesn't mean it's safe; ask
            your pharmacist.
          </p>
        )}
        {meds.length === 0 ? (
          <p>
            Add the medications you take, such as warfarin, simvastatin or levothyroxine, to see
            which foods to watch.
          </p>
        ) : warnings.length === 0 ? (
          <p>
            No food interactions in our dataset for these drugs. Our dataset is not exhaustive. Ask
            your pharmacist if you're unsure.
          </p>
        ) : (
          SEVERITIES.map((sev) => {
            const group = warnings.filter((w) => w.severity === sev)
            if (!group.length) return null
            return (
              <section key={sev} aria-labelledby={`sev-${sev}`} className="meds__sev">
                <h3 id={`sev-${sev}`}>
                  <SeverityBadge severity={sev} /> {SEVERITY_LABEL[sev]}
                </h3>
                <p className="mono-label">{SEVERITY_LEGEND[sev]}</p>
                <ul className="meds__list">
                  {group.map((w) => (
                    <WarningRow key={w.food.id} warning={w} ix={ix} />
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </section>
    </div>
  )
}

function WarningRow({ warning: w, ix }: { warning: FoodWarning; ix: Index }) {
  const [detail, setDetail] = useState<NodeDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const affectedIds = new Set(w.affected.map((h) => h.interaction.id))
  return (
    <li className="warning">
      <details
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open && !detail) {
            setFailed(false)
            fetchNode('food', w.food.id).then(setDetail, () => setFailed(true))
          }
        }}
      >
        <summary>
          <SeverityBadge severity={w.severity} /> <strong>{w.food.name}</strong>
          {w.food.group && <span className="mono-label"> {groupTerm('food')}</span>}
          <span className="warning__drugs">
            {' '}
            affects{' '}
            {w.affected.map((h, i) => (
              <Fragment key={`${h.drug.id}:${h.interaction.id}`}>
                {i > 0 && ', '}
                <span className="warning__drug">
                  {h.drug.name}
                  {h.interaction.severity !== w.severity && (
                    <>
                      {' '}
                      <SeverityBadge severity={h.interaction.severity} />
                    </>
                  )}
                </span>
              </Fragment>
            ))}
          </span>
        </summary>
        <ul className="warning__affected">
          {w.affected.map((h) => (
            <li key={`${h.drug.id}:${h.interaction.id}`}>
              <strong>{h.drug.name}</strong>
              {h.inheritedFrom && (
                <span className="mono-label">
                  {' '}
                  (applies to all{' '}
                  {ix.nodes.get(nodeKey('drug', h.inheritedFrom))?.name ?? h.inheritedFrom})
                </span>
              )}
              : {h.interaction.summary} <em>{h.interaction.advice}</em>
            </li>
          ))}
        </ul>
        {failed && <p role="alert">Couldn't load details. Close and reopen to try again.</p>}
        {detail && (
          <ul className="panel__rows">
            {detail.interactions
              .filter((r) => affectedIds.has(r.interaction.id))
              .map((row) => (
                <InteractionRow
                  key={row.interaction.id}
                  row={row}
                  nodes={detail.nodes}
                  mechanisms={detail.mechanisms}
                  perspective="food"
                />
              ))}
          </ul>
        )}
      </details>
    </li>
  )
}

const chipId = (id: string) => `med-chip-${id}`

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const UNDO_MS = 10_000

function resultsSummary(warnings: FoodWarning[] | null, notChecked: number): string {
  const unchecked = notChecked ? `${notChecked} not checked` : ''
  if (!warnings) return unchecked
  const avoid = warnings.filter((w) => w.severity === 'avoid').length
  const watch = plural(warnings.length, 'food to watch', 'foods to watch')
  return [avoid ? `${watch}, ${avoid} to avoid` : watch, unchecked].filter(Boolean).join(', ')
}
