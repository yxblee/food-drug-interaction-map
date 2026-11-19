// Citation link check: reads every citation URL under data/, requests each once, reports problems.
// Reads data/ only; never writes to it. Hard failures (404/410, DNS) fail the run; the rest warn.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

export interface UrlRef {
  url: string
  file: string
  id: string
}
export interface Finding {
  url: string
  severity: 'hard' | 'warn'
  detail: string
  refs: UrlRef[]
}
export type Fetcher = (
  url: string,
  init: { method: 'HEAD' | 'GET'; signal: AbortSignal },
) => Promise<{ status: number; location?: string }>

const DAILYMED = 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid='

function yamlFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.yaml'))
      .sort()
      .map((f) => join(dir, f))
  } catch {
    return []
  }
}

// Interaction and Pairing citations, plus each Drug's MedlinePlus page and DailyMed label.
export function extractCitationUrls(dataDir: string): UrlRef[] {
  const refs: UrlRef[] = []
  for (const folder of ['interactions', 'pairings', 'drugs']) {
    for (const file of yamlFiles(join(dataDir, folder))) {
      const doc = parse(readFileSync(file, 'utf8')) as Record<string, unknown>
      const id = String(doc.id)
      const urls: unknown[] =
        folder === 'drugs'
          ? [
              doc.medlineplus,
              typeof doc.dailymed === 'string' ? DAILYMED + doc.dailymed : undefined,
            ]
          : ((doc.citations as { url?: unknown }[] | undefined) ?? []).map((c) => c.url)
      for (const url of urls) if (typeof url === 'string') refs.push({ url, file, id })
    }
  }
  return refs
}

type Verdict = { severity: 'hard' | 'warn'; detail: string } | null

async function probe(url: string, fetcher: Fetcher, timeoutMs: number): Promise<Verdict> {
  const request = (method: 'HEAD' | 'GET') =>
    fetcher(url, { method, signal: AbortSignal.timeout(timeoutMs) })
  try {
    let r = await request('HEAD')
    // HEAD not supported: retry with GET.
    if (r.status === 405 || r.status === 501) r = await request('GET')
    if (r.status >= 200 && r.status < 300) return null
    if (r.status >= 300 && r.status < 400) {
      const to = r.location ? new URL(r.location, url) : undefined
      return to && to.host !== new URL(url).host
        ? { severity: 'warn', detail: `redirect to ${to.href}` }
        : null
    }
    return {
      severity: r.status === 404 || r.status === 410 ? 'hard' : 'warn',
      detail: `${r.status}`,
    }
  } catch (e) {
    const err = e as { name?: string; cause?: { code?: string } }
    if (err.name === 'TimeoutError' || err.name === 'AbortError')
      return { severity: 'warn', detail: 'timeout' }
    if (err.cause?.code === 'ENOTFOUND') return { severity: 'hard', detail: 'DNS error' }
    return { severity: 'warn', detail: `error: ${(e as Error).message}` }
  }
}

export async function checkLinks(
  refs: UrlRef[],
  fetcher: Fetcher,
  { concurrency = 4, timeoutMs = 10_000 } = {},
): Promise<Finding[]> {
  const byUrl = new Map<string, UrlRef[]>()
  for (const r of refs) byUrl.set(r.url, [...(byUrl.get(r.url) ?? []), r])
  const queue = [...byUrl.entries()]
  const findings: Finding[] = []
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [url, urlRefs] = next
        const v = await probe(url, fetcher, timeoutMs)
        if (v) findings.push({ url, ...v, refs: urlRefs })
      }
    }),
  )
  return findings.sort((a, b) => a.url.localeCompare(b.url))
}

export function formatFindings(findings: Finding[]): string {
  const rows = findings.flatMap((f) =>
    f.refs.map(
      (r) =>
        `${f.severity === 'hard' ? 'FAIL' : 'warn'}\t${f.detail}\t${r.file}\t${r.id}\t${f.url}`,
    ),
  )
  return ['level\tproblem\tfile\tid\turl', ...rows].join('\n')
}

const realFetcher: Fetcher = async (url, { method, signal }) => {
  const res = await fetch(url, {
    method,
    signal,
    redirect: 'manual',
    headers: {
      'user-agent':
        'food-drug-interaction-map link check (+https://github.com/yxblee/food-drug-interaction-map)',
    },
  })
  return { status: res.status, location: res.headers.get('location') ?? undefined }
}

// CLI entry (not unit tested). Returns the process exit code.
export async function runCheckLinks(dataDir: string): Promise<number> {
  const refs = extractCitationUrls(dataDir)
  const findings = await checkLinks(refs, realFetcher)
  const hard = findings.filter((f) => f.severity === 'hard')
  console.log(
    `${new Set(refs.map((r) => r.url)).size} URLs checked: ${hard.length} failed, ${findings.length - hard.length} warnings`,
  )
  if (findings.length) console.log(formatFindings(findings))
  return hard.length ? 1 : 0
}
