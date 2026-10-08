import type { GraphNode } from '@fdi/schema'
import { nodeKey, searchNodes } from '@fdi/schema/domain'

// Order Prev/Next steps through: current search results, else every node A-Z.
export function browseKeys(nodes: GraphNode[], q: string): string[] {
  if (q.trim()) return searchNodes(nodes, q, Infinity).map((r) => nodeKey(r.kind, r.id))
  return [...nodes].sort((a, b) => a.name.localeCompare(b.name)).map((n) => nodeKey(n.kind, n.id))
}

export function stepKey(keys: string[], current: string, dir: 1 | -1): string | null {
  if (!keys.length) return null
  const at = keys.indexOf(current)
  if (at < 0) return keys[dir === 1 ? 0 : keys.length - 1]
  return keys[(at + dir + keys.length) % keys.length]
}
