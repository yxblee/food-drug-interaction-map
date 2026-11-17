import type { Focus } from './types.ts'

/** On-screen label height; the issue asks for at least 11px. */
export const MIN_LABEL_PX = 12

/** Same rule as the 2D view: groups at rest, plus the focus set, hovered and keyboard-active node. */
export function labelShown(
  key: string,
  group: boolean,
  focus: Focus,
  hovered: string | null,
  active: string | null,
): boolean {
  return group || key === hovered || key === active || !!focus.focus?.has(key)
}

/** World-space height that renders `px` tall at `distance` from a camera with vertical `fovDeg`. */
export function labelHeight(px: number, distance: number, fovDeg: number, viewportH: number) {
  return (px * 2 * distance * Math.tan((fovDeg * Math.PI) / 360)) / viewportH
}
