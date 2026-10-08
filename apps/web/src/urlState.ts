export type Tab = 'explore' | 'meds'
export interface ViewState {
  tab: Tab
  q: string
  node: string | null
  view: '3d' | '2d' | null
  mech: boolean
  tint: boolean
}

export const DEFAULT_STATE: ViewState = {
  tab: 'explore',
  q: '',
  node: null,
  view: null,
  mech: true,
  tint: false,
}
const NODE_KEY = /^(drug|food|mechanism):[a-z0-9]+(?:-[a-z0-9]+)*$/

export function decode(search: string): ViewState {
  const p = new URLSearchParams(search)
  const tab = p.get('tab')
  const node = p.get('node')
  const view = p.get('view')
  return {
    tab: tab === 'meds' ? 'meds' : 'explore',
    q: p.get('q') ?? '',
    node: node && NODE_KEY.test(node) ? node : null,
    view: view === '3d' || view === '2d' ? view : null,
    mech: p.get('mech') !== '0',
    tint: p.get('tint') === '1',
  }
}

export function encode(s: ViewState): string {
  const p = new URLSearchParams()
  if (s.tab !== 'explore') p.set('tab', s.tab)
  if (s.q) p.set('q', s.q)
  if (s.node) p.set('node', s.node)
  if (s.view) p.set('view', s.view)
  if (!s.mech) p.set('mech', '0')
  if (s.tint) p.set('tint', '1')
  return p.toString()
}
