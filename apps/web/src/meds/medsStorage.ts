export const MEDS_KEY = 'fdi:meds'

export function loadMeds(
  storage: Pick<Storage, 'getItem'>,
  known: (id: string) => boolean,
): { ids: string[]; dropped: string[] } {
  let raw: unknown
  try {
    raw = JSON.parse(storage.getItem(MEDS_KEY) ?? '[]')
  } catch {
    raw = []
  }
  const list = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  const unique = [...new Set(list)]
  return { ids: unique.filter(known), dropped: unique.filter((id) => !known(id)) }
}

export function saveMeds(storage: Pick<Storage, 'setItem' | 'removeItem'>, ids: string[]): void {
  if (ids.length) storage.setItem(MEDS_KEY, JSON.stringify(ids))
  else storage.removeItem(MEDS_KEY)
}
