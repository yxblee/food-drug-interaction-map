export interface Env {
  mobile: boolean
  webgl: boolean
  reducedMotion: boolean
}

export function detectEnv(): Env {
  const matches = (q: string) => window.matchMedia(q).matches
  let webgl = false
  try {
    webgl = !!document.createElement('canvas').getContext('webgl2')
  } catch {
    webgl = false
  }
  return {
    mobile: matches('(max-width: 768px), (pointer: coarse)'),
    webgl,
    reducedMotion: matches('(prefers-reduced-motion: reduce)'),
  }
}

export function chooseView(
  env: Env,
  requested: '3d' | '2d' | null,
): { view: '3d' | '2d'; canToggle: boolean } {
  if (env.mobile || !env.webgl) return { view: '2d', canToggle: false }
  return { view: requested ?? (env.reducedMotion ? '2d' : '3d'), canToggle: true }
}
