import type { Palette } from '../theme/tokens.ts'
import type { RenderGraph } from './renderGraph.ts'

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
  onSelect(cb: (key: string | null) => void): void
  destroy(): void
}
