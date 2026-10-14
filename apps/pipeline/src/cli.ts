// Thin CLI wrapper: builds the real ports and calls runPipeline. Not unit tested (see pipeline.test.ts).
//   node apps/pipeline/src/cli.ts --source openfda --limit 25
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { readDataDir } from '../../api/src/db/build.ts'
import {
  Draft,
  SECTIONS,
  runPipeline,
  type DraftInput,
  type Label,
  type Ports,
} from './pipeline.ts'

const CACHE_DIR = '.cache/pipeline'
const MODEL = 'claude-sonnet-5-5'
const PAGE = 100
const MAX_PAGES = 5 // ponytail: first 500 labels per term; raise if a term needs more

const write = (path: string, content: string) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

async function searchLabels(term: string): Promise<Label[]> {
  const q = SECTIONS.map((s) => `${s}:"${term.replaceAll('"', '')}"`).join(' OR ')
  const labels: Label[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      search: q,
      limit: String(PAGE),
      skip: String(page * PAGE),
    })
    if (process.env.OPENFDA_API_KEY) params.set('api_key', process.env.OPENFDA_API_KEY)
    const res = await fetch(`https://api.fda.gov/drug/label.json?${params}`)
    if (res.status === 404) break // openFDA's "no matches"
    if (!res.ok) throw new Error(`openFDA ${res.status} for "${term}"`)
    const { results } = (await res.json()) as { results: Label[] }
    labels.push(...results)
    if (results.length < PAGE) break
  }
  return labels
}

const SYSTEM = `You help curate a public reference on food-drug interactions from US drug label text.
Decide whether the label text documents a real interaction between the given Food and Drug, i.e. the Food changes the Drug's action.
Discard (keep=false, with a short reason) incidental mentions such as an excipient ("benzyl alcohol"), "no clinically significant food effect", or mentions about a different drug.
When keeping, write summary, advice and details in your own words for a general reader, without copying label sentences.
Prefer the provided mechanism ids. Only when none fits, propose a new Mechanism in new_mechanisms (kebab-case id, name, kind, one or two plain-language sentences) and also list its id in mechanisms; otherwise leave new_mechanisms empty.
When Drug classes are provided the Drug is new to the catalogue: set parent to the id of the one class it belongs to, or '' if none clearly fits. Never invent a class. With no classes provided, set parent to ''.
Severity is only a suggestion: avoid, caution, monitor or minimal.
Give excerpt as one short passage copied character for character from the label text. If you cannot, discard.`

let client: Anthropic | undefined
async function draft({ food, drug, text, mechanisms, classes }: DraftInput): Promise<Draft> {
  client ??= new Anthropic() // reads ANTHROPIC_API_KEY
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(Draft) },
    messages: [
      {
        role: 'user',
        content: [
          `Food: ${food.name}${food.aliases.length ? ` (also: ${food.aliases.join(', ')})` : ''}`,
          `Drug: ${drug.name}`,
          ...(classes.length
            ? [
                `Drug classes (choose parent from these):\n${classes.map((c) => `- ${c.id}: ${c.name}`).join('\n')}`,
              ]
            : []),
          `Mechanisms:\n${mechanisms.map((m) => `- ${m.id}: ${m.name} (${m.kind})`).join('\n')}`,
          `Label text:\n${text}`,
        ].join('\n\n'),
      },
    ],
  })
  if (res.stop_reason === 'refusal') throw new Error(`model refused ${food.id}--${drug.id}`)
  if (!res.parsed_output) throw new Error(`no structured output for ${food.id}--${drug.id}`)
  return res.parsed_output
}

// RxNav: name -> ingredient (tty IN) CUI. ponytail: first exact-or-normalised hit, no retries.
async function ingredientCui(name: string): Promise<string | undefined> {
  const q = new URLSearchParams({ name, search: '2' })
  const res = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?${q}`)
  if (!res.ok) throw new Error(`RxNav ${res.status} for "${name}"`)
  const ids = ((await res.json()) as { idGroup?: { rxnormId?: string[] } }).idGroup?.rxnormId ?? []
  for (const id of ids) {
    const p = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui/${id}/properties.json`)
    if (p.ok && (await p.json()).properties?.tty === 'IN') return id
  }
}

const cachePath = (key: string) =>
  join(CACHE_DIR, `${createHash('sha1').update(key).digest('hex')}.json`)
const ports: Ports = {
  searchLabels,
  draft,
  ingredientCui,
  readDataset: readDataDir,
  writeFile: write,
  cache: {
    get: async (key) => {
      try {
        return readFileSync(cachePath(key), 'utf8')
      } catch {
        return undefined
      }
    },
    set: async (key, value) => write(cachePath(key), value),
  },
}

try {
  process.loadEnvFile('.env')
} catch {
  // no .env: use the process environment
}
const { values } = parseArgs({ options: { source: { type: 'string' }, limit: { type: 'string' } } })
if (values.source !== 'openfda') {
  console.error('usage: pipeline --source openfda [--limit N]')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set (put it in a gitignored .env)')
  process.exit(1)
}
try {
  const reportPath = join(CACHE_DIR, 'pr-body-openfda.md')
  const r = await runPipeline(
    'openfda',
    { limit: values.limit ? Number(values.limit) : 25, dataDir: 'data', reportPath },
    ports,
  )
  console.log(
    `Wrote ${r.written.length} files (Pending interactions, plus any proposed Drugs and Mechanisms) and ${reportPath}`,
  )
  for (const f of r.written) console.log(`  ${f}`)
} catch (e) {
  console.error((e as Error).message)
  process.exit(1)
}
