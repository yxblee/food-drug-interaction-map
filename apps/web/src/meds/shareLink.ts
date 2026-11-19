/** Share link: the Medication list as catalogue Drug ids in the URL fragment, which browsers never send to a server. */

export function encodeShare(ids: string[], notChecked: string[]) {
  return { fragment: `#meds=${ids.join(',')}`, leftOut: notChecked.length }
}

/** Null when the fragment carries no usable list. Unknown ids and repeats are dropped; unknown ones are counted. */
export function decodeShare(hash: string, isKnown: (id: string) => boolean) {
  const raw = new URLSearchParams(hash.replace(/^#/, '')).get('meds')
  if (!raw) return null
  const ids: string[] = []
  let unknown = 0
  for (const id of new Set(raw.split(',').filter(Boolean))) {
    if (isKnown(id)) ids.push(id)
    else unknown++
  }
  return { ids, unknown }
}

export function mergeShared(existing: string[], shared: string[]): string[] {
  return [...existing, ...shared.filter((id) => !existing.includes(id))]
}
