import { describe, expect, it } from 'vite-plus/test'
import { labelHeight, labelShown, MIN_LABEL_PX } from './labels3d.ts'

const none = { selected: null, focus: null }

describe('labelShown', () => {
  it('at rest only group nodes are labelled, like the 2D view', () => {
    expect(labelShown('a', true, none, null, null)).toBe(true)
    expect(labelShown('b', false, none, null, null)).toBe(false)
  })
  it('shows the hovered and keyboard-active node', () => {
    expect(labelShown('b', false, none, 'b', null)).toBe(true)
    expect(labelShown('b', false, none, null, 'b')).toBe(true)
  })
  it('shows the focus set (selection and neighbours) and hides the rest', () => {
    const f = { selected: 'a', focus: new Set(['a', 'b']) }
    expect(labelShown('b', false, f, null, null)).toBe(true)
    expect(labelShown('c', false, f, null, null)).toBe(false)
    expect(labelShown('c', true, f, null, null)).toBe(true)
  })
})

describe('labelHeight', () => {
  it('is the world height that renders at the requested pixel height', () => {
    // fov 90deg: visible height at distance d is 2d; 800px viewport -> 1px = 2d/800
    expect(labelHeight(12, 100, 90, 800)).toBeCloseTo((12 * 200) / 800)
  })
  it('keeps the default at least 11px', () => {
    expect(MIN_LABEL_PX).toBeGreaterThanOrEqual(11)
  })
})
