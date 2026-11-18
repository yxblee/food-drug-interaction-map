import { useEffect, useMemo, useRef, useState } from 'react'
import type { GraphPayload } from '@fdi/schema'
import { SEVERITIES } from '@fdi/schema'
import { buildIndex, nodeKey, searchNodes, type Index } from '@fdi/schema/domain'
import { PillLabel } from '../PillLabel.tsx'
import { MedlinePlusLink } from '../MedlinePlusLink.tsx'
import { SeverityGroupHeading } from '../explore/SeverityBadge.tsx'
import { PAIRING_MEANING, PairingRow } from '../explore/PairingRow.tsx'
import { checkMeds, pairingsFor, type FoodWarning } from './checkMeds.ts'
import { Combobox, NoMatch } from './Combobox.tsx'
import { FoodCheck } from './FoodCheck.tsx'
import { WarningRow } from './WarningRow.tsx'
import './meds.css'
import './print.css'

export interface MyMedsTabProps {
  graph: GraphPayload
  meds: string[]
  setMeds: (update: (m: string[]) => string[]) => void
  brands: Record<string, string>
  setBrands: (update: (b: Record<string, string>) => Record<string, string>) => void
  notChecked: string[]
  setNotChecked: (update: (m: string[]) => string[]) => void
  onSeeOnMap: () => void
}

export function MyMedsTab({
  graph,
  meds,
  setMeds,
  brands,
  setBrands,
  notChecked,
  setNotChecked,
  onSeeOnMap,
}: MyMedsTabProps) {
  const ix = useMemo(() => buildIndex(graph.nodes, graph.interactions, graph.pairings), [graph])
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  // The list before "Clear all", in memory only, for UNDO_MS.
  const [undo, setUndo] = useState<{
    ids: string[]
    names: string[]
    brands: Record<string, string>
  } | null>(null)
  const undoTimer = useRef<number>(undefined)
  const input = useRef<HTMLInputElement>(null)
  const printed = usePrintDate()
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
  const showNoMatch = options.length === 0 && !!query.trim()
  const warnings = useMemo(() => checkMeds(ix, meds), [ix, meds])
  const helps = useMemo(() => pairingsFor(ix, meds), [ix, meds])
  const name = (id: string) => ix.nodes.get(nodeKey('drug', id))?.name ?? id
  const link = (id: string) => ix.nodes.get(nodeKey('drug', id))?.medlineplus
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
    // Echo the Brand name the person typed, so the chip matches the box on their shelf.
    if (matched !== name(id)) setBrands((b) => ({ ...b, [id]: matched }))
  }
  const removeMed = (id: string) => {
    setMeds((m) => m.filter((x) => x !== id))
    setBrands(({ [id]: _gone, ...rest }) => rest)
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
    setUndo({ ids: meds, names: notChecked, brands })
    setMeds(() => [])
    setBrands(() => ({}))
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
    setBrands(() => undo.brands)
    setNotChecked(() => undo.names)
    setNotice('List restored')
    dropUndo()
    input.current?.focus()
  }

  return (
    <div className="meds">
      {/* Print only: what the page header and tabs say on screen, plus the date. */}
      <div className="meds__printhead">
        <p className="meds__printname">Food–Drug Interaction Map</p>
        <p>Foods to watch for the medications below. Printed {printed}.</p>
      </div>
      <section className="meds__picker" aria-labelledby="meds-title">
        <h2 id="meds-title">My meds</h2>
        <p className="meds__privacy">
          Your list stays on this device. It is never sent to our server.
        </p>
        <Combobox
          id="med"
          label="Add a medication"
          placeholder="e.g. warfarin or Coumadin"
          listLabel="Matching medications"
          inputRef={input}
          query={query}
          onQuery={(q) => {
            setQuery(q)
            setNotice('')
          }}
          rows={
            showNoMatch
              ? [
                  {
                    key: 'not-checked',
                    label: `Add “${query.trim()}” as not checked`,
                    pick: () => addNotChecked(query),
                  },
                ]
              : options.map((o) => ({
                  key: o.id,
                  label: (
                    <>
                      {o.name}
                      {o.matched !== o.name && <span className="mono-label"> ({o.matched})</span>}
                      {meds.includes(o.id) && <span className="mono-label"> · on your list</span>}
                    </>
                  ),
                  pick: () => add(o.id, o.matched),
                }))
          }
        >
          {showNoMatch && <NoMatch hint="Check the spelling or try the generic name." />}
        </Combobox>
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
              {brands[id] && <span className="chip__brand mono-label"> ({brands[id]})</span>}
              {link(id) && <MedlinePlusLink compact name={name(id)} url={link(id)!} />}
              <button aria-label={`Remove ${name(id)}`} onClick={() => removeMed(id)}>
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
      </section>

      {/* Right after the chips in the DOM, so Tab goes from the list to the buttons that act on it. */}
      {(meds.length > 0 || notChecked.length > 0) && (
        <div className="meds__actions">
          <button className="pill-button" onClick={clearAll}>
            <PillLabel>Clear all</PillLabel>
          </button>
          {meds.length > 0 && (
            <button className="pill-button" onClick={onSeeOnMap}>
              <PillLabel>See on map</PillLabel>
            </button>
          )}
          {meds.length > 0 && (
            <button className="pill-button" onClick={() => window.print()}>
              <PillLabel>Print</PillLabel>
            </button>
          )}
        </div>
      )}

      <div className="meds__main">
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
              No food interactions in our dataset for these drugs. Our dataset is not exhaustive.
              Ask your pharmacist if you're unsure.
            </p>
          ) : (
            SEVERITIES.map((sev) => {
              const group = warnings.filter((w) => w.severity === sev)
              if (!group.length) return null
              return (
                <section key={sev} aria-labelledby={`sev-${sev}`} className="meds__sev">
                  <SeverityGroupHeading severity={sev} />
                  <ul className="meds__list">
                    {group.map((w) => (
                      <WarningRow key={w.food.id} warning={w} helps={helps} />
                    ))}
                  </ul>
                </section>
              )
            })
          )}
          {helps.length > 0 && (
            <section aria-labelledby="helps-title" className="meds__sev meds__helps">
              <h3 id="helps-title">Helps to take with</h3>
              <p className="sev-meaning">{PAIRING_MEANING}</p>
              <ul className="meds__list">
                {helps.map(({ drug, pairings }) => (
                  <li key={drug.id} className="warning">
                    <p className="warning__lead">
                      <strong>{drug.name}</strong>
                    </p>
                    <ul className="panel__rows">
                      {pairings.map(({ pairing, inheritedFrom }) => (
                        <PairingRow
                          key={pairing.id}
                          pairing={pairing}
                          nodes={nodesOf(ix, pairing.food, pairing.drug)}
                          perspective="drug"
                          inheritedFrom={inheritedFrom}
                        />
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>

        {/* After the results in the DOM and on screen at every width, so Tab follows what is seen. */}
        <FoodCheck graph={graph} ix={ix} meds={meds} notChecked={notChecked} helps={helps} />
      </div>
    </div>
  )
}

const nodesOf = (ix: Index, food: string, drug: string) => ({
  [nodeKey('food', food)]: ix.nodes.get(nodeKey('food', food))!,
  [nodeKey('drug', drug)]: ix.nodes.get(nodeKey('drug', drug))!,
})

const chipId = (id: string) => `med-chip-${id}`

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const UNDO_MS = 10_000

function resultsSummary(warnings: FoodWarning[] | null, notChecked: number): string {
  const unchecked = notChecked ? `${notChecked} not checked` : ''
  if (!warnings) return unchecked
  const avoid = warnings.filter((w) => w.severity === 'avoid').length
  const watch = plural(warnings.length, 'food to watch', 'foods to watch')
  return [avoid ? `${watch}, including ${avoid} to avoid` : watch, unchecked]
    .filter(Boolean)
    .join(', ')
}

/** Today's date, refreshed at each print so a tab left open overnight still prints today. */
function usePrintDate() {
  const fmt = () => new Date().toLocaleDateString(undefined, { dateStyle: 'long' })
  const [date, setDate] = useState(fmt)
  useEffect(() => {
    // Ctrl+P and the Print pill both land here. Closed rows do not print, so open them for the
    // page and put each back as it was afterwards.
    let opened: HTMLDetailsElement[] = []
    const before = () => {
      setDate(fmt())
      opened = [
        ...document.querySelectorAll<HTMLDetailsElement>(
          '.meds details:not([open]), .app__footer details:not([open])',
        ),
      ]
      for (const d of opened) d.open = true
    }
    const after = () => {
      for (const d of opened) d.open = false
      opened = []
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])
  return date
}
