import type { GraphInteraction, GraphNode, Severity } from '@fdi/schema'
import { SEVERITY_RANK, interactionsForDrug, nodeKey, type Index } from '@fdi/schema/domain'

export interface FoodWarning {
  food: GraphNode
  severity: Severity
  hits: { drug: GraphNode; interaction: GraphInteraction; via?: string }[]
}

const rank = (s: Severity) => SEVERITY_RANK[s]

export function checkMeds(ix: Index, drugIds: string[]): FoodWarning[] {
  const byFood = new Map<string, FoodWarning>()
  for (const drugId of drugIds) {
    const drug = ix.nodes.get(nodeKey('drug', drugId))
    if (!drug) continue
    for (const { interaction, via } of interactionsForDrug(ix, drugId)) {
      const food = ix.nodes.get(nodeKey('food', interaction.food))
      if (!food) continue
      let w = byFood.get(food.id)
      if (!w) {
        w = { food, severity: interaction.severity, hits: [] }
        byFood.set(food.id, w)
      }
      w.hits.push({ drug, interaction, via })
      if (rank(interaction.severity) < rank(w.severity)) w.severity = interaction.severity
    }
  }
  const out = [...byFood.values()]
  for (const w of out) {
    w.hits.sort((a, b) => rank(a.interaction.severity) - rank(b.interaction.severity) || a.drug.name.localeCompare(b.drug.name))
  }
  return out.sort((a, b) => rank(a.severity) - rank(b.severity) || a.food.name.localeCompare(b.food.name))
}

export function mapKeysFor(warnings: FoodWarning[], drugIds: string[]): Set<string> {
  const keys = new Set(drugIds.map((id) => nodeKey('drug', id)))
  for (const w of warnings) {
    keys.add(nodeKey('food', w.food.id))
    for (const { interaction } of w.hits) {
      keys.add(nodeKey('drug', interaction.drug))
      for (const m of interaction.mechanisms) keys.add(nodeKey('mechanism', m))
    }
  }
  return keys
}
