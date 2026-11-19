import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'
import { PALETTES } from './tokens.ts'

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
const darkBlock =
  /@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}/.exec(css)?.[1] ?? ''
const decl = (block: string, name: string) =>
  new RegExp(`--${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim()

describe('first-paint CSS defaults', () => {
  it('dark defaults equal the untinted dark palette in tokens.ts', () => {
    const d = PALETTES.grey.dark
    expect(decl(darkBlock, 'paper')).toBe(d.paper)
    expect(decl(darkBlock, 'ink')).toBe(d.ink)
    expect(decl(darkBlock, 'muted')).toBe(d.muted)
    expect(decl(darkBlock, 'line')).toBe(d.line)
    expect(decl(darkBlock, 'badge-bg')).toBe(d.badgeBg)
    expect(decl(darkBlock, 'surface')).toBe(d.surface)
  })
  it('light defaults equal the untinted light palette in tokens.ts', () => {
    const root = /^:root \{([^}]*)\}/.exec(css)?.[1] ?? ''
    const l = PALETTES.grey.light
    expect(decl(root, 'paper')).toBe(l.paper)
    expect(decl(root, 'ink')).toBe(l.ink)
    expect(decl(root, 'muted')).toBe(l.muted)
    expect(decl(root, 'line')).toBe(l.line)
    expect(decl(root, 'badge-bg')).toBe(l.badgeBg)
    expect(decl(root, 'surface')).toBe(l.surface)
  })
})
