export const matchCountLabel = (n: number) => `${n} ${n === 1 ? 'match' : 'matches'}`

/** True for a bare "/" pressed outside any text-entry element. */
export function isSlashFocus(e: KeyboardEvent): boolean {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return false
  const t = e.target as HTMLElement | null
  return !(t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)))
}
