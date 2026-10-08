import { describe, expect, it } from 'vite-plus/test'
import { MEDS_KEY, loadMeds, saveMeds } from './medsStorage.ts'

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
    expect(loadMeds(fake({ [MEDS_KEY]: '[1, null, "warfarin"]' }), known)).toEqual({ ids: ['warfarin'], dropped: [] })
  })
  it('saves a list and removes the key when empty', () => {
    const s = fake()
    saveMeds(s, ['warfarin'])
    expect(s.m.get(MEDS_KEY)).toBe('["warfarin"]')
    saveMeds(s, [])
    expect(s.m.has(MEDS_KEY)).toBe(false)
  })
})
