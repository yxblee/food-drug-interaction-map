import type { GraphPayload } from '@fdi/schema'
import { nodeUrl } from './api.ts'

/** Production builds only, so `vp dev` and HMR never meet a worker. Scope follows the base path. */
export function registerOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js?v=${__BUILD_ID__}`)
    .catch(() => {}) // no worker is fine: the app works online as before
}

/** Ask the worker to keep what this visit loaded, plus every node file, for the next offline one. */
export async function saveForOffline(graph: GraphPayload) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const { active } = await navigator.serviceWorker.ready
  const loaded = performance.getEntriesByType('resource').map((e) => e.name)
  const nodes = graph.nodes.map((n) => nodeUrl(n.kind, n.id))
  active?.postMessage({ type: 'save', urls: [import.meta.env.BASE_URL, ...loaded, ...nodes] })
}
