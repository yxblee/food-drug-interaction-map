import { Fragment, useEffect, useState } from 'react'
import type { NodeDetail, Severity } from '@fdi/schema'
import { groupTerm } from '@fdi/schema/domain'
import { fetchNode } from '../api.ts'
import { InteractionRow } from '../explore/InteractionRow.tsx'
import { SeverityBadge } from '../explore/SeverityBadge.tsx'
import { helpedBy, namesOnlyDrug, type DrugPairings, type FoodWarning } from './checkMeds.ts'

/** One Food warning. `showSeverity` prints its badge where no Severity group heading sits above it. */
export function WarningRow({
  warning: w,
  helps = [],
  showSeverity,
  collapsible,
}: {
  warning: FoodWarning
  /** Helpful pairings for the Medication list, to say when this Food helps another listed Drug. */
  helps?: DrugPairings[]
  showSeverity?: boolean
  /** A long list: every row, Avoid and Caution too, starts as one line that opens to its advice. */
  collapsible?: boolean
}) {
  const [detail, setDetail] = useState<NodeDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const affectedIds = new Set(w.affected.map((h) => h.interaction.id))
  // A Drug whose own Severity is minimal, under a more severe row, is named apart.
  const negligible = w.affected.filter(
    (h) => h.interaction.severity === 'minimal' && w.severity !== 'minimal',
  )
  const affecting = w.affected.filter((h) => !negligible.includes(h))
  const drugChip = (h: FoodWarning['affected'][number], i: number) => (
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
  )
  // Avoid and Caution show their advice up front; Monitor and Minimal stay collapsed on screen.
  const upFront = !collapsible && (w.severity === 'avoid' || w.severity === 'caution')
  const load = () => {
    if (detail) return
    setFailed(false)
    fetchNode('food', w.food.id).then(setDetail, () => setFailed(true))
  }
  // Every row loads its advice at once, so a printout has Monitor and Minimal rows open and filled.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.food.id])
  // The warning stands as written; the note only says this Food helps a different listed Drug.
  const helped = helpedBy(helps, w.food, new Set(w.affected.map((h) => h.drug.id)))
  const lead = (
    <>
      {showSeverity && (
        <>
          <SeverityBadge severity={w.severity} />{' '}
        </>
      )}
      <h4 className="warning__name">
        <strong>{w.food.name}</strong>
      </h4>
      {w.food.group && <span className="mono-label"> {groupTerm('food')}</span>}:{' '}
      <span className="warning__drugs">
        {affecting.length > 0 && (
          <>
            {LEAD_VERB[w.severity]} {affecting.map(drugChip)}
          </>
        )}
        {affecting.length > 0 && negligible.length > 0 && '; '}
        {negligible.length > 0 && <>no meaningful effect on {negligible.map(drugChip)}</>}
      </span>
    </>
  )
  const body = (
    <>
      {failed && <p role="alert">Couldn't load details. Reload the page to try again.</p>}
      {!detail && !failed && upFront && <p className="mono-label">Loading advice…</p>}
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
                groupSeverity={w.severity}
                cautionFirst
                hideName={namesOnlyDrug(w)}
              />
            ))}
        </ul>
      )}
      {helped.length > 0 && (
        <p className="warning__note">
          This does not change the warning above. {w.food.name} is also listed under “Helps to take
          with” for {helped.map((d) => d.name).join(', ')}.
        </p>
      )}
    </>
  )
  return (
    <li className={collapsible ? 'warning warning--collapsed' : 'warning'}>
      {upFront ? (
        <>
          <div className="warning__lead">{lead}</div>
          {body}
        </>
      ) : (
        <details>
          <summary>
            <span className="warning__lead">{lead}</span>
          </summary>
          {body}
        </details>
      )}
    </li>
  )
}

const LEAD_VERB: Record<Severity, string> = {
  avoid: 'avoid with',
  caution: 'take care with',
  monitor: 'watch for changes with',
  minimal: 'little effect on',
}
