import type { GraphNode, Interaction, Kind, Mechanism, ResolvedInteraction } from '@fdi/schema'
import { nodeKey } from '@fdi/schema/domain'
import { SeverityBadge } from './SeverityBadge.tsx'

interface Props {
  row: ResolvedInteraction<Interaction>
  nodes: Record<string, GraphNode>
  mechanisms: Record<string, Mechanism>
  perspective: Kind
  onSelect?: (key: string) => void
}

const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p, i) => <p key={i}>{p.trim()}</p>)

export function InteractionRow({ row, nodes, mechanisms, perspective, onSelect }: Props) {
  const i = row.interaction
  // The Drug class or Food group this row is inherited from, on the viewed side.
  const inheritedFrom = row.inheritedFrom ? nodes[nodeKey(perspective, row.inheritedFrom)] : undefined
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

  return (
    <li className="irow">
      <div className="irow__head">
        <SeverityBadge severity={i.severity} />
        <span className="irow__name">
          {counterpart.map((n, k) => (
            <span key={k}>
              {k > 0 && ' → '}
              {link(n)}
            </span>
          ))}
        </span>
      </div>
      {inheritedFrom && <p className="mono-label">Applies to {inheritedFrom.name}</p>}
      <p className="irow__summary">{i.summary}</p>
      <p className="irow__advice">
        <strong>What to do:</strong> {i.advice}
      </p>
      {i.severity === 'avoid' && (
        <p className="irow__caution">
          Serious interaction. Check with your pharmacist or doctor before combining.
        </p>
      )}
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
        <p className="mono-label">Sources</p>
        <ul className="irow__cites">
          {i.citations.map((c, k) => (
            <li key={k}>
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.title}
              </a>{' '}
              <span className="mono-label">{c.type}</span>
            </li>
          ))}
        </ul>
        <p className="mono-label">Reviewed {i.reviewed_at}</p>
      </details>
    </li>
  )
}
