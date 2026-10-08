import { useCallback, useEffect, useState } from 'react'
import { safeStorage } from './storage.ts'
import { decode, encode, type ViewState } from './urlState.ts'

const TINT_KEY = 'fdi:tint'

function initial(): ViewState {
  const s = decode(location.search)
  if (!new URLSearchParams(location.search).has('tint') && safeStorage()?.getItem(TINT_KEY) === '1')
    s.tint = true
  return s
}

export function useUrlState(): [
  ViewState,
  (patch: Partial<ViewState>, opts?: { push?: boolean }) => void,
] {
  const [state, setState] = useState(initial)

  useEffect(() => {
    const onPop = () => setState(decode(location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const update = useCallback((patch: Partial<ViewState>, opts: { push?: boolean } = {}) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
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
