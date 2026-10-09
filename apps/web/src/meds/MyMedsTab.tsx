import { useMemo, useState } from 'react'
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
  onSeeOnMap: () => void
}

export function MyMedsTab({ graph, meds, setMeds, onSeeOnMap }: MyMedsTabProps) {
  const ix = useMemo(() => buildIndex(graph.nodes, graph.interactions), [graph])
  const [query, setQuery] = useState('')

  const candidates = useMemo(
    () => graph.nodes.filter((n) => n.kind === 'drug' && !n.group && !meds.includes(n.id)),
    [graph, meds],
  )
  const options = useMemo(() => searchNodes(candidates, query, 8), [candidates, query])
  const warnings = useMemo(() => checkMeds(ix, meds), [ix, meds])
  const add = (id: string) => {
    setMeds((m) => (m.includes(id) ? m : [...m, id]))
    setQuery('')
  }
  const name = (id: string) => ix.nodes.get(nodeKey('drug', id))?.name ?? id

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
          type="search"
          autoComplete="off"
          placeholder="e.g. warfarin or Coumadin"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && options[0]) add(options[0].id)
          }}
        />
        {query && (
          <ul className="meds__options">
            {options.length === 0 && <li className="mono-label">No match in our dataset</li>}
            {options.map((o) => (
              <li key={o.id}>
                <button onClick={() => add(o.id)}>
                  {o.name}
                  {o.matched !== o.name && <span className="mono-label"> ({o.matched})</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <ul className="meds__chips" aria-label="Your medications">
          {meds.map((id) => (
            <li key={id} className="chip">
              {name(id)}
              <button
                aria-label={`Remove ${name(id)}`}
                onClick={() => setMeds((m) => m.filter((x) => x !== id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        {meds.length > 0 && (
          <div className="meds__actions">
            <button className="pill-button" onClick={() => setMeds(() => [])}>
              Clear all
            </button>
            <button className="pill-button" onClick={onSeeOnMap}>
              See on map
            </button>
          </div>
        )}
      </section>

      <section className="meds__results" aria-labelledby="results-title">
        <h2 id="results-title">Foods to watch</h2>
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
            affects {w.affected.map((h) => h.drug.name).join(', ')}
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
