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

/** Names the Dataset doesn't know, kept only to remind the person they were not checked. Never sent to the API. */
export const NOT_CHECKED_KEY = 'fdi:meds:not-checked'

export function loadNotChecked(storage: Pick<Storage, 'getItem'>): string[] {
  let raw: unknown
  try {
    raw = JSON.parse(storage.getItem(NOT_CHECKED_KEY) ?? '[]')
  } catch {
    raw = []
  }
  const list = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  return [...new Set(list.map((x) => x.trim()).filter(Boolean))]
}

export function saveNotChecked(
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  names: string[],
): void {
  if (names.length) storage.setItem(NOT_CHECKED_KEY, JSON.stringify(names))
  else storage.removeItem(NOT_CHECKED_KEY)
}

/** The Brand name a medicine was added by (id -> name), so the chip can echo it. Display only. */
export const BRANDS_KEY = 'fdi:meds:brands'

export function loadBrands(storage: Pick<Storage, 'getItem'>): Record<string, string> {
  let raw: unknown
  try {
    raw = JSON.parse(storage.getItem(BRANDS_KEY) ?? '{}')
  } catch {
    return {}
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).filter(
      (e): e is [string, string] => typeof e[1] === 'string' && e[1].trim() !== '',
    ),
  )
}

export function saveBrands(
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  brands: Record<string, string>,
): void {
  if (Object.keys(brands).length) storage.setItem(BRANDS_KEY, JSON.stringify(brands))
  else storage.removeItem(BRANDS_KEY)
}
