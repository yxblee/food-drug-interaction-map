import { describe, expect, it } from 'vite-plus/test'
import { chooseView } from './chooseView.ts'

const desktop = { mobile: false, webgl: true, reducedMotion: false }

describe('chooseView', () => {
  it('defaults to 3D with a toggle on desktop', () => {
    expect(chooseView(desktop, null)).toEqual({ view: '3d', canToggle: true })
    expect(chooseView(desktop, '2d')).toEqual({ view: '2d', canToggle: true })
  })
  it('forces 2D with no toggle on mobile, ignoring ?view=3d', () => {
    expect(chooseView({ ...desktop, mobile: true }, '3d')).toEqual({ view: '2d', canToggle: false })
  })
  it('forces 2D with no toggle without WebGL', () => {
    expect(chooseView({ ...desktop, webgl: false }, '3d')).toEqual({ view: '2d', canToggle: false })
  })
  it('defaults to 2D under reduced motion but still allows 3D', () => {
    expect(chooseView({ ...desktop, reducedMotion: true }, null)).toEqual({ view: '2d', canToggle: true })
    expect(chooseView({ ...desktop, reducedMotion: true }, '3d')).toEqual({ view: '3d', canToggle: true })
  })
})
