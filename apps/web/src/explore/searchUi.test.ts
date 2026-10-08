import { describe, expect, it } from 'vite-plus/test'
import { isSlashFocus, matchCountLabel } from './searchUi.ts'

describe('matchCountLabel', () => {
  it('announces the count with correct plurals', () => {
    expect(matchCountLabel(0)).toBe('0 matches')
    expect(matchCountLabel(1)).toBe('1 match')
    expect(matchCountLabel(12)).toBe('12 matches')
  })
})

describe('isSlashFocus', () => {
  const key = (k: string, tag = 'DIV', mods = {}) =>
    ({ key: k, target: { tagName: tag, isContentEditable: false }, ...mods }) as never
  it('fires on "/" outside text fields only', () => {
    expect(isSlashFocus(key('/'))).toBe(true)
    expect(isSlashFocus(key('/', 'INPUT'))).toBe(false)
    expect(isSlashFocus(key('/', 'TEXTAREA'))).toBe(false)
    expect(isSlashFocus(key('a'))).toBe(false)
    expect(isSlashFocus(key('/', 'DIV', { ctrlKey: true }))).toBe(false)
  })
})
