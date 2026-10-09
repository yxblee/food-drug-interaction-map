import {
  interactionsForDrug,
  interactionsForFood,
  interactionsForMechanism,
  nodeKey,
  splitKey,
  type Index,
} from '@fdi/schema/domain'

// Plain-text lines for the selected item's interactions, read out instead of the aria-hidden 3D canvas.
export function srRows(ix: Index, selected: string | null): string[] {
  if (!selected) return []
  const [kind, id] = splitKey(selected)
  const rows =
    kind === 'drug'
      ? interactionsForDrug(ix, id)
      : kind === 'food'
        ? interactionsForFood(ix, id)
        : interactionsForMechanism(ix, id)
  return rows.map(({ interaction: i }) => {
    const food = ix.nodes.get(nodeKey('food', i.food))?.name
    const drug = ix.nodes.get(nodeKey('drug', i.drug))?.name
    return `${food} with ${drug}: ${i.severity}. ${i.summary}`
  })
}
