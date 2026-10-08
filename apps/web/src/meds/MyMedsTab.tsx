import { useEffect, useMemo, useState } from 'react'
import type { GraphPayload, NodeDetail } from '@fdi/schema'
import { SEVERITIES } from '@fdi/schema'
import { buildIndex, nodeKey, searchNodes, type Index } from '@fdi/schema/domain'
import { fetchNode } from '../api.ts'
import { InteractionRow } from '../explore/InteractionRow.tsx'
import { SEVERITY_LABEL, SEVERITY_LEGEND, SeverityBadge } from '../explore/SeverityBadge.tsx'
import { safeStorage } from '../storage.ts'
import { checkMeds, mapKeysFor, type FoodWarning } from './checkMeds.ts'
import { loadMeds, saveMeds } from './medsStorage.ts'
import './meds.css'

export interface MyMedsTabProps {
  graph: GraphPayload
  onSeeOnMap: (keys: Set<string>) => void
}

export function MyMedsTab({ graph, onSeeOnMap }: MyMedsTabProps) {
  const ix = useMemo(() => buildIndex(graph.nodes, graph.interactions), [graph])
  const storage = useMemo(() => safeStorage(), [])
  const isMedication = (id: string) => ix.nodes.get(nodeKey('drug', id))?.group === false
  const [initial] = useState(() =>
    storage ? loadMeds(storage, isMedication) : { ids: [], dropped: [] },
  )
  const [meds, setMeds] = useState<string[]>(initial.ids)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!storage) return
    try {
      saveMeds(storage, meds)
    } catch {
      // storage full or blocked: the list still works for this visit
    }
  }, [meds, storage])

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
        {initial.dropped.length > 0 && (
          <p role="status" className="meds__notice">
            Removed {initial.dropped.length} medication(s) that are no longer in our dataset.
          </p>
        )}
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
            <button className="pill-button" onClick={() => setMeds([])}>
              Clear all
            </button>
            <button className="pill-button" onClick={() => onSeeOnMap(mapKeysFor(warnings, meds))}>
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
  const hitIds = new Set(w.hits.map((h) => h.interaction.id))
  return (
    <li className="warning">
      <details
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open && !detail)
            fetchNode('food', w.food.id).then(setDetail, () => {})
        }}
      >
        <summary>
          <SeverityBadge severity={w.severity} /> <strong>{w.food.name}</strong>
          {w.food.group && <span className="mono-label"> (group)</span>}
          <span className="warning__drugs">
            {' '}
            affects {w.hits.map((h) => h.drug.name).join(', ')}
          </span>
        </summary>
        <ul className="warning__hits">
          {w.hits.map((h) => (
            <li key={`${h.drug.id}:${h.interaction.id}`}>
              <strong>{h.drug.name}</strong>
              {h.via && (
                <span className="mono-label">
                  {' '}
                  (applies to all {ix.nodes.get(nodeKey('drug', h.via))?.name ?? h.via})
                </span>
              )}
              : {h.interaction.summary} <em>{h.interaction.advice}</em>
            </li>
          ))}
        </ul>
        {detail && (
          <ul className="panel__rows">
            {detail.interactions
              .filter((r) => hitIds.has(r.interaction.id))
              .map((row) => (
                <InteractionRow
                  key={row.interaction.id}
                  row={row}
                  nodes={detail.nodes}
                  mechanisms={detail.mechanisms}
                  perspective="food"
                  viaName={row.via ? detail.nodes[`drug:${row.via}`]?.name : undefined}
                />
              ))}
          </ul>
        )}
      </details>
    </li>
  )
}
