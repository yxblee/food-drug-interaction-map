import { useEffect, useState } from 'react'
import type { Kind } from '@fdi/schema'
import { PALETTES, SEVERITY_COLORS, tintFor, type Mode, type Palette } from './tokens.ts'

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function useTheme(tinted: boolean, kind: Kind | null): Palette {
  const [mode, setMode] = useState<Mode>(() => (darkQuery().matches ? 'dark' : 'light'))
  useEffect(() => {
    const mq = darkQuery()
    const onChange = () => setMode(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const palette = PALETTES[tintFor(tinted, kind)][mode]
  useEffect(() => {
    const s = document.documentElement.style
    s.setProperty('--paper', palette.paper)
    s.setProperty('--ink', palette.ink)
    s.setProperty('--muted', palette.muted)
    s.setProperty('--line', palette.line)
    s.setProperty('--badge-bg', palette.badgeBg)
    for (const [sev, color] of Object.entries(SEVERITY_COLORS)) s.setProperty(`--sev-${sev}`, color)
  }, [palette])
  return palette
}
