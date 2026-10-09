import type { Kind, Severity } from '@fdi/schema'

export type TintName = 'grey' | 'sand' | 'slate' | 'sage' | 'plum'
export type Mode = 'light' | 'dark'
export interface Palette {
  paper: string
  ink: string
  muted: string
  line: string
  badgeBg: string
  /** Raised surface (inputs, popovers, banners) that ink text sits on. */
  surface: string
}

const p = (paper: string, ink: string, muted: string, line: string, badgeBg: string, surface: string): Palette => ({
  paper,
  ink,
  muted,
  line,
  badgeBg,
  surface,
})

export const PALETTES: Record<TintName, Record<Mode, Palette>> = {
  grey: {
    light: p('#e8e6e1', '#1c1b19', '#67645e', '#b9b5ad', '#f8f7f4', '#f8f7f4'),
    dark: p('#1b1a18', '#ecebe7', '#a29e96', '#3d3b37', '#f1efea', '#25241f'),
  },
  sand: {
    light: p('#ecd9a0', '#2a2108', '#6b5a2a', '#b8a26a', '#fbf6e7', '#fbf6e7'),
    dark: p('#2a2414', '#f1e6c4', '#b9a678', '#4d4326', '#f6efd9', '#342d1a'),
  },
  slate: {
    light: p('#c5d0dc', '#141c26', '#495768', '#93a1b2', '#f4f7fa', '#f4f7fa'),
    dark: p('#141b24', '#dfe7f0', '#9aa9ba', '#2d3a49', '#eef3f8', '#1d2631'),
  },
  sage: {
    light: p('#bcd4a9', '#16240f', '#435a36', '#8fa97e', '#f3f8ef', '#f3f8ef'),
    dark: p('#142010', '#e0eed5', '#9cb68c', '#2c3d24', '#eef6e8', '#1c2b17'),
  },
  plum: {
    light: p('#d8c4d4', '#261624', '#654a62', '#a98ea5', '#faf4f9', '#faf4f9'),
    dark: p('#22141f', '#f0e1ec', '#b99bb3', '#43293e', '#f8eef5', '#301d2c'),
  },
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  avoid: '#7a2a1c',
  caution: '#6e4f00',
  monitor: '#3d3d3d',
  minimal: '#5c5c5c',
}

export function tintFor(tinted: boolean, kind: Kind | null): TintName {
  if (!tinted) return 'grey'
  if (kind === 'drug') return 'slate'
  if (kind === 'food') return 'sage'
  if (kind === 'mechanism') return 'plum'
  return 'sand'
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
