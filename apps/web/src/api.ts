import type { GraphPayload, Kind, NodeDetail } from '@fdi/schema'

export async function fetchGraph(): Promise<GraphPayload> {
  const res = await fetch('/api/graph')
  if (!res.ok) throw new Error(`Loading graph failed (${res.status})`)
  return res.json()
}

const detailCache = new Map<string, Promise<NodeDetail | null>>()

export function fetchNode(kind: Kind, id: string): Promise<NodeDetail | null> {
  const key = `${kind}:${id}`
  let pending = detailCache.get(key)
  if (!pending) {
    pending = fetch(`/api/node/${kind}/${encodeURIComponent(id)}`).then((res) => {
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Loading ${key} failed (${res.status})`)
      return res.json() as Promise<NodeDetail>
    })
    pending.catch(() => detailCache.delete(key))
    detailCache.set(key, pending)
  }
  return pending
}
