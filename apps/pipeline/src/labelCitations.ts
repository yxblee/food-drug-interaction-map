// Re-point repackager label Citations to the Drug's own DailyMed label (issue #129).
//   node --run pipeline -- label-citations
// Only title, url and setid of a Citation change; label text is read, never stored.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { labelText, mentions, type Label } from './pipeline.ts'

export interface LabelInfo {
  title: string
  text: string
}
interface DocFile {
  file: string
  text: string
}
// Labels use curly apostrophes (St. John\u2019s wort); Food names use straight ones.
const straight = (s: string) => s.replace(/[\u2018\u2019]/g, "'")
const DAILYMED = 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid='

// Rewrites the title/url/setid lines of the one Citation item holding `old`; other lines are untouched.
function rewrite(text: string, old: string, to: { title: string; setid: string }): string {
  const lines = text.split('\n')
  // Files quote values or not; a rewritten item is written quoted (same YAML value).
  const at = lines.findIndex((l) => new RegExp(`^\\s*setid: "?${old}"?\\s*$`).test(l))
  let start = at
  while (!lines[start].trimStart().startsWith('- ')) start--
  const fields = { title: to.title, url: DAILYMED + to.setid, setid: to.setid }
  const out = lines.slice(0, start)
  for (let i = start; i <= at; i++) {
    // A long plain title may wrap onto continuation lines (no `key:`); drop them with the title.
    if (i > start && !/^\s*(- )?\w+: /.test(lines[i])) continue
    let line = lines[i]
    for (const [k, v] of Object.entries(fields))
      line = line.replace(new RegExp(`^(\\s*(?:- )?${k}: ).*$`), `$1${JSON.stringify(v)}`)
    out.push(line)
  }
  lines.splice(0, at + 1, ...out)
  return lines.join('\n')
}

// drugs: Drug id -> its `dailymed` setid. foods: Food id -> name and Aliases.
export async function relabel(
  files: DocFile[],
  drugs: Record<string, string>,
  foods: Record<string, string[]>,
  getLabel: (setid: string) => Promise<LabelInfo | undefined>,
) {
  const changed: DocFile[] = []
  const rewritten: { file: string; from: string; to: string }[] = []
  const kept: { file: string; title: string; reason: string }[] = []
  for (const f of files) {
    const doc = parse(f.text) as {
      food: string
      drug: string
      citations?: { type: string; title: string; setid?: string }[]
    }
    const own = drugs[doc.drug]
    if (!own) continue
    const terms = foods[doc.food] ?? [doc.food.replaceAll('-', ' ')]
    let text = f.text
    for (const c of doc.citations ?? []) {
      if (c.type !== 'label' || !c.setid || c.setid === own) continue
      const label = await getLabel(own)
      if (!label)
        kept.push({ file: f.file, title: c.title, reason: `Drug label ${own} not fetched` })
      else if (!mentions(straight(label.text), terms.map(straight)))
        kept.push({
          file: f.file,
          title: c.title,
          reason: `Drug label does not mention ${terms[0].toLowerCase()}`,
        })
      else {
        text = rewrite(text, c.setid, { title: label.title, setid: own })
        rewritten.push({ file: f.file, from: c.title, to: label.title })
      }
    }
    if (text !== f.text) changed.push({ file: f.file, text })
  }
  return { changed, rewritten, kept }
}

const read = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => ({ file: join(dir, f), text: readFileSync(join(dir, f), 'utf8') }))

// CLI entry (not unit tested): real data files, DailyMed (title) and openFDA (text).
export async function runLabelCitations(dir: string, fetchUrl: (url: string) => Promise<Response>) {
  const drugs: Record<string, string> = {}
  for (const f of read(join(dir, 'drugs'))) {
    const d = parse(f.text) as { id: string; dailymed?: string }
    if (d.dailymed) drugs[d.id] = d.dailymed
  }
  const foods: Record<string, string[]> = {}
  for (const f of read(join(dir, 'foods'))) {
    const d = parse(f.text) as { id: string; name: string; aliases?: string[] }
    foods[d.id] = [d.name, ...(d.aliases ?? [])]
  }
  const cache = new Map<string, LabelInfo | undefined>()
  const getLabel = async (setid: string) => {
    if (cache.has(setid)) return cache.get(setid)
    const q = new URLSearchParams({ search: `set_id:"${setid}"`, limit: '1' })
    if (process.env.OPENFDA_API_KEY) q.set('api_key', process.env.OPENFDA_API_KEY)
    const [fda, spl] = await Promise.all([
      fetchUrl(`https://api.fda.gov/drug/label.json?${q}`),
      fetchUrl(`https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?setid=${setid}`),
    ])
    let info: LabelInfo | undefined
    if (fda.ok && spl.ok) {
      const label = ((await fda.json()) as { results?: Label[] }).results?.[0]
      const title = ((await spl.json()) as { data?: { title: string }[] }).data?.[0]?.title
      if (label && title) info = { title, text: labelText(label) }
    }
    cache.set(setid, info)
    return info
  }
  const r = await relabel(
    [...read(join(dir, 'interactions')), ...read(join(dir, 'pairings'))],
    drugs,
    foods,
    getLabel,
  )
  for (const c of r.changed) writeFileSync(c.file, c.text)
  console.log(`${r.rewritten.length} Citations rewritten:`)
  for (const w of r.rewritten) console.log(`  ${w.file}: ${w.from} -> ${w.to}`)
  console.log(`${r.kept.length} kept:`)
  for (const k of r.kept) console.log(`  ${k.file}: ${k.title} (${k.reason})`)
}
