import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vite-plus/test'
import { createApp } from './app.ts'
import { buildDb } from './db/build.ts'
import { loadStore, type Store } from './store.ts'

let store: Store
let app: ReturnType<typeof createApp>
let spa: ReturnType<typeof createApp>

beforeAll(() => {
  const out = join(mkdtempSync(join(tmpdir(), 'fdi-')), 'data.db')
  const r = buildDb(join(import.meta.dirname, '../test/fixtures'), out)
  if ('errors' in r) throw new Error(r.errors.join('\n'))
  store = loadStore(out)
  app = createApp(store)
  const dir = mkdtempSync(join(tmpdir(), 'fdi-web-'))
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>spa</title>')
  writeFileSync(join(dir, 'app.js'), 'console.log(1)')
  spa = createApp(store, { staticDir: dir })
})

const get = (path: string, headers: Record<string, string> = {}) => app.request(path, { headers })

describe('API edges', () => {
  it('returns a JSON 404 for any other /api path', async () => {
    for (const path of ['/api', '/api/', '/api/nope', '/api/graph/extra']) {
      const res = await get(path)
      expect(res.status, path).toBe(404)
      expect(res.headers.get('content-type')).toContain('application/json')
      expect(await res.json()).toEqual({ error: 'not_found' })
    }
  })
  it('caches every 200 and 304s on a matching ETag', async () => {
    for (const path of ['/api/search?q=war', '/api/graph', '/api/node/drug/warfarin']) {
      const res = await get(path)
      expect(res.status, path).toBe(200)
      expect(res.headers.get('cache-control')).toBe('public, max-age=300')
      expect(res.headers.get('etag')).toBe(`"${store.version}"`)
      const again = await get(path, { 'if-none-match': `"${store.version}"` })
      expect(again.status, path).toBe(304)
    }
  })
  it('does not cache 404s', async () => {
    expect((await get('/api/nope')).headers.get('cache-control')).toBeNull()
  })
})

describe('static serving', () => {
  it('serves assets and falls back to index.html for SPA routes, never for /api', async () => {
    expect(await (await spa.request('/app.js')).text()).toBe('console.log(1)')
    const route = await spa.request('/explore/warfarin')
    expect(route.status).toBe(200)
    expect(await route.text()).toContain('<title>spa</title>')
    const api = await spa.request('/api/nope')
    expect(api.status).toBe(404)
    expect(await api.json()).toEqual({ error: 'not_found' })
  })
})
