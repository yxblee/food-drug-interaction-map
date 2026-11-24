import { useCallback, useEffect, useState } from 'react'
import { safeStorage } from './storage.ts'
import { decodeWithStoredTint, encode, type ViewState } from './urlState.ts'

const TINT_KEY = 'fdi:tint'

function initial(): ViewState {
  return decodeWithStoredTint(location.search, safeStorage()?.getItem(TINT_KEY) ?? null)
}

export function useUrlState(): [
  ViewState,
  (patch: Partial<ViewState>, opts?: { push?: boolean }) => void,
] {
  const [state, setState] = useState(initial)

  useEffect(() => {
    const onPop = () => setState(initial())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const update = useCallback((patch: Partial<ViewState>, opts: { push?: boolean } = {}) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      // A new panel is no longer the one the Interaction link named.
      if ('node' in patch && !('interaction' in patch)) next.interaction = null
      const qs = encode(next)
      const url = qs ? `?${qs}` : location.pathname
      if (opts.push) history.pushState(null, '', url)
      else history.replaceState(null, '', url)
      if ('tint' in patch) {
        try {
          safeStorage()?.setItem(TINT_KEY, next.tint ? '1' : '0')
        } catch {
          // storage full or blocked: the URL still carries the tint
        }
      }
      return next
    })
  }, [])

  return [state, update]
}
