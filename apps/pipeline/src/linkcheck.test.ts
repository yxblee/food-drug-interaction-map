import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'
import { checkLinks, extractCitationUrls, type Fetcher } from './linkcheck.ts'

const FIXTURE = fileURLToPath(new URL('./fixtures/linkcheck', import.meta.url))
const ref = (url: string, id = 'a--b') => ({ url, file: `data/interactions/${id}.yaml`, id })
const res = (status: number, location?: string) => ({ status, location })

function fake(table: Record<string, (method: string) => ReturnType<Fetcher> | never>) {
  const calls: string[] = []
  const fetcher: Fetcher = async (url, init) => {
    calls.push(`${init.method} ${url}`)
    return table[url]!(init.method)
  }
  return { fetcher, calls }
}

describe('extractCitationUrls', () => {
  it('finds Interaction and Pairing citations and Drug links, with file and id', () => {
    const refs = extractCitationUrls(FIXTURE)
    const key = (r: { url: string; id: string }) => `${r.id} ${r.url}`
    expect(refs.map(key).sort()).toEqual(
      [
        'grapefruit--statin https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=11111111-2222-3333-4444-555555555555',
        'grapefruit--statin https://example.org/review',
        'oats--statin https://example.org/review',
        'statin https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=11111111-2222-3333-4444-555555555555',
        'statin https://medlineplus.gov/druginfo/meds/a1.html',
      ].sort(),
    )
    expect(refs.find((r) => r.id === 'oats--statin')!.file).toMatch(/pairings\/oats--statin\.yaml$/)
  })
})

describe('checkLinks', () => {
  it('passes a 200', async () => {
    const { fetcher } = fake({ 'https://a.org/x': () => Promise.resolve(res(200)) })
    expect(await checkLinks([ref('https://a.org/x')], fetcher)).toEqual([])
  })

  it('reports 404 as a hard failure with file and id', async () => {
    const { fetcher } = fake({ 'https://a.org/x': () => Promise.resolve(res(404)) })
    const [f] = await checkLinks([ref('https://a.org/x', 'gone')], fetcher)
    expect(f).toMatchObject({ severity: 'hard', detail: '404' })
    expect(f!.refs[0]).toMatchObject({ id: 'gone', file: 'data/interactions/gone.yaml' })
  })

  it('reports a DNS failure as hard', async () => {
    const { fetcher } = fake({
      'https://a.org/x': () => {
        throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } })
      },
    })
    expect((await checkLinks([ref('https://a.org/x')], fetcher))[0]).toMatchObject({
      severity: 'hard',
    })
  })

  it('warns on a redirect to another host, not on one within the host', async () => {
    const { fetcher } = fake({
      'https://a.org/x': () => Promise.resolve(res(301, 'https://b.org/y')),
      'https://a.org/z': () => Promise.resolve(res(301, '/elsewhere')),
    })
    const out = await checkLinks([ref('https://a.org/x'), ref('https://a.org/z')], fetcher)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ severity: 'warn', url: 'https://a.org/x' })
  })

  it('warns on a timeout', async () => {
    const { fetcher } = fake({
      'https://a.org/x': () => {
        throw new DOMException('timed out', 'TimeoutError')
      },
    })
    expect((await checkLinks([ref('https://a.org/x')], fetcher))[0]).toMatchObject({
      severity: 'warn',
      detail: 'timeout',
    })
  })

  it('warns on other non-2xx, such as a 403 from a bot-blocking host', async () => {
    const { fetcher } = fake({ 'https://a.org/x': () => Promise.resolve(res(403)) })
    expect((await checkLinks([ref('https://a.org/x')], fetcher))[0]).toMatchObject({
      severity: 'warn',
      detail: '403',
    })
  })

  it('fetches a duplicate URL once and lists every place it appears', async () => {
    const { fetcher, calls } = fake({ 'https://a.org/x': () => Promise.resolve(res(404)) })
    const out = await checkLinks(
      [ref('https://a.org/x', 'one'), ref('https://a.org/x', 'two')],
      fetcher,
    )
    expect(calls).toEqual(['HEAD https://a.org/x'])
    expect(out[0]!.refs.map((r) => r.id)).toEqual(['one', 'two'])
  })

  it('falls back to GET when HEAD is refused with 405', async () => {
    const { fetcher, calls } = fake({
      'https://a.org/x': (m) => Promise.resolve(res(m === 'HEAD' ? 405 : 200)),
    })
    expect(await checkLinks([ref('https://a.org/x')], fetcher)).toEqual([])
    expect(calls).toEqual(['HEAD https://a.org/x', 'GET https://a.org/x'])
  })
})
