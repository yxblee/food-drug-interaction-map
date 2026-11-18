import { describe, expect, it } from 'vite-plus/test'
import { droppedNotice, plural } from './plural.ts'

describe('plural', () => {
  it('uses the singular only for exactly one', () => {
    expect(plural(1, 'food', 'foods')).toBe('1 food')
    expect(plural(0, 'food', 'foods')).toBe('0 foods')
    expect(plural(2, 'food', 'foods')).toBe('2 foods')
  })
})

describe('droppedNotice', () => {
  it('agrees the noun and the verb with the count', () => {
    expect(droppedNotice(1)).toBe('Removed 1 medication that is no longer in our dataset.')
    expect(droppedNotice(3)).toBe('Removed 3 medications that are no longer in our dataset.')
  })
})
