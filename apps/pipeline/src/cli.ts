// Thin CLI wrapper: builds the real ports and calls runPipeline. Not unit tested (see pipeline.test.ts).
//   node apps/pipeline/src/cli.ts --source openfda --limit 25
//   node apps/pipeline/src/cli.ts --source foodrugs --limit 25   (needs .cache/pipeline/FinalFooDrugs_v4.sql)
//   node apps/pipeline/src/cli.ts --source ddid --limit 25        (needs .cache/pipeline/DDID-Interaction.csv)
//   add --drafter claude-code to draft through a headless `claude -p` session instead of the API
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { readDataDir } from '../../api/src/db/build.ts'
import { dumpLines } from './foodrugs.ts'
import {
  Draft,
  SECTIONS,
  runPipeline,
  type DdidPorts,
  type DraftInput,
  type FooDrugsPorts,
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

// Free APIs rate-limit (PubMed: 3 requests/s without a key); back off and retry on 429.
async function politeFetch(url: string) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url)
    if (res.status !== 429 || attempt === 6) return res
    await new Promise((r) => setTimeout(r, 1000 * attempt))
  }
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
    const res = await politeFetch(`https://api.fda.gov/drug/label.json?${params}`)
    if (res.status === 404) break // openFDA's "no matches"
    if (!res.ok) throw new Error(`openFDA ${res.status} for "${term}"`)
    const { results } = (await res.json()) as { results: Label[] }
    labels.push(...results)
    if (results.length < PAGE) break
  }
  return labels
}

const system = (
  what: string,
) => `You help curate a public reference on food-drug interactions from ${what === 'label' ? 'US drug label' : 'PubMed abstract'} text.
Decide whether the ${what} text documents a real interaction between the given Food and Drug, i.e. the Food changes the Drug's action.
Discard (keep=false, with a short reason) incidental mentions such as an excipient ("benzyl alcohol"), "no clinically significant food effect", or mentions about a different food or drug.
When keeping, write summary, advice and details in your own words for a general reader, without copying ${what} sentences.
Prefer the provided mechanism ids. Only when none fits, propose a new Mechanism in new_mechanisms (kebab-case id, name, kind, one or two plain-language sentences about how it works for any food or drug, not this pair) and also list its id in mechanisms; otherwise leave new_mechanisms empty.
When Drug classes are provided the Drug is new to the catalogue: set parent to the id of the one class it belongs to, or '' if none clearly fits. Never invent a class. With no classes provided, set parent to ''.
Severity is only a suggestion: avoid, caution, monitor or minimal.
Give excerpt as one short passage copied character for character from the ${what} text${what === 'label' ? '' : ' (from a single abstract, without the [PMID] tag)'}. If you cannot, discard.`

let client: Anthropic | undefined
async function draft({
  food,
  drug,
  text,
  mechanisms,
  classes,
  kind = 'label',
}: DraftInput): Promise<Draft> {
  const sys = system(kind === 'label' ? 'label' : 'abstract')
  const content = [
    `Food: ${food.name}${food.aliases.length ? ` (also: ${food.aliases.join(', ')})` : ''}`,
    `Drug: ${drug.name}`,
    ...(classes.length
      ? [
          `Drug classes (choose parent from these):\n${classes.map((c) => `- ${c.id}: ${c.name}`).join('\n')}`,
        ]
      : []),
    `Mechanisms:\n${mechanisms.map((m) => `- ${m.id}: ${m.name} (${m.kind})`).join('\n')}`,
    `${kind === 'label' ? 'Label' : 'Abstract'} text:\n${text}`,
  ].join('\n\n')
  if (values.drafter === 'claude-code') return claudeCode(sys, content, `${food.id}--${drug.id}`)
  client ??= new Anthropic() // reads ANTHROPIC_API_KEY
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: sys,
    output_config: { format: zodOutputFormat(Draft) },
    messages: [{ role: 'user', content }],
  })
  if (res.stop_reason === 'refusal') throw new Error(`model refused ${food.id}--${drug.id}`)
  if (!res.parsed_output) throw new Error(`no structured output for ${food.id}--${drug.id}`)
  return res.parsed_output
}

// A separate, tool-less Claude Code session (the user's Claude login, no API key) drafts one pair.
function claudeCode(sys: string, content: string, id: string): Draft {
  const out = execFileSync(
    'claude',
    [
      '-p',
      '--model',
      'sonnet',
      '--system-prompt',
      sys,
      '--json-schema',
      JSON.stringify({ ...z.toJSONSchema(Draft), $schema: undefined }), // claude rejects the 2020-12 $schema
      '--output-format',
      'json',
      '--tools',
      '',
      '--setting-sources',
      '',
      '--strict-mcp-config',
      '--disable-slash-commands',
      '--no-session-persistence',
    ],
    { input: content, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  )
  const res = JSON.parse(out) as { is_error: boolean; result: string; structured_output?: unknown }
  if (res.is_error || !res.structured_output)
    throw new Error(`no structured output for ${id}: ${res.result}`)
  return Draft.parse(res.structured_output)
}

// RxNav: drug name -> ingredient RxNorm CUI. A brand name ("Zocor") resolves to its ingredient;
// a combination product (several ingredients) does not resolve.
async function ingredientCui(name: string): Promise<string | undefined> {
  const get = async (path: string) => {
    const res = await politeFetch(`https://rxnav.nlm.nih.gov/REST/${path}`)
    if (!res.ok) throw new Error(`RxNav ${res.status} for "${name}"`)
    return (await res.json()) as Record<string, any>
  }
  const found = await get(`rxcui.json?${new URLSearchParams({ name, search: '2' })}`)
  const cui = found.idGroup?.rxnormId?.[0] as string | undefined
  if (!cui) return undefined
  const related = await get(`rxcui/${cui}/related.json?tty=IN`)
  const ingredients = (related.relatedGroup?.conceptGroup ?? []).flatMap(
    (g: any) => g.conceptProperties ?? [],
  )
  return ingredients.length === 1 ? (ingredients[0].rxcui as string) : undefined
}

const xmlText = (xml: string) =>
  xml
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

// PubMed E-utilities efetch: title and abstract of one PMID (labelled sections joined by a space).
async function pubmed(pmid: string) {
  const params = new URLSearchParams({ db: 'pubmed', id: pmid, retmode: 'xml' })
  if (process.env.NCBI_API_KEY) params.set('api_key', process.env.NCBI_API_KEY)
  const res = await politeFetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${params}`,
  )
  if (!res.ok) throw new Error(`PubMed ${res.status} for PMID ${pmid}`)
  const xml = await res.text()
  const title = /<ArticleTitle[^>]*>([^]*?)<\/ArticleTitle>/.exec(xml)?.[1]
  const sections = [...xml.matchAll(/<AbstractText[^>]*>([^]*?)<\/AbstractText>/g)].map((m) =>
    xmlText(m[1]),
  )
  return title && sections.length
    ? { title: xmlText(title), abstract: sections.join(' ') }
    : undefined
}

const DUMP = join(CACHE_DIR, 'FinalFooDrugs_v4.sql')
function foodrugsLines() {
  if (!existsSync(DUMP))
    throw new Error(
      `${DUMP} not found. Download FinalFooDrugs_v4.sql (about 1.6 GB, CC BY 4.0) from https://zenodo.org/records/6638469 into ${CACHE_DIR}/.`,
    )
  return dumpLines(DUMP)
}

const DDID = join(CACHE_DIR, 'DDID-Interaction.csv')
function ddidCsv() {
  if (!existsSync(DDID))
    throw new Error(
      `${DDID} not found. Download "Interaction Information.csv" from https://bddg.hznu.edu.cn/ddid/download/ and save it as ${DDID}.`,
    )
  return readFileSync(DDID, 'utf8')
}

const cachePath = (key: string) =>
  join(CACHE_DIR, `${createHash('sha1').update(key).digest('hex')}.json`)
const ports: Ports & FooDrugsPorts & DdidPorts = {
  searchLabels,
  foodrugsLines,
  ddidCsv,
  pubmed,
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
const { values } = parseArgs({
  options: { source: { type: 'string' }, limit: { type: 'string' }, drafter: { type: 'string' } },
})
const source = values.source
if (source !== 'openfda' && source !== 'foodrugs' && source !== 'ddid') {
  console.error('usage: pipeline --source openfda|foodrugs|ddid [--limit N]')
  process.exit(1)
}
if (values.drafter !== 'claude-code' && !process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set (put it in a gitignored .env, or pass --drafter claude-code)',
  )
  process.exit(1)
}
try {
  const reportPath = join(CACHE_DIR, `pr-body-${source}.md`)
  const r = await runPipeline(
    source,
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
