import type { GraphInteraction, GraphNode, Kind } from '@fdi/schema'
import { buildIndex, interactionsForDrug, interactionsForFood } from '@fdi/schema/domain'
import { browseKeys } from './browse.ts'
import { plural } from '../plural.ts'

export const matchCountLabel = (n: number) => `${n} ${n === 1 ? 'match' : 'matches'}`

/** True for a bare "/" pressed outside any text-entry element. */
export function isSlashFocus(e: KeyboardEvent): boolean {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return false
  const t = e.target as HTMLElement | null
  return !(t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)))
}

/** The "/" shortcut hint is noise on touch devices, which have no keyboard to press it on. */
export const searchPlaceholder = (finePointer: boolean) =>
  `Search drugs, foods, mechanisms${finePointer ? '  ( / )' : ''}`

export interface BrowseRow {
  kind: Kind
  id: string
  name: string
  /** Interactions the panel would list for this node, inherited ones included. */
  count: number
}

/** Empty-query list: every Drug, then every Food, A-Z (the order Prev/Next walks). */
export function browseGroups(nodes: GraphNode[], interactions: GraphInteraction[]) {
  const ix = buildIndex(nodes, interactions)
  const byKey = new Map(nodes.map((n) => [`${n.kind}:${n.id}`, n]))
  const rows = (kind: 'drug' | 'food'): BrowseRow[] =>
    browseKeys(nodes, '')
      .map((k) => byKey.get(k)!)
      .filter((n) => n.kind === kind)
      .map((n) => ({
        kind,
        id: n.id,
        name: n.name,
        count: (kind === 'drug' ? interactionsForDrug : interactionsForFood)(ix, n.id).length,
      }))
  return { drugs: rows('drug'), foods: rows('food') }
}

export const browseLabel = (drugs: number, foods: number) =>
  `${plural(drugs, 'Drug', 'Drugs')}, ${plural(foods, 'Food', 'Foods')}`
