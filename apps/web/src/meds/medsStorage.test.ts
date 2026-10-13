import { describe, expect, it } from 'vite-plus/test'
import {
  MEDS_KEY,
  NOT_CHECKED_KEY,
  loadMeds,
  loadNotChecked,
  saveMeds,
  saveNotChecked,
} from './medsStorage.ts'

function fake(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  }
}
const known = (id: string) => ['warfarin', 'simvastatin'].includes(id)

describe('medsStorage', () => {
  it('loads known ids, drops unknown ones and dedupes', () => {
    const s = fake({ [MEDS_KEY]: JSON.stringify(['warfarin', 'gone', 'warfarin', 'simvastatin']) })
    expect(loadMeds(s, known)).toEqual({ ids: ['warfarin', 'simvastatin'], dropped: ['gone'] })
  })
  it('survives missing, corrupt and wrongly-shaped data', () => {
    expect(loadMeds(fake(), known)).toEqual({ ids: [], dropped: [] })
    expect(loadMeds(fake({ [MEDS_KEY]: '{not json' }), known)).toEqual({ ids: [], dropped: [] })
    expect(loadMeds(fake({ [MEDS_KEY]: '{"a":1}' }), known)).toEqual({ ids: [], dropped: [] })
    expect(loadMeds(fake({ [MEDS_KEY]: '[1, null, "warfarin"]' }), known)).toEqual({
      ids: ['warfarin'],
      dropped: [],
    })
  })
  it('saves a list and removes the key when empty', () => {
    const s = fake()
    saveMeds(s, ['warfarin'])
    expect(s.m.get(MEDS_KEY)).toBe('["warfarin"]')
    saveMeds(s, [])
    expect(s.m.has(MEDS_KEY)).toBe(false)
  })
  it('keeps not-checked names under their own key, leaving the id list untouched', () => {
    const s = fake()
    saveMeds(s, ['warfarin'])
    saveNotChecked(s, ['Eliquis'])
    expect(s.m.get(MEDS_KEY)).toBe('["warfarin"]')
    expect(s.m.get(NOT_CHECKED_KEY)).toBe('["Eliquis"]')
    expect(loadNotChecked(s)).toEqual(['Eliquis'])
    saveNotChecked(s, [])
    expect(s.m.has(NOT_CHECKED_KEY)).toBe(false)
  })
  it('survives missing, corrupt and wrongly-shaped not-checked data', () => {
    expect(loadNotChecked(fake())).toEqual([])
    expect(loadNotChecked(fake({ [NOT_CHECKED_KEY]: '{not json' }))).toEqual([])
    expect(loadNotChecked(fake({ [NOT_CHECKED_KEY]: '{"a":1}' }))).toEqual([])
    expect(loadNotChecked(fake({ [NOT_CHECKED_KEY]: '[1, " Eliquis ", "", "Eliquis"]' }))).toEqual([
      'Eliquis',
    ])
  })
})
