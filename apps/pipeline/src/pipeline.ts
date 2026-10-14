import { stringify } from 'yaml'
import { z } from 'zod'
import { validateDataset, Drug, Food, Interaction, Mechanism, Severity } from '@fdi/schema'
import type { RawDataset } from '@fdi/schema'
import { readFooDrugs } from './foodrugs.ts'

// Label sections searched for food mentions (openFDA field names).
export const SECTIONS = [
  'drug_interactions',
  'dosage_and_administration',
  'warnings_and_cautions',
  'warnings',
  'precautions',
  'information_for_patients',
  'clinical_pharmacology',
] as const

// One openFDA drug label, as returned in `results`.
export interface Label {
  set_id: string
  effective_time: string // YYYYMMDD
  openfda?: {
    generic_name?: string[]
    substance_name?: string[]
    manufacturer_name?: string[]
    rxcui?: string[]
  }
  [section: string]: unknown
}

// What the LLM returns for one pair. Flat so it is a simple structured-output schema.
export const Draft = z.object({
  keep: z.boolean(),
  reason: z.string(), // why it was discarded (or a note when kept)
  summary: z.string(),
  advice: z.string(),
  details: z.string(),
  effect: z.enum(['increases', 'decreases']),
  mechanisms: z.array(z.string()),
  severity: Severity, // suggested only
  excerpt: z.string(), // verbatim from the label text
})
export type Draft = z.infer<typeof Draft>

export interface DraftInput {
  food: Food
  drug: Drug
  text: string
  mechanisms: Mechanism[]
  kind?: 'label' | 'abstract' // what `text` is; labels by default
}

// What the foodrugs Source needs on top of Ports.
export interface FooDrugsPorts {
  foodrugsLines(): AsyncIterable<string> // the cached dump, one line at a time
  rxcui(name: string): Promise<string | undefined> // RxNav: drug name -> RxNorm CUI
  pubmed(pmid: string): Promise<{ title: string; abstract: string } | undefined> // E-utilities
}

export interface Ports {
  searchLabels(term: string): Promise<Label[]>
  draft(input: DraftInput): Promise<Draft>
  readDataset(dir: string): RawDataset
  writeFile(path: string, content: string): void
  cache: {
    get(key: string): Promise<string | undefined>
    set(key: string, value: string): Promise<void>
  }
}

export interface Options {
  limit?: number
  dataDir: string
  reportPath: string
}

export interface Result {
  written: string[]
  report: string
  expectedErrors: string[]
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const labelText = (l: Label) =>
  norm(SECTIONS.flatMap((s) => (Array.isArray(l[s]) ? (l[s] as string[]) : [])).join(' '))
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const mentions = (text: string, terms: string[]) =>
  new RegExp(`\\b(?:${terms.map(escapeRe).join('|')})\\b`, 'i').test(text)
const stem = (file: string) => file.replace(/^.*\//, '').replace(/\.ya?ml$/, '')
// "ATORVASTATIN CALCIUM TRIHYDRATE" counts as atorvastatin; salts follow the name.
const sameIngredient = (ingredient: string, name: string) => {
  const a = ingredient.toLowerCase()
  const b = name.toLowerCase()
  return a === b || a.startsWith(`${b} `)
}
// The no-approved-reference errors are expected until the reviewer Approves an Interaction (#39).
const EXPECTED = /: no approved interaction references this (drug|mechanism)$/

interface Pair {
  food: Food
  drug: Drug
  labels: Map<string, Label> // openfda
  pmids: Map<string, number> // foodrugs: PMID -> text-mined mentions
}
const mentionCount = (p: Pair) => p.labels.size + p.pmids.size
const MAX_PMIDS = 3
const REPORT_NAMES = 100 // the long tail of food and drug names is noise

export async function runPipeline(
  source: 'openfda' | 'foodrugs',
  options: Options,
  ports: Ports & Partial<FooDrugsPorts>,
): Promise<Result> {
  if (source !== 'openfda' && source !== 'foodrugs')
    throw new Error(`unsupported source: ${String(source)}`)
  const raw = ports.readDataset(options.dataDir)
  // Parse the catalogue (defaults applied). Whole-dataset validation runs on the merged result below,
  // so pre-existing unreferenced Drugs do not block a run.
  const ds = {
    drugs: raw.drugs.map((f) => Drug.parse(f.data)),
    foods: raw.foods.map((f) => Food.parse(f.data)),
    mechanisms: raw.mechanisms.map((f) => Mechanism.parse(f.data)),
    interactions: raw.interactions.map((f) => f.data as Interaction),
  }

  // Food names and Aliases -> labels (cached) that actually mention them.
  const cached = async (term: string) => {
    const key = `openfda:${term.toLowerCase()}`
    const hit = await ports.cache.get(key)
    if (hit) return JSON.parse(hit) as Label[]
    const labels = await ports.searchLabels(term)
    await ports.cache.set(key, JSON.stringify(labels))
    return labels
  }

  const drugs = ds.drugs.filter((d) => !d.group)
  const pairs = new Map<string, Pair>()
  const skip = {
    combination: new Set<string>(),
    noIngredient: new Set<string>(),
    notInCatalogue: new Set<string>(),
    existing: 0,
    inherited: 0,
  }

  const fd = {
    unmatched: new Map<string, number>(), // food names with no catalogue match
    unresolved: new Map<string, number>(), // drug names RxNav could not resolve
    unknownCuis: new Set<string>(), // resolved, but no catalogue Drug has this CUI (#42 will propose them)
    noAbstract: new Set<string>(), // pairs none of whose cited PMIDs has an abstract
  }
  const pairFor = (food: Food, drug: Drug) => {
    const key = `${food.id}--${drug.id}`
    const pair = pairs.get(key) ?? { food, drug, labels: new Map(), pmids: new Map() }
    pairs.set(key, pair)
    return pair
  }

  // Cached lookups for the foodrugs ports; null records "asked, nothing there".
  const lookup = async <T>(key: string, fetch: () => Promise<T | undefined>) => {
    const hit = await ports.cache.get(key)
    if (hit !== undefined) return JSON.parse(hit) as T | null
    const value = (await fetch()) ?? null
    await ports.cache.set(key, JSON.stringify(value))
    return value
  }

  if (source === 'foodrugs') {
    const { foodrugsLines, rxcui } = ports
    if (!foodrugsLines || !rxcui || !ports.pubmed)
      throw new Error('the foodrugs source needs the foodrugsLines, rxcui and pubmed ports')
    const foodByName = new Map(
      ds.foods.flatMap((f) => [f.name, ...f.aliases].map((n) => [n.toLowerCase(), f] as const)),
    )
    const dump = await readFooDrugs(foodrugsLines(), (n) => foodByName.has(n.toLowerCase()))
    fd.unmatched = dump.unmatched
    for (const r of dump.records) {
      const pmid = dump.pmids.get(r.textId)
      if (!pmid) continue // not a PubMed document
      const name = r.drug.trim().toLowerCase()
      const cui = await lookup(`rxnav:${name}`, () => rxcui(name))
      if (!cui) {
        fd.unresolved.set(name, (fd.unresolved.get(name) ?? 0) + 1)
        continue
      }
      const drug = drugs.find((d) => d.rxnorm === cui)
      if (!drug) {
        fd.unknownCuis.add(cui)
        continue
      }
      const pair = pairFor(foodByName.get(r.food.toLowerCase())!, drug)
      pair.pmids.set(pmid, (pair.pmids.get(pmid) ?? 0) + 1)
    }
  } else
    for (const food of ds.foods) {
      const terms = [food.name, ...food.aliases]
      const hits = new Map<string, Label>()
      for (const term of terms) {
        for (const l of await cached(term)) if (mentions(labelText(l), terms)) hits.set(l.set_id, l)
      }
      for (const l of hits.values()) {
        const ingredients = l.openfda?.substance_name ?? l.openfda?.generic_name ?? []
        if (!ingredients.length) {
          skip.noIngredient.add(l.set_id)
          continue
        }
        if (ingredients.length > 1) {
          skip.combination.add(l.set_id)
          continue
        }
        const drug = drugs.find(
          (d) =>
            (d.rxnorm && l.openfda?.rxcui?.includes(d.rxnorm)) ||
            [d.name, ...d.aliases].some((n) => sameIngredient(ingredients[0], n)),
        )
        if (!drug) {
          skip.notInCatalogue.add(ingredients[0].toLowerCase())
          continue
        }
        pairFor(food, drug).labels.set(l.set_id, l)
      }
    }

  // Skip pairs that already have a file (any status) or an Inherited interaction.
  const existing = new Set(raw.interactions.map((f) => stem(f.file)))
  const live = ds.interactions.filter((i) => i.status !== 'rejected')
  const candidates = [...pairs.entries()].filter(([id, p]) => {
    if (existing.has(id)) {
      skip.existing++
      return false
    }
    // Any of food/group × drug/class already resolves for this pair (spec §2 group resolution).
    const foods = [p.food.id, p.food.parent]
    const drugs = [p.drug.id, p.drug.parent]
    const covered = live.some((i) => foods.includes(i.food) && drugs.includes(i.drug))
    if (covered) skip.inherited++
    return !covered
  })

  // Most-mentioned pairs first.
  candidates.sort(([ia, a], [ib, b]) => mentionCount(b) - mentionCount(a) || ia.localeCompare(ib))
  const chosen = candidates.slice(0, options.limit ?? 25)

  const drafts: { id: string; data: Record<string, unknown>; excerpt: string }[] = []
  const discards: { id: string; reason: string }[] = []
  const invented: string[] = []
  for (const [id, p] of chosen) {
    // The evidence the drafter sees: `sources` are the texts an excerpt must appear in verbatim.
    let text: string
    let sources: string[]
    let citations: Record<string, string>[]
    if (source === 'foodrugs') {
      const top = [...p.pmids]
        .sort(([a, na], [b, nb]) => nb - na || Number(a) - Number(b))
        .slice(0, MAX_PMIDS)
      const found = []
      for (const [pmid] of top) {
        const art = await lookup<{ title: string; abstract: string }>(`pubmed:${pmid}`, () =>
          ports.pubmed!(pmid),
        )
        if (art?.abstract) found.push({ pmid, title: art.title, abstract: norm(art.abstract) })
      }
      if (!found.length) {
        fd.noAbstract.add(id)
        continue
      }
      sources = found.map((f) => f.abstract)
      text = found.map((f) => `[PMID ${f.pmid}] ${f.abstract}`).join('\n\n')
      citations = found.map((f) => ({
        type: 'study',
        title: f.title,
        url: `https://pubmed.ncbi.nlm.nih.gov/${f.pmid}/`,
        pmid: f.pmid,
      }))
    } else {
      const latest = [...p.labels.values()].sort((a, b) =>
        b.effective_time.localeCompare(a.effective_time),
      )[0]
      text = labelText(latest)
      sources = [text]
      const name = latest.openfda?.generic_name?.[0] ?? p.drug.name
      const maker = latest.openfda?.manufacturer_name?.[0]
      citations = [
        {
          type: 'label',
          title: maker ? `${name.toUpperCase()} [${maker}]` : name.toUpperCase(),
          url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${latest.set_id}`,
          setid: latest.set_id,
        },
      ]
    }
    const d = await ports.draft({
      food: p.food,
      drug: p.drug,
      text,
      mechanisms: ds.mechanisms,
      kind: source === 'foodrugs' ? 'abstract' : 'label',
    })
    if (!d.keep) {
      discards.push({ id, reason: d.reason })
      continue
    }
    if (!d.excerpt.trim() || !sources.some((t) => t.includes(d.excerpt))) {
      invented.push(id)
      continue
    }
    const known = new Set(ds.mechanisms.map((m) => m.id))
    const mechanisms = d.mechanisms.filter((m) => known.has(m))
    if (!mechanisms.length) {
      discards.push({ id, reason: 'no existing Mechanism fits (new Mechanisms are out of scope)' })
      continue
    }
    drafts.push({
      id,
      excerpt: d.excerpt,
      data: {
        id,
        food: p.food.id,
        drug: p.drug.id,
        mechanisms,
        severity: d.severity,
        effect: d.effect,
        summary: d.summary,
        advice: d.advice,
        details: d.details,
        citations,
        status: 'pending',
        source,
      },
    })
  }

  // Dataset validation on the merged result; abort on anything but the expected errors.
  const merged = validateDataset({
    ...raw,
    interactions: [
      ...raw.interactions,
      ...drafts.map((d) => ({ file: `interactions/${d.id}.yaml`, data: d.data })),
    ],
  })
  const errors = 'errors' in merged ? merged.errors : []
  const unexpected = errors.filter((e) => !EXPECTED.test(e))
  if (unexpected.length) throw new Error(`validation failed:\n${unexpected.join('\n')}`)
  const expectedErrors = errors

  const evidence = source === 'foodrugs' ? 'abstract' : 'label'
  const ranked = (m: Map<string, number>) =>
    [...m].sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).map(([n, c]) => `- ${n}: ${c}`)
  const skipped =
    source === 'foodrugs'
      ? [
          `- Drugs with a CUI not in the catalogue: ${fd.unknownCuis.size}`,
          `- Pairs whose PMIDs have no abstract: ${fd.noAbstract.size}`,
        ]
      : [
          `- Combination-product labels: ${skip.combination.size}`,
          `- Ingredients not in the catalogue: ${skip.notInCatalogue.size}`,
          `- Labels without ingredient data: ${skip.noIngredient.size}`,
        ]
  const report = [
    `## Proposed Pending interactions (${source === 'foodrugs' ? 'FooDrugs' : 'openFDA'})`,
    '',
    `${drafts.length} drafted from ${chosen.length} pairs. Every Severity below is suggested, confirm against the primary Citation. Excerpts are verbatim from the cited ${evidence} and appear only here.`,
    '',
    ...drafts.flatMap((d) => {
      const urls = (d.data.citations as { url: string }[]).map((c) => c.url)
      return [
        `### ${d.id}`,
        `- Severity: ${d.data.severity} (suggested, confirm against the primary Citation)`,
        `- Citation: ${urls.join(' ')}`,
        `- Excerpt: > ${d.excerpt}`,
        '',
      ]
    }),
    '## Discarded',
    ...(discards.length ? discards.map((d) => `- ${d.id}: ${d.reason}`) : ['- none']),
    '',
    `## Dropped (excerpt not found verbatim in the ${evidence})`,
    ...(invented.length ? invented.map((id) => `- ${id}`) : ['- none']),
    '',
    '## Skipped',
    `- Existing Interaction file: ${skip.existing}`,
    `- Covered by an Inherited interaction: ${skip.inherited}`,
    ...skipped,
    `- Pairs beyond the limit: ${candidates.length - chosen.length}`,
    '',
    ...(source === 'foodrugs'
      ? [
          '## Unmatched food names (by frequency)',
          ...(fd.unmatched.size ? ranked(fd.unmatched).slice(0, REPORT_NAMES) : ['- none']),
          '',
          '## Drug names that did not resolve to an RxNorm CUI (by frequency)',
          ...(fd.unresolved.size ? ranked(fd.unresolved).slice(0, REPORT_NAMES) : ['- none']),
          '',
        ]
      : []),
    '## Validation',
    ...(expectedErrors.length
      ? [
          'Expected until a reviewer Approves an Interaction for each:',
          ...expectedErrors.map((e) => `- ${e}`),
        ]
      : ['- clean']),
    '',
  ].join('\n')

  const written = drafts.map((d) => `${options.dataDir}/interactions/${d.id}.yaml`)
  drafts.forEach((d, i) => ports.writeFile(written[i], stringify(d.data)))
  ports.writeFile(options.reportPath, report)
  return { written, report, expectedErrors }
}
