import type {
  Citation,
  GraphNode,
  Interaction,
  Kind,
  Mechanism,
  ResolvedInteraction,
  Severity,
} from '@fdi/schema'
import { nodeKey } from '@fdi/schema/domain'
import { SeverityBadge } from './SeverityBadge.tsx'

interface Props {
  row: ResolvedInteraction<Interaction>
  nodes: Record<string, GraphNode>
  mechanisms: Record<string, Mechanism>
  perspective: Kind
  onSelect?: (key: string) => void
  /** The Explore panel states these once per Severity group instead of on every row. */
  grouped?: { inherited: boolean }
  /** The Severity group heading above this row; its badge shows only when the row's own Severity differs. */
  groupSeverity?: Severity
  /** My meds puts the pharmacist sentence before the advice; Explore keeps it after. */
  cautionFirst?: boolean
  /** The Explore panel with many rows: show one line (name, Severity) and open to the rest. */
  collapsible?: boolean
  /** A lead sentence above already names the only counterpart, so the row leaves the name out. */
  hideName?: boolean
}

/** "Sources": a Citation list, one 44px link row each. Shared by Interactions and Helpful pairings. */
export function Sources({ citations }: { citations: Citation[] }) {
  return (
    <>
      <p className="mono-label">Sources</p>
      <ul className="irow__cites">
        {citations.map((c, k) => (
          <li key={k}>
            <a href={c.url} target="_blank" rel="noreferrer">
              <span className="irow__cite-title">
                {c.title}
                <span className="sr-only"> (opens in new tab)</span>
              </span>
              <span className="mono-label">{c.type}</span>
              <svg className="irow__ext" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p, i) => <p key={i}>{p.trim()}</p>)

export function InteractionRow({
  row,
  nodes,
  mechanisms,
  perspective,
  onSelect,
  grouped,
  groupSeverity,
  cautionFirst,
  collapsible,
  hideName,
}: Props) {
  const i = row.interaction
  // The Drug class or Food group this row is inherited from, on the viewed side.
  const inheritedFrom = row.inheritedFrom
    ? nodes[nodeKey(perspective, row.inheritedFrom)]
    : undefined
  const food = nodes[nodeKey('food', i.food)]
  const drug = nodes[nodeKey('drug', i.drug)]
  const counterpart =
    perspective === 'drug' ? [food] : perspective === 'food' ? [drug] : [food, drug]
  const link = (n: GraphNode | undefined) =>
    n && onSelect ? (
      <button className="link-button" onClick={() => onSelect(nodeKey(n.kind, n.id))}>
        {n.name}
      </button>
    ) : (
      n?.name
    )

  const caution = i.severity === 'avoid' && !grouped && (
    <p className="irow__caution">
      Serious interaction. Check with your pharmacist or doctor before combining.
    </p>
  )

  const names = counterpart.map((n, k) => (
    <span key={k}>
      {k > 0 && ' → '}
      {collapsible ? n?.name : link(n)}
    </span>
  ))
  const showBadge = !grouped && groupSeverity !== i.severity
  const head = (
    <>
      {showBadge && <SeverityBadge severity={i.severity} />}
      {!hideName && <span className="irow__name">{names}</span>}
    </>
  )

  const body = (
    <>
      {inheritedFrom && !grouped?.inherited && (
        <p className="mono-label">Applies to {inheritedFrom.name}</p>
      )}
      <p className="irow__summary">{i.summary}</p>
      {cautionFirst && caution}
      <p className="irow__advice">
        <strong>What to do:</strong> {i.advice}
      </p>
      {!cautionFirst && caution}
      <details className="irow__more">
        <summary>Details and sources</summary>
        <div className="irow__details">{paragraphs(i.details)}</div>
        <p className="mono-label">Mechanism</p>
        <ul className="irow__mechs">
          {i.mechanisms.map((m) => (
            <li key={m}>
              {onSelect ? (
                <button className="link-button" onClick={() => onSelect(nodeKey('mechanism', m))}>
                  {mechanisms[m]?.name ?? m}
                </button>
              ) : (
                (mechanisms[m]?.name ?? m)
              )}
              {mechanisms[m] && <span>: {mechanisms[m].explanation}</span>}
            </li>
          ))}
        </ul>
        {i.example && (
          <div className="chat" role="group" aria-label="Example conversation">
            <p className="mono-label">Example exchange</p>
            <p className="chat__bubble chat__bubble--patient">{i.example.patient}</p>
            <p className="chat__bubble chat__bubble--pharmacist">{i.example.pharmacist}</p>
          </div>
        )}
        <Sources citations={i.citations} />
        <p className="mono-label">Reviewed {i.reviewed_at}</p>
      </details>
    </>
  )

  if (!collapsible)
    return (
      <li className="irow">
        {(showBadge || !hideName) && <div className="irow__head">{head}</div>}
        {body}
      </li>
    )
  return (
    <li className="irow irow--collapsible">
      <details>
        <summary className="irow__head">{head}</summary>
        <p>
          {counterpart.map((n, k) => (
            <span key={k}>
              {k > 0 && ' → '}
              {link(n)}
            </span>
          ))}
        </p>
        {body}
      </details>
    </li>
  )
}
