import type { GraphPayload, Kind, NodeDetail } from '@fdi/schema'

/** Read API URL: the Hono server by default, pre-exported JSON files in the static (GitHub Pages) build. */
const dataUrl = (path: string) =>
  import.meta.env.VITE_STATIC_DATA === '1'
    ? `${import.meta.env.BASE_URL}api/${path}.json`
    : `/api/${path}`

export const nodeUrl = (kind: Kind, id: string) => dataUrl(`node/${kind}/${encodeURIComponent(id)}`)

/** `saved` is true when the offline worker answered from its copy of the Dataset. */
export async function fetchGraph(): Promise<{ graph: GraphPayload; saved: boolean }> {
  const res = await fetch(dataUrl('graph'))
  if (!res.ok) throw new Error(`Loading graph failed (${res.status})`)
  return { graph: await res.json(), saved: res.headers.has('x-fdi-saved') }
}

const detailCache = new Map<string, Promise<NodeDetail | null>>()

export function fetchNode(kind: Kind, id: string): Promise<NodeDetail | null> {
  const key = `${kind}:${id}`
  let pending = detailCache.get(key)
  if (!pending) {
    pending = fetch(nodeUrl(kind, id)).then((res) => {
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Loading ${key} failed (${res.status})`)
      return res.json() as Promise<NodeDetail>
    })
    pending.catch(() => detailCache.delete(key))
    detailCache.set(key, pending)
  }
  return pending
}
