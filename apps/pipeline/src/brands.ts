// Brand names for catalogue Drugs from RxNorm, read through the NLM RxNav REST API (issue #59).
//   node --run pipeline -- brands
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { Drug } from '@fdi/schema'

export interface AliasOwner {
  name: string
  aliases: string[]
  group?: boolean
}

// Existing Aliases stay as they are, in order; new Brand names follow. A Drug class gets none.
export function mergeAliases(drug: AliasOwner, brands: string[]): string[] {
  const out = [...drug.aliases]
  if (drug.group) return out
  const have = new Set([drug.name, ...drug.aliases].map((n) => n.toLowerCase()))
  for (const b of brands) {
    if (have.has(b.toLowerCase())) continue
    have.add(b.toLowerCase())
    out.push(b)
  }
  return out
}

export type GetJson = (path: string) => Promise<unknown>

interface Concept {
  rxcui: string
  name: string
}
// getRelatedByType: related concepts of one term type; a concept with none has no conceptProperties.
async function related(cui: string, tty: string, getJson: GetJson): Promise<Concept[]> {
  const res = (await getJson(`rxcui/${cui}/related.json?tty=${tty}`)) as {
    relatedGroup?: { conceptGroup?: { conceptProperties?: Concept[] }[] }
  }
  return (res.relatedGroup?.conceptGroup ?? []).flatMap((g) => g.conceptProperties ?? [])
}

// Brand names (BN) whose only ingredient is `cui`. A combination product's brand (Vytorin =
// ezetimibe + simvastatin) is not a name for either ingredient alone.
export async function brandNames(cui: string, getJson: GetJson): Promise<string[]> {
  const names: string[] = []
  for (const bn of await related(cui, 'BN', getJson)) {
    const ingredients = await related(bn.rxcui, 'IN', getJson)
    if (ingredients.length === 1 && ingredients[0].rxcui === cui) names.push(bn.name)
  }
  return names
}

// Sets the `aliases` list in a Drug file's text, touching nothing else. `aliases` must start with
// the Aliases already in the file (mergeAliases guarantees it). Files come in two styles: quoted
// values with a flow list (`aliases: ["Zocor"]`), and plain values with a block list.
export function withAliases(text: string, aliases: string[]): string {
  const lines = text.split('\n')
  const flow = `aliases: [${aliases.map((a) => JSON.stringify(a)).join(', ')}]`
  const item = (a: string) => `  - ${stringify(a).trimEnd()}`
  const at = lines.findIndex((l) => l.startsWith('aliases:'))
  if (at < 0) {
    const after = lines.findIndex((l) => l.startsWith('rxnorm:'))
    const where = (after < 0 ? lines.findIndex((l) => l.startsWith('name:')) : after) + 1
    const quoted = lines.some((l) => l.startsWith('id: "'))
    lines.splice(where, 0, ...(quoted ? [flow] : ['aliases:', ...aliases.map(item)]))
  } else if (lines[at].trim() === 'aliases:') {
    let end = at + 1
    while (/^\s+- /.test(lines[end] ?? '')) end++
    lines.splice(end, 0, ...aliases.slice(end - at - 1).map(item))
  } else lines[at] = flow
  return lines.join('\n')
}

// RxNorm Brand names dropped on review (issue #59): not a name a person reads on the box of a
// medicine they swallow or are given. Lowercase.
export const EXCLUDED = new Set([
  // veterinary products
  ...['amodip', 'atopica', 'cyclavance', 'modulis', 'optimmune', 'reconcile', 'sporimune'],
  ...['thyro-tabs', 'thyrokare', 'thyrocryn'],
  // sold only for the skin, eye, ear or gum pocket, where food does not change the Drug's action
  ...['amzeeq', 'arestin', 'cequa', 'cetraxal', 'ciloxan', 'metrocream', 'metrogel', 'metrolotion'],
  ...['noritate', 'nydamax', 'restasis', 'rosadan', 'vectical', 'verkazia', 'vevye', 'viabecline'],
  ...['vitastem', 'zilxi'],
  // gabapentin enacarbil, a prodrug whose label advises against any alcohol, unlike gabapentin's
  'horizant',
  // a pack variant of Tylenol, not a separate Brand name
  'tylenol gelcap extra strength',
])

export interface DrugFile {
  file: string
  text: string
}

// findRxcuiByString, normalized match: the RxNorm id for a name, when there is exactly one.
async function cuiByName(name: string, getJson: GetJson): Promise<string | undefined> {
  const res = (await getJson(`rxcui.json?${new URLSearchParams({ name, search: '2' })}`)) as {
    idGroup?: { rxnormId?: string[] }
  }
  const ids = res.idGroup?.rxnormId ?? []
  return ids.length === 1 ? ids[0] : undefined
}

// Merges RxNorm Brand names into the Aliases of every Drug that has an rxnorm id. Returns only
// the files that change. A Drug without an id is looked up by name and reported, not written: a
// person confirms the id first.
export async function addBrands(files: DrugFile[], getJson: GetJson, excluded = EXCLUDED) {
  const drugs = files.map((f) => ({ ...f, drug: Drug.parse(parse(f.text)) }))
  const owner = new Map<string, string>()
  for (const { drug } of drugs)
    for (const n of [drug.name, ...drug.aliases]) owner.set(n.toLowerCase(), drug.id)

  const changed: (DrugFile & { added: string[] })[] = []
  const lookedUp: { id: string; name: string; rxnorm?: string }[] = []
  const collisions: { id: string; brand: string; usedBy: string }[] = []
  for (const { file, text, drug } of drugs) {
    if (drug.group) continue
    if (!drug.rxnorm) {
      lookedUp.push({ id: drug.id, name: drug.name, rxnorm: await cuiByName(drug.name, getJson) })
      continue
    }
    const brands: string[] = []
    for (const brand of await brandNames(drug.rxnorm, getJson)) {
      if (excluded.has(brand.toLowerCase())) continue
      const usedBy = owner.get(brand.toLowerCase())
      if (usedBy && usedBy !== drug.id) collisions.push({ id: drug.id, brand, usedBy })
      else {
        brands.push(brand)
        owner.set(brand.toLowerCase(), drug.id)
      }
    }
    const aliases = mergeAliases(drug, brands)
    const added = aliases.slice(drug.aliases.length)
    if (added.length) changed.push({ file, text: withAliases(text, aliases), added })
  }
  return { changed, lookedUp, collisions }
}

// CLI entry (not unit tested): the real Drug files and the real RxNav. Sequential requests stay
// under RxNav's 20 requests/s limit.
export async function runBrands(dir: string, fetchUrl: (url: string) => Promise<Response>) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => ({ file: join(dir, f), text: readFileSync(join(dir, f), 'utf8') }))
  const r = await addBrands(files, async (path) => {
    const res = await fetchUrl(`https://rxnav.nlm.nih.gov/REST/${path}`)
    if (!res.ok) throw new Error(`RxNav ${res.status} for ${path}`)
    return res.json()
  })
  for (const c of r.changed) {
    writeFileSync(c.file, c.text)
    console.log(`${c.file}: + ${c.added.join(', ')}`)
  }
  for (const c of r.collisions)
    console.log(`skipped ${c.brand} for ${c.id}: already a name or Alias of ${c.usedBy}`)
  for (const l of r.lookedUp)
    console.log(
      `${l.id} has no rxnorm id; RxNav says ${l.rxnorm ?? 'nothing'} for "${l.name}". Confirm it and add it by hand.`,
    )
  console.log(
    `${r.changed.length} Drugs changed, ${r.changed.reduce((n, c) => n + c.added.length, 0)} Aliases added`,
  )
}
