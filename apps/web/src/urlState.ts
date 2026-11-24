import { InteractionId, SEVERITIES, type Severity } from '@fdi/schema'

export type Tab = 'explore' | 'meds'
export interface ViewState {
  tab: Tab
  q: string
  node: string | null
  /** One Interaction id: opened, expanded and focused in the `node` panel. Cleared when `node` changes. */
  interaction: string | null
  view: '3d' | '2d' | null
  mech: boolean
  /** Severities drawn on the map; all four by default. */
  sev: readonly Severity[]
  tint: boolean
  /** Map filtered to the Medication list. Only a flag: the list itself stays on the device. */
  meds: boolean
}

export const DEFAULT_STATE: ViewState = {
  tab: 'explore',
  q: '',
  node: null,
  interaction: null,
  view: null,
  mech: true,
  sev: SEVERITIES,
  tint: false,
  meds: false,
}
function decodeSev(raw: string | null): readonly Severity[] {
  const want = new Set((raw ?? '').split(','))
  const on = SEVERITIES.filter((s) => want.has(s))
  return on.length ? on : SEVERITIES
}
const NODE_KEY = /^(drug|food|mechanism):[a-z0-9]+(?:-[a-z0-9]+)*$/

export function decode(search: string): ViewState {
  const p = new URLSearchParams(search)
  const tab = p.get('tab')
  const node = p.get('node')
  const interaction = p.get('interaction')
  const view = p.get('view')
  return {
    tab: tab === 'meds' ? 'meds' : 'explore',
    q: p.get('q') ?? '',
    node: node && NODE_KEY.test(node) ? node : null,
    interaction: InteractionId.safeParse(interaction).success ? interaction : null,
    view: view === '3d' || view === '2d' ? view : null,
    mech: p.get('mech') !== '0',
    sev: decodeSev(p.get('sev')),
    tint: p.get('tint') === '1',
    meds: p.get('meds') === '1',
  }
}

export function encode(s: ViewState): string {
  const p = new URLSearchParams()
  if (s.tab !== 'explore') p.set('tab', s.tab)
  if (s.q) p.set('q', s.q)
  if (s.node) p.set('node', s.node)
  if (s.interaction) p.set('interaction', s.interaction)
  if (s.view) p.set('view', s.view)
  if (!s.mech) p.set('mech', '0')
  if (s.sev.length < SEVERITIES.length)
    p.set('sev', SEVERITIES.filter((v) => s.sev.includes(v)).join(','))
  if (s.tint) p.set('tint', '1')
  if (s.meds) p.set('meds', '1')
  return p.toString()
}

/** Initial state: the URL wins; otherwise fall back to the Color mode remembered on this device. */
export function decodeWithStoredTint(search: string, stored: string | null): ViewState {
  const s = decode(search)
  if (!new URLSearchParams(search).has('tint') && stored === '1') s.tint = true
  return s
}
