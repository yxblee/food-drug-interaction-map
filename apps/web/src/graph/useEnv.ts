import { useMemo, useSyncExternalStore } from 'react'
import type { Env } from './chooseView.ts'

function useMedia(query: string): boolean {
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
function hasWebgl2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

/** Re-evaluates when the viewport or motion preference changes. */
export function useEnv(): Env {
  const mobile = useMedia('(max-width: 768px), (pointer: coarse)')
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)')
  const webgl = useMemo(() => hasWebgl2(), [])
  return useMemo(() => ({ mobile, webgl, reducedMotion }), [mobile, webgl, reducedMotion])
}
