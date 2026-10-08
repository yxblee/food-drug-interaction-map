import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vite-plus/test'
import type { GraphPayload, NodeDetail, SearchResult } from '@fdi/schema'
import { createApp } from './app.ts'
import { buildDb } from './db/build.ts'
import { loadStore, type Store } from './store.ts'

let store: Store
let app: ReturnType<typeof createApp>

beforeAll(() => {
  const out = join(mkdtempSync(join(tmpdir(), 'fdi-')), 'data.db')
  const r = buildDb(join(import.meta.dirname, '../test/fixtures'), out)
  if ('errors' in r) throw new Error(r.errors.join('\n'))
  store = loadStore(out)
  app = createApp(store)
})

const get = (path: string, headers: Record<string, string> = {}) => app.request(path, { headers })

describe('GET /api/search', () => {
  it('matches brand names', async () => {
    const body = (await (await get('/api/search?q=zoc')).json()) as SearchResult[]
    expect(body).toEqual([
      { kind: 'drug', id: 'simvastatin', name: 'Simvastatin', matched: 'Zocor', group: false },
    ])
  })
  it('ranks prefix before substring matches', async () => {
    const body = (await (await get('/api/search?q=gr')).json()) as SearchResult[]
    expect(body.map((r) => r.id)).toEqual(['grapefruit', 'leafy-greens'])
  })
  it('returns [] for empty or missing q', async () => {
    expect(await (await get('/api/search?q=')).json()).toEqual([])
    expect(await (await get('/api/search')).json()).toEqual([])
  })
  it('ignores case and treats special characters literally', async () => {
    const upper = (await (await get('/api/search?q=ZOC')).json()) as SearchResult[]
    expect(upper.map((r) => r.id)).toEqual(['simvastatin'])
    for (const q of ['(', '.*', '%', '%20%20', '+']) {
      const res = await get(`/api/search?q=${q}`)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    }
  })
  it('returns [] for whitespace-only q', async () => {
    expect(await (await get('/api/search?q=%20%20')).json()).toEqual([])
  })
  it('flags groups', async () => {
    const body = (await (await get('/api/search?q=leafy')).json()) as SearchResult[]
    expect(body[0]).toMatchObject({ id: 'leafy-greens', group: true })
  })
})

describe('GET /api/graph', () => {
  it('returns all nodes and approved interactions without heavy fields', async () => {
    const body = (await (await get('/api/graph')).json()) as GraphPayload
    expect(body.version).toBe(store.version)
    expect(body.nodes).toHaveLength(10)
    expect(body.interactions.map((i) => i.id).sort()).toEqual([
      'citrus--statins',
      'grapefruit--simvastatin',
      'leafy-greens--warfarin',
      'orange--simvastatin',
    ])
    expect(body.interactions[0]).not.toHaveProperty('details')
    expect(body.interactions[0]).not.toHaveProperty('citations')
  })
  it('sets cache headers and honours If-None-Match', async () => {
    const res = await get('/api/graph')
    expect(res.headers.get('cache-control')).toBe('public, max-age=300')
    const etag = res.headers.get('etag')
    expect(etag).toBe(`"${store.version}"`)
    expect((await get('/api/graph', { 'if-none-match': etag! })).status).toBe(304)
  })
})

describe('GET /api/node/:kind/:id', () => {
  it('resolves inherited group interactions with via', async () => {
    const body = (await (await get('/api/node/food/kale')).json()) as NodeDetail
    expect(body.parent?.id).toBe('leafy-greens')
    expect(body.interactions.map((r) => [r.interaction.id, r.via])).toEqual([
      ['leafy-greens--warfarin', 'leafy-greens'],
    ])
    expect(body.interactions[0].interaction.citations[0].title).toBe('Fixture citation')
    expect(body.mechanisms['vitamin-k-antagonism'].explanation).toBe('Fixture explanation.')
    expect(body.nodes['drug:warfarin'].name).toBe('Warfarin')
  })
  it('lets exact interactions beat class ones and excludes pending', async () => {
    const body = (await (await get('/api/node/drug/simvastatin')).json()) as NodeDetail
    expect(body.interactions.map((r) => [r.interaction.id, r.via])).toEqual([
      ['grapefruit--simvastatin', undefined],
      ['citrus--statins', 'statins'],
      ['orange--simvastatin', undefined],
    ])
  })
  it('lists children of a group', async () => {
    const body = (await (await get('/api/node/food/citrus')).json()) as NodeDetail
    expect(body.children.map((c) => c.id)).toEqual(['grapefruit', 'orange'])
  })
  it('404s on unknown kinds, ids and odd paths', async () => {
    for (const path of [
      '/api/node/drug/nope',
      '/api/node/plant/kale',
      '/api/node/drug/..%2F..',
      '/api/node/drug/WARFARIN',
    ]) {
      const res = await get(path)
      expect(res.status, path).toBe(404)
      expect(await res.json()).toEqual({ error: 'not_found' })
    }
  })
})
