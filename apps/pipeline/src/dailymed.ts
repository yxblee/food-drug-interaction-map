// DailyMed label setids for catalogue Drugs, from the NLM DailyMed web services v2 (issue #98).
//   node --run pipeline -- dailymed
// Only a link is stored; label text is never copied.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { Drug } from '@fdi/schema'
import type { DrugFile } from './medlineplus.ts'

interface Spls {
  data?: { setid: string; title: string }[]
  metadata?: { total_elements?: number }
}
export interface Label {
  setid: string
  title: string
}

// Adds `dailymed` after the `medlineplus` line (else the `rxnorm` line), touching nothing else.
export function withDailymed(text: string, setid: string): string {
  const lines = text.split('\n')
  let at = lines.findIndex((l) => l.startsWith('medlineplus:'))
  if (at < 0) at = lines.findIndex((l) => l.startsWith('rxnorm:'))
  lines.splice(at + 1, 0, `dailymed: ${JSON.stringify(setid)}`)
  return lines.join('\n')
}

// Setid preference: the one label the Drug's Interactions already cite (a person picked it in review);
// several cited are listed for a person to choose from. Only with none cited is DailyMed queried, and
// then a setid is written only when it lists exactly one label for the Drug's rxcui. Never guessed from
// a name. A class or a Drug without an id is skipped.
export async function addDailymed(
  files: DrugFile[],
  getJson: (rxcui: string) => Promise<unknown>,
  cited: Record<string, string[]> = {},
) {
  const changed: DrugFile[] = []
  const unmatched: string[] = []
  const ambiguous: { id: string; total: number; labels: Label[] }[] = []
  for (const { file, text } of files) {
    const drug = Drug.parse(parse(text))
    if (drug.group || !drug.rxnorm || drug.dailymed) continue
    const c = cited[drug.id] ?? []
    if (c.length === 1) {
      changed.push({ file, text: withDailymed(text, c[0]) })
      continue
    }
    if (c.length > 1) {
      const labels = c.map((setid) => ({ setid, title: 'cited by Interactions' }))
      ambiguous.push({ id: drug.id, total: c.length, labels })
      continue
    }
    const r = (await getJson(drug.rxnorm)) as Spls
    const labels = r.data ?? []
    const total = r.metadata?.total_elements ?? labels.length
    if (total === 0) unmatched.push(drug.id)
    else if (total === 1 && labels.length === 1)
      changed.push({ file, text: withDailymed(text, labels[0].setid) })
    else ambiguous.push({ id: drug.id, total, labels })
  }
  return { changed, unmatched, ambiguous }
}

// Rule (a) of issue #122: labels titled with one of the Drug's brand aliases (whole word, at the start).
// Suggestions only; a person still picks the NDA holder's label and writes the line.
export function brandLabels(labels: Label[], aliases: string[]): Label[] {
  const starts = aliases.map((a) => a.toUpperCase() + ' ')
  return labels.filter((l) =>
    starts.some(
      (a) =>
        (l.title.toUpperCase() + ' ').startsWith(a) || (l.title.toUpperCase() + '(').startsWith(a),
    ),
  )
}

// CLI entry (not unit tested): the real Drug files and the real DailyMed service.
export async function runDailymed(dir: string, fetchUrl: (url: string) => Promise<Response>) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => ({ file: join(dir, f), text: readFileSync(join(dir, f), 'utf8') }))
  const cited: Record<string, string[]> = {}
  for (const f of readdirSync('data/interactions').filter((f) => f.endsWith('.yaml'))) {
    const i = parse(readFileSync(join('data/interactions', f), 'utf8'))
    for (const c of i.citations ?? [])
      if (typeof c.setid === 'string' && !(cited[i.drug] ??= []).includes(c.setid))
        cited[i.drug].push(c.setid)
  }
  const r = await addDailymed(
    files,
    async (rxcui) => {
      // All pages, so a brand label is not missed past the first 100.
      const data: Label[] = []
      let total = 0
      for (let page = 1; page === 1 || data.length < total; page++) {
        const q = new URLSearchParams({ rxcui, pagesize: '100', page: String(page) })
        const res = await fetchUrl(
          `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?${q}`,
        )
        if (!res.ok) throw new Error(`DailyMed ${res.status} for RxCUI ${rxcui}`)
        const r = (await res.json()) as Spls
        total = r.metadata?.total_elements ?? 0
        if (!r.data?.length) break
        data.push(...r.data)
      }
      return { data, metadata: { total_elements: total } }
    },
    cited,
  )
  for (const c of r.changed) writeFileSync(c.file, c.text)
  console.log(
    `${r.changed.length} Drugs linked; no DailyMed label for: ${r.unmatched.join(', ') || 'none'}`,
  )
  for (const a of r.ambiguous) {
    console.log(`\n${a.id}: ${a.total} labels, none written; choose one by hand:`)
    const aliases = parse(files.find((f) => f.file.endsWith(`/${a.id}.yaml`))!.text).aliases ?? []
    const brand = brandLabels(a.labels, aliases)
    if (a.total > 20) console.log(`  (${a.total} labels; showing brand-title suggestions only)`)
    for (const l of a.total > 20 ? brand : a.labels) console.log(`  ${l.setid}  ${l.title}`)
    for (const l of brand) console.log(`  suggested (rule a): ${l.setid}  ${l.title}`)
  }
}
