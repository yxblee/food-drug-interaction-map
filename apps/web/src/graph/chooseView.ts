export interface Env {
  mobile: boolean
  webgl: boolean
  reducedMotion: boolean
}

export function chooseView(
  env: Env,
  requested: '3d' | '2d' | null,
): { view: '3d' | '2d'; canToggle: boolean } {
  if (env.mobile || !env.webgl) return { view: '2d', canToggle: false }
  return { view: requested ?? (env.reducedMotion ? '2d' : '3d'), canToggle: true }
}
