import { describe, expect, it } from 'vite-plus/test'
import { nearestInDirection, stepInOrder, type NavPoint } from './nav.ts'

const p = (key: string, x: number, y: number): NavPoint => ({ key, label: key, x, y })
const a = p('a', 0, 0)
const pts = [a, p('right', 50, 5), p('farRight', 200, 0), p('down', 3, 80), p('diag', 60, 60)]

describe('nearestInDirection', () => {
  it('picks the nearest point in the direction', () => {
    expect(nearestInDirection(a, pts, 'right')?.key).toBe('right')
    expect(nearestInDirection(a, pts, 'down')?.key).toBe('down')
  })
  it('returns null when nothing lies that way', () => {
    expect(nearestInDirection(a, pts, 'left')).toBeNull()
    expect(nearestInDirection(a, pts, 'up')).toBeNull()
  })
  it('ignores points outside the 90 degree cone', () => {
    expect(nearestInDirection(a, [a, p('steep', 10, 80)], 'right')).toBeNull()
  })
})

describe('stepInOrder', () => {
  it('wraps and starts at the ends when nothing is active', () => {
    expect(stepInOrder(pts, 'a', -1)?.key).toBe('diag')
    expect(stepInOrder(pts, 'diag', 1)?.key).toBe('a')
    expect(stepInOrder(pts, null, 1)?.key).toBe('a')
    expect(stepInOrder([], null, 1)).toBeNull()
  })
})
