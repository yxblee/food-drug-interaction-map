import type { Palette } from '../theme/tokens.ts'
import type { Inset, RenderGraph } from './renderGraph.ts'

export interface Focus {
  selected: string | null
  focus: Set<string> | null
}
export interface RendererOptions {
  motion: boolean
}
export interface GraphRenderer {
  mount(el: HTMLElement): void
  setData(g: RenderGraph): void
  setFocus(f: Focus): void
  setTheme(p: Palette): void
  /** Screen space the side panel covers; takes effect on the next fit. */
  setInset(inset: Inset): void
  /** Frame the focused (or all) nodes in the space the inset leaves. */
  fit(): void
  onSelect(cb: (key: string | null) => void): void
  destroy(): void
}
