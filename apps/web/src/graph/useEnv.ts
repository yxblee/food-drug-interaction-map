import { useMemo, useSyncExternalStore } from 'react'
import type { Env } from './chooseView.ts'

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
  )
}

// three.js (>= r163) only supports WebGL2, so WebGL1 contexts are deliberately not accepted.
function probeWebgl2(): Pick<Env, 'webgl' | 'software'> {
  try {
    const context = (attrs?: WebGLContextAttributes) =>
      document.createElement('canvas').getContext('webgl2', attrs)
    const gl = context()
    if (!gl) return { webgl: false, software: false }
    // Chromium passes failIfMajorPerformanceCaveat on SwiftShader unless it fell back to it, so
    // the renderer name is checked too. The caveat still covers browsers that hide the name.
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
    const software =
      /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) ||
      !context({ failIfMajorPerformanceCaveat: true })
    return { webgl: true, software }
  } catch {
    return { webgl: false, software: false }
  }
}

// Probed once per page: each probe takes a WebGL context, and browsers cap how many stay alive.
let probed: ReturnType<typeof probeWebgl2> | undefined

/** Re-evaluates when the viewport or motion preference changes. */
export function useEnv(): Env {
  const mobile = useMedia('(max-width: 768px), (pointer: coarse)')
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)')
  const { webgl, software } = (probed ??= probeWebgl2())
  return useMemo(
    () => ({ mobile, webgl, software, reducedMotion }),
    [mobile, webgl, software, reducedMotion],
  )
}
