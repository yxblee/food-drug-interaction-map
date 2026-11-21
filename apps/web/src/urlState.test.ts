import { describe, expect, it } from 'vite-plus/test'
import { DEFAULT_STATE, decode, decodeWithStoredTint, encode } from './urlState.ts'

describe('urlState', () => {
  it('decodes an empty query to defaults', () => {
    expect(decode('')).toEqual(DEFAULT_STATE)
    expect(DEFAULT_STATE).toEqual({
      tab: 'explore',
      q: '',
      node: null,
      view: null,
      mech: true,
      sev: ['avoid', 'caution', 'monitor', 'minimal'],
      tint: false,
      meds: false,
    })
  })
  it('round-trips every field', () => {
    const s = {
      tab: 'meds',
      q: 'grape fruit',
      node: 'food:grapefruit',
      view: '2d',
      mech: false,
      sev: ['avoid', 'monitor'],
      tint: true,
      meds: true,
    } as const
    expect(decode('?' + encode(s))).toEqual(s)
  })
  it('carries the meds filter as a bare flag, never drug names', () => {
    expect(encode({ ...DEFAULT_STATE, meds: true })).toBe('meds=1')
    expect(decode('?meds=1').meds).toBe(true)
    expect(decode('?meds=warfarin').meds).toBe(false)
    expect(decode('').meds).toBe(false)
  })
  it('omits defaults when encoding', () => {
    expect(encode(DEFAULT_STATE)).toBe('')
    expect(encode({ ...DEFAULT_STATE, node: 'drug:warfarin' })).toBe('node=drug%3Awarfarin')
  })
  it('falls back to defaults for invalid params', () => {
    expect(decode('?tab=foo&node=drug:Bad%20Id&view=4d&mech=yes&tint=2')).toEqual(DEFAULT_STATE)
    expect(decode('?node=plant:kale').node).toBeNull()
  })
  it('restores the remembered Color mode only when the URL is silent about it', () => {
    expect(decodeWithStoredTint('', '1').tint).toBe(true)
    expect(decodeWithStoredTint('?tint=1', '0').tint).toBe(true)
    expect(decodeWithStoredTint('?tint=0', '1').tint).toBe(false)
    expect(decodeWithStoredTint('', null).tint).toBe(false)
  })
  it('writes the Severity filter only when it is not all four, in a fixed order', () => {
    expect(encode({ ...DEFAULT_STATE, sev: ['avoid'] })).toBe('sev=avoid')
    expect(encode({ ...DEFAULT_STATE, sev: ['minimal', 'avoid'] })).toBe('sev=avoid%2Cminimal')
    expect(decode('?sev=avoid,caution').sev).toEqual(['avoid', 'caution'])
  })
  it('ignores a Severity filter that names nothing valid', () => {
    expect(decode('?sev=').sev).toEqual(DEFAULT_STATE.sev)
    expect(decode('?sev=urgent').sev).toEqual(DEFAULT_STATE.sev)
    expect(decode('?sev=urgent,avoid,avoid').sev).toEqual(['avoid'])
  })
})
