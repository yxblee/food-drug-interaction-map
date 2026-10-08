import { describe, expect, it } from 'vite-plus/test'
import { SEVERITIES } from '@fdi/schema'
import {
  PALETTES,
  SEVERITY_COLORS,
  contrastRatio,
  tintFor,
  type Mode,
  type TintName,
} from './tokens.ts'

const TINTS = Object.keys(PALETTES) as TintName[]
const MODES: Mode[] = ['light', 'dark']

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
  })
})

describe('palettes', () => {
  for (const tint of TINTS) {
    for (const mode of MODES) {
      const p = PALETTES[tint][mode]
      for (const sev of SEVERITIES) {
        it(`${tint}/${mode}: ${sev} badge text is AA (4.5:1)`, () => {
          expect(contrastRatio(SEVERITY_COLORS[sev], p.badgeBg)).toBeGreaterThanOrEqual(4.5)
        })
      }
      it(`${tint}/${mode}: ink on paper is AA`, () => {
        expect(contrastRatio(p.ink, p.paper)).toBeGreaterThanOrEqual(4.5)
      })
      it(`${tint}/${mode}: muted labels on paper are at least 3:1`, () => {
        expect(contrastRatio(p.muted, p.paper)).toBeGreaterThanOrEqual(3)
      })
    }
  }
})

describe('tintFor', () => {
  it('maps context to a hue only when tinted', () => {
    expect(tintFor(false, 'drug')).toBe('grey')
    expect(tintFor(true, null)).toBe('sand')
    expect(tintFor(true, 'drug')).toBe('slate')
    expect(tintFor(true, 'food')).toBe('sage')
    expect(tintFor(true, 'mechanism')).toBe('plum')
  })
})
