import { describe, expect, it } from 'vite-plus/test'
import { decodeShare, encodeShare, mergeShared } from './shareLink.ts'

const known = (id: string) => ['warfarin', 'simvastatin', 'amlodipine'].includes(id)

describe('encodeShare', () => {
  it('puts catalogue ids in list order in a #meds= fragment', () => {
    expect(encodeShare(['simvastatin', 'warfarin'], []).fragment).toBe('#meds=simvastatin,warfarin')
  })
  it('leaves free-text items out and counts them', () => {
    const r = encodeShare(['warfarin'], ['Mystery pill', 'Herbal tea'])
    expect(r.fragment).toBe('#meds=warfarin')
    expect(r.leftOut).toBe(2)
  })
})

describe('decodeShare', () => {
  it('round-trips ids in order', () => {
    const { fragment } = encodeShare(['simvastatin', 'warfarin', 'amlodipine'], [])
    expect(decodeShare(fragment, known)).toEqual({
      ids: ['simvastatin', 'warfarin', 'amlodipine'],
      unknown: 0,
    })
  })
  it('drops unknown ids and duplicates, counting unknown', () => {
    expect(decodeShare('#meds=warfarin,nope,warfarin,simvastatin,also-nope', known)).toEqual({
      ids: ['warfarin', 'simvastatin'],
      unknown: 2,
    })
  })
  it('returns null when there is no meds fragment', () => {
    expect(decodeShare('', known)).toBeNull()
    expect(decodeShare('#other=1', known)).toBeNull()
  })
  it('treats an empty list as nothing to add', () => {
    expect(decodeShare('#meds=', known)).toBeNull()
  })
})

describe('mergeShared', () => {
  it('keeps existing order and appends new ids only', () => {
    expect(mergeShared(['warfarin', 'amlodipine'], ['simvastatin', 'warfarin'])).toEqual([
      'warfarin',
      'amlodipine',
      'simvastatin',
    ])
  })
})
