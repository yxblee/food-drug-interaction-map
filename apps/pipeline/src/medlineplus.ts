// MedlinePlus drug pages for catalogue Drugs, from the NLM MedlinePlus Connect service (issue #75).
//   node --run pipeline -- medlineplus
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { Drug } from '@fdi/schema'

interface Feed {
  feed?: { entry?: { link?: { href?: string }[] }[] }
}

// The MedlinePlus drug page in a Connect response, without the tracking query. Connect also
// returns health-topic pages (e.g. "Statins"); only /druginfo/meds/ pages on medlineplus.gov count.
export function medlineplusUrl(response: unknown): string | undefined {
  for (const entry of (response as Feed).feed?.entry ?? []) {
    for (const { href } of entry.link ?? []) {
      try {
        const u = new URL(href ?? '')
        if (
          u.protocol === 'https:' &&
          u.hostname === 'medlineplus.gov' &&
          u.pathname.startsWith('/druginfo/meds/')
        )
          return `${u.origin}${u.pathname}`
      } catch {
        // not a URL: not a link we can use
      }
    }
  }
}

// Adds `medlineplus` after the `rxnorm` line of a Drug file's text, touching nothing else.
export function withMedlineplus(text: string, url: string): string {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => l.startsWith('rxnorm:'))
  lines.splice(at + 1, 0, `medlineplus: ${JSON.stringify(url)}`)
  return lines.join('\n')
}

export interface DrugFile {
  file: string
  text: string
}

// Links every Drug that has an rxnorm id and no link yet. Returns only the files that change,
// and the ids MedlinePlus has no drug page for. A Drug class or a Drug without an id is skipped.
export async function addMedlineplus(
  files: DrugFile[],
  getJson: (rxcui: string) => Promise<unknown>,
) {
  const changed: DrugFile[] = []
  const unmatched: string[] = []
  for (const { file, text } of files) {
    const drug = Drug.parse(parse(text))
    if (drug.group || !drug.rxnorm || drug.medlineplus) continue
    const url = medlineplusUrl(await getJson(drug.rxnorm))
    if (url) changed.push({ file, text: withMedlineplus(text, url) })
    else unmatched.push(drug.id)
  }
  return { changed, unmatched }
}

// CLI entry (not unit tested): the real Drug files and the real Connect service.
export async function runMedlineplus(dir: string, fetchUrl: (url: string) => Promise<Response>) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => ({ file: join(dir, f), text: readFileSync(join(dir, f), 'utf8') }))
  const r = await addMedlineplus(files, async (rxcui) => {
    const q = new URLSearchParams({
      'mainSearchCriteria.v.cs': '2.16.840.1.113883.6.88',
      'mainSearchCriteria.v.c': rxcui,
      knowledgeResponseType: 'application/json',
    })
    const res = await fetchUrl(`https://connect.medlineplus.gov/service?${q}`)
    if (!res.ok) throw new Error(`MedlinePlus Connect ${res.status} for RxCUI ${rxcui}`)
    return res.json()
  })
  for (const c of r.changed) writeFileSync(c.file, c.text)
  console.log(
    `${r.changed.length} Drugs linked; no MedlinePlus drug page for: ${r.unmatched.join(', ') || 'none'}`,
  )
}
