import type { GraphInteraction, GraphNode, Pairing, Severity } from '@fdi/schema'
import {
  SEVERITY_RANK,
  interactionsForDrug,
  nodeKey,
  pairingsForDrug,
  type Index,
} from '@fdi/schema/domain'

export interface FoodWarning {
  food: GraphNode
  severity: Severity
  affected: { drug: GraphNode; interaction: GraphInteraction; inheritedFrom?: string }[]
}

const rank = (s: Severity) => SEVERITY_RANK[s]

/** True when the warning's lead sentence names a single Drug, so its rows need not name it again. */
export const namesOnlyDrug = (w: FoodWarning) =>
  new Set(w.affected.map((h) => h.drug.id)).size === 1

export function checkMeds(ix: Index, drugIds: string[]): FoodWarning[] {
  const byFood = new Map<string, FoodWarning>()
  for (const drugId of drugIds) {
    const drug = ix.nodes.get(nodeKey('drug', drugId))
    if (!drug) continue
    for (const { interaction, inheritedFrom } of interactionsForDrug(ix, drugId)) {
      const food = ix.nodes.get(nodeKey('food', interaction.food))
      if (!food) continue
      let w = byFood.get(food.id)
      if (!w) {
        w = { food, severity: interaction.severity, affected: [] }
        byFood.set(food.id, w)
      }
      w.affected.push({ drug, interaction, inheritedFrom })
      if (rank(interaction.severity) < rank(w.severity)) w.severity = interaction.severity
    }
  }
  const out = [...byFood.values()]
  for (const w of out) {
    w.affected.sort(
      (a, b) =>
        rank(a.interaction.severity) - rank(b.interaction.severity) ||
        a.drug.name.localeCompare(b.drug.name),
    )
  }
  return out.sort(bySeverityThenFood)
}

/** Listed Medications that none of their Food warnings name, in list order. */
export function medsWithNoFoods(ix: Index, drugIds: string[], warnings: FoodWarning[]) {
  const warned = new Set(warnings.flatMap((w) => w.affected.map((h) => h.drug.id)))
  return drugIds.flatMap((id) => {
    const drug = ix.nodes.get(nodeKey('drug', id))
    return drug && !warned.has(id) ? [drug] : []
  })
}

export function mapKeysFor(ix: Index, warnings: FoodWarning[], drugIds: string[]): Set<string> {
  const keys = new Set(drugIds.map((id) => nodeKey('drug', id)))
  for (const id of drugIds) {
    const parent = ix.nodes.get(nodeKey('drug', id))?.parent
    if (parent) keys.add(nodeKey('drug', parent))
  }
  for (const w of warnings) {
    keys.add(nodeKey('food', w.food.id))
    for (const { interaction } of w.affected) {
      keys.add(nodeKey('drug', interaction.drug))
      for (const m of interaction.mechanisms) keys.add(nodeKey('mechanism', m))
    }
  }
  return keys
}

const bySeverityThenFood = (a: FoodWarning, b: FoodWarning) =>
  rank(a.severity) - rank(b.severity) || a.food.name.localeCompare(b.food.name)

/**
 * "Can I have this Food?" against a Medication list: the Food warnings for the Food itself,
 * for its Food group, and (when it is a Food group) for its members. A Direct interaction
 * takes the place of the Food group's one for the same Drug.
 */
export function checkFood(ix: Index, foodId: string, drugIds: string[]): FoodWarning[] {
  const food = ix.nodes.get(nodeKey('food', foodId))
  if (!food) return []
  const all = checkMeds(ix, drugIds)
  const direct = new Set(
    all.find((w) => w.food.id === foodId)?.affected.map((h) => h.drug.id) ?? [],
  )
  const out: FoodWarning[] = []
  for (const w of all) {
    if (w.food.id === foodId || w.food.parent === foodId) out.push(w)
    else if (w.food.id === food.parent) {
      const affected = w.affected.filter((h) => !direct.has(h.drug.id))
      // affected is sorted worst first, so the first one carries the warning's Severity.
      if (affected.length) out.push({ ...w, affected, severity: affected[0].interaction.severity })
    }
  }
  return out.sort(bySeverityThenFood)
}

export interface DrugPairings {
  drug: GraphNode
  pairings: { food: GraphNode; pairing: Pairing; inheritedFrom?: string }[]
}

/**
 * "Helps to take with" for a Medication list: per listed Drug that has any, the Foods (or Food
 * groups) a Helpful pairing names, with Drug class pairings inherited by their members.
 */
export function pairingsFor(ix: Index, drugIds: string[]): DrugPairings[] {
  const out: DrugPairings[] = []
  for (const id of drugIds) {
    const drug = ix.nodes.get(nodeKey('drug', id))
    if (!drug) continue
    const pairings = pairingsForDrug(ix, id).flatMap(({ pairing, inheritedFrom }) => {
      const food = ix.nodes.get(nodeKey('food', pairing.food))
      return food ? [{ food, pairing, inheritedFrom }] : []
    })
    if (pairings.length) out.push({ drug, pairings })
  }
  return out
}

/** The listed Drugs a Food helps (itself or through its Food group), minus `except` Drug ids. */
export function helpedBy(helps: DrugPairings[], food: GraphNode, except: Set<string>): GraphNode[] {
  return helps
    .filter(
      (h) =>
        !except.has(h.drug.id) &&
        h.pairings.some((p) => p.food.id === food.id || p.food.id === food.parent),
    )
    .map((h) => h.drug)
}
