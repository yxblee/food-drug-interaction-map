import { useEffect, useMemo, useState } from 'react'
import type { GraphPayload } from '@fdi/schema'
import { safeStorage } from '../storage.ts'
import { loadMeds, saveMeds } from './medsStorage.ts'

/** The Medication list, owned at App level so it outlives tab switches. Loads once the graph arrives. */
export function useMeds(graph: GraphPayload | null) {
  const storage = useMemo(() => safeStorage(), [])
  const [state, setState] = useState<{ ids: string[]; dropped: number } | null>(null)

  // Adjust state during render (no effect round-trip) when the graph first arrives.
  if (graph && !state) {
    const isMedication = (id: string) =>
      graph.nodes.some((n) => n.kind === 'drug' && n.id === id && !n.group)
    const loaded = storage ? loadMeds(storage, isMedication) : { ids: [], dropped: [] }
    setState({ ids: loaded.ids, dropped: loaded.dropped.length })
  }

  const ids = state?.ids
  useEffect(() => {
    if (!storage || !ids) return
    try {
      saveMeds(storage, ids)
    } catch {
      // storage full or blocked: the list still works for this visit
    }
  }, [ids, storage])

  const setMeds = (update: (m: string[]) => string[]) =>
    setState((s) => (s ? { ...s, ids: update(s.ids) } : s))
  return { meds: ids ?? [], setMeds, dropped: state?.dropped ?? 0 }
}
