import { useEffect, useMemo, useState } from 'react'
import type { GraphPayload } from '@fdi/schema'
import { safeStorage } from '../storage.ts'
import {
  loadBrands,
  loadMeds,
  loadNotChecked,
  saveBrands,
  saveMeds,
  saveNotChecked,
} from './medsStorage.ts'
import { decodeShare, mergeShared } from './shareLink.ts'

/** The Medication list, owned at App level so it outlives tab switches. Loads once the graph arrives. */
export function useMeds(graph: GraphPayload | null) {
  const storage = useMemo(() => safeStorage(), [])
  const [state, setState] = useState<{
    ids: string[]
    notChecked: string[]
    brands: Record<string, string>
    dropped: number
    /** A Share link opened on this visit, waiting for the person's yes or no. */
    shared: { ids: string[]; unknown: number } | null
  } | null>(null)

  // Adjust state during render (no effect round-trip) when the graph first arrives.
  if (graph && !state) {
    const isMedication = (id: string) =>
      graph.nodes.some((n) => n.kind === 'drug' && n.id === id && !n.group)
    const loaded = storage ? loadMeds(storage, isMedication) : { ids: [], dropped: [] }
    setState({
      ids: loaded.ids,
      notChecked: storage ? loadNotChecked(storage) : [],
      brands: storage ? loadBrands(storage) : {},
      dropped: loaded.dropped.length,
      shared: decodeShare(location.hash, isMedication),
    })
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

  const notChecked = state?.notChecked
  useEffect(() => {
    if (!storage || !notChecked) return
    try {
      saveNotChecked(storage, notChecked)
    } catch {
      // storage full or blocked: the list still works for this visit
    }
  }, [notChecked, storage])

  const brands = state?.brands
  useEffect(() => {
    if (!storage || !brands) return
    try {
      saveBrands(storage, brands)
    } catch {
      // storage full or blocked: the label only lasts this visit
    }
  }, [brands, storage])

  const setBrands = (update: (b: Record<string, string>) => Record<string, string>) =>
    setState((s) => (s ? { ...s, brands: update(s.brands) } : s))
  const setNotChecked = (update: (m: string[]) => string[]) =>
    setState((s) => (s ? { ...s, notChecked: update(s.notChecked) } : s))
  const setMeds = (update: (m: string[]) => string[]) =>
    setState((s) => (s ? { ...s, ids: update(s.ids) } : s))
  /** Either answer removes the fragment, so a reload never asks again. */
  const resolveShared = (add: boolean) => {
    history.replaceState(null, '', location.pathname + location.search)
    setState((s) =>
      s
        ? { ...s, ids: add && s.shared ? mergeShared(s.ids, s.shared.ids) : s.ids, shared: null }
        : s,
    )
  }
  return {
    shared: state?.shared ?? null,
    resolveShared,
    meds: ids ?? [],
    setMeds,
    brands: brands ?? {},
    setBrands,
    notChecked: notChecked ?? [],
    setNotChecked,
    dropped: state?.dropped ?? 0,
  }
}
