import { stringify } from 'yaml'
import { z } from 'zod'
import { validateDataset, Drug, Food, Interaction, Mechanism, Severity } from '@fdi/schema'
import type { RawDataset } from '@fdi/schema'
import { buildIndex, interactionsForDrug, interactionsForFood } from '@fdi/schema/domain'

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
  labels: Map<string, Label>
}

export async function runPipeline(
  source: 'openfda',
  options: Options,
  ports: Ports,
): Promise<Result> {
  if (source !== 'openfda') throw new Error(`unsupported source: ${source}`)
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
      const key = `${food.id}--${drug.id}`
      const pair = pairs.get(key) ?? { food, drug, labels: new Map() }
      pair.labels.set(l.set_id, l)
      pairs.set(key, pair)
    }
  }

  // Skip pairs that already have a file (any status) or an Inherited interaction.
  const existing = new Set(raw.interactions.map((f) => stem(f.file)))
  const node = (kind: 'drug' | 'food') => (e: Drug | Food) => ({
    kind,
    id: e.id,
    name: e.name,
    aliases: e.aliases,
    group: e.group,
    parent: e.parent,
  })
  const ix = buildIndex(
    [...ds.drugs.map(node('drug')), ...ds.foods.map(node('food'))],
    ds.interactions.filter((i) => i.status !== 'rejected'),
  )
  const candidates = [...pairs.entries()].filter(([id, p]) => {
    if (existing.has(id)) {
      skip.existing++
      return false
    }
    const covered =
      interactionsForDrug(ix, p.drug.id).some((r) => r.interaction.food === p.food.id) ||
      interactionsForFood(ix, p.food.id).some((r) => r.interaction.drug === p.drug.id)
    if (covered) skip.inherited++
    return !covered
  })

  // Most-mentioned pairs first.
  candidates.sort(([ia, a], [ib, b]) => b.labels.size - a.labels.size || ia.localeCompare(ib))
  const chosen = candidates.slice(0, options.limit ?? 25)

  const drafts: { id: string; data: Record<string, unknown>; excerpt: string }[] = []
  const discards: { id: string; reason: string }[] = []
  const invented: string[] = []
  for (const [id, p] of chosen) {
    const latest = [...p.labels.values()].sort((a, b) =>
      b.effective_time.localeCompare(a.effective_time),
    )[0]
    const text = labelText(latest)
    const d = await ports.draft({ food: p.food, drug: p.drug, text, mechanisms: ds.mechanisms })
    if (!d.keep) {
      discards.push({ id, reason: d.reason })
      continue
    }
    if (!d.excerpt.trim() || !text.includes(d.excerpt)) {
      invented.push(id)
      continue
    }
    const known = new Set(ds.mechanisms.map((m) => m.id))
    const mechanisms = d.mechanisms.filter((m) => known.has(m))
    if (!mechanisms.length) {
      discards.push({ id, reason: 'no existing Mechanism fits (new Mechanisms are out of scope)' })
      continue
    }
    const name = latest.openfda?.generic_name?.[0] ?? p.drug.name
    const maker = latest.openfda?.manufacturer_name?.[0]
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
        citations: [
          {
            type: 'label',
            title: maker ? `${name.toUpperCase()} [${maker}]` : name.toUpperCase(),
            url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${latest.set_id}`,
            setid: latest.set_id,
          },
        ],
        status: 'pending',
        source: 'openfda',
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

  const report = [
    '## Proposed Pending interactions (openFDA)',
    '',
    `${drafts.length} drafted from ${chosen.length} pairs. Every Severity below is suggested, confirm against the primary Citation. Excerpts are verbatim from the cited label and appear only here.`,
    '',
    ...drafts.flatMap((d) => {
      const c = (d.data.citations as { url: string }[])[0]
      return [
        `### ${d.id}`,
        `- Severity: ${d.data.severity} (suggested, confirm against the primary Citation)`,
        `- Citation: ${c.url}`,
        `- Excerpt: > ${d.excerpt}`,
        '',
      ]
    }),
    '## Discarded',
    ...(discards.length ? discards.map((d) => `- ${d.id}: ${d.reason}`) : ['- none']),
    '',
    '## Dropped (excerpt not found verbatim in the label)',
    ...(invented.length ? invented.map((id) => `- ${id}`) : ['- none']),
    '',
    '## Skipped',
    `- Existing Interaction file: ${skip.existing}`,
    `- Covered by an Inherited interaction: ${skip.inherited}`,
    `- Combination-product labels: ${skip.combination.size}`,
    `- Ingredients not in the catalogue: ${skip.notInCatalogue.size}`,
    `- Labels without ingredient data: ${skip.noIngredient.size}`,
    `- Pairs beyond the limit: ${candidates.length - chosen.length}`,
    '',
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
