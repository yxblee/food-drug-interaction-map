export interface NavPoint {
  key: string
  label: string
  x: number
  y: number
}
export type NavDir = 'left' | 'right' | 'up' | 'down'

/** Nearest point in a screen direction, within a 90 degree cone; sideways drift costs double. */
export function nearestInDirection(from: NavPoint, pts: NavPoint[], dir: NavDir): NavPoint | null {
  const horizontal = dir === 'left' || dir === 'right'
  const sign = dir === 'right' || dir === 'down' ? 1 : -1
  let best: NavPoint | null = null
  let bestScore = Infinity
  for (const p of pts) {
    if (p.key === from.key) continue
    const along = (horizontal ? p.x - from.x : p.y - from.y) * sign
    const across = Math.abs(horizontal ? p.y - from.y : p.x - from.x)
    if (along <= 0 || across > along) continue
    const score = along + 2 * across
    if (score < bestScore) {
      best = p
      bestScore = score
    }
  }
  return best
}

/** The key one step along browse order from `key`, wrapping at the ends. */
export function stepInOrder(pts: NavPoint[], key: string | null, step: 1 | -1): NavPoint | null {
  if (!pts.length) return null
  const i = pts.findIndex((p) => p.key === key)
  return pts[i < 0 ? (step === 1 ? 0 : pts.length - 1) : (i + step + pts.length) % pts.length]!
}
