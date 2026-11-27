export interface Env {
  mobile: boolean
  webgl: boolean
  /** WebGL2 is drawn without a usable GPU, where the 3D map stalls the page. */
  software: boolean
  reducedMotion: boolean
}

export function chooseView(
  env: Env,
  requested: '3d' | '2d' | null,
): { view: '3d' | '2d'; canToggle: boolean } {
  if (env.mobile || !env.webgl) return { view: '2d', canToggle: false }
  const preferred = env.reducedMotion || env.software ? '2d' : '3d'
  return { view: requested ?? preferred, canToggle: true }
}
