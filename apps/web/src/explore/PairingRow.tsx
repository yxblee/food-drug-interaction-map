import type { GraphNode, Kind, Pairing } from '@fdi/schema'
import { nodeKey } from '@fdi/schema/domain'
import { Sources } from './InteractionRow.tsx'

interface Props {
  pairing: Pairing
  nodes: Record<string, GraphNode>
  /** The side being viewed; the row names the other one. */
  perspective: Extract<Kind, 'drug' | 'food'>
  /** The Drug class or Food group this pairing is inherited from. */
  inheritedFrom?: string
  onSelect?: (key: string) => void
}

/** One Helpful pairing. Plain ink and rule only: no Severity colour or badge, it is not a warning. */
export function PairingRow({ pairing: p, nodes, perspective, inheritedFrom, onSelect }: Props) {
  const other =
    perspective === 'drug' ? nodes[nodeKey('food', p.food)] : nodes[nodeKey('drug', p.drug)]
  const owner = inheritedFrom ? nodes[nodeKey(perspective, inheritedFrom)] : undefined
  return (
    <li className="irow irow--pairing">
      <div className="irow__head">
        <span className="irow__name">
          {other && onSelect ? (
            <button className="link-button" onClick={() => onSelect(nodeKey(other.kind, other.id))}>
              {other.name}
            </button>
          ) : (
            other?.name
          )}
        </span>
      </div>
      {owner && <p className="mono-label">Applies to {owner.name}</p>}
      <p className="irow__summary">{p.summary}</p>
      <p className="irow__advice">
        <strong>What the source says:</strong> {p.advice}
      </p>
      <details className="irow__more">
        <summary>Sources</summary>
        <Sources citations={p.citations} />
        <p className="mono-label">Reviewed {p.reviewed_at}</p>
      </details>
    </li>
  )
}

/** Said once above Helpful pairings wherever they list. */
export const PAIRING_MEANING =
  'Reported by the Sources. Not a warning. Ask your pharmacist or doctor about your own medicines.'
