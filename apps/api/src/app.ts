import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import type { Kind } from '@fdi/schema'
import { KINDS } from '@fdi/schema/domain'
import type { Store } from './store.ts'

const CACHE_CONTROL = 'public, max-age=300'

export function createApp(store: Store, opts: { staticDir?: string } = {}) {
  const app = new Hono()
  const etag = `"${store.version}"`

  app.use('/api/*', async (c, next) => {
    await next()
    if (c.res.status !== 200) return
    const tags = (c.req.header('if-none-match') ?? '').split(',').map((t) => t.trim().replace(/^W\//, ''))
    const headers = { ETag: etag, 'Cache-Control': CACHE_CONTROL }
    if (tags.includes(etag) || tags.includes('*')) {
      c.res = new Response(null, { status: 304, headers })
    } else {
      c.header('ETag', etag)
      c.header('Cache-Control', CACHE_CONTROL)
    }
  })

  app.get('/api/search', (c) => c.json(store.search(c.req.query('q') ?? '')))
  app.get('/api/graph', (c) => c.json(store.graph))
  app.get('/api/node/:kind/:id', (c) => {
    const kind = c.req.param('kind')
    const detail = (KINDS as readonly string[]).includes(kind)
      ? store.detail(kind as Kind, c.req.param('id'))
      : undefined
    return detail ? c.json(detail) : c.json({ error: 'not_found' }, 404)
  })
  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404))

  if (opts.staticDir) {
    app.use('/*', serveStatic({ root: opts.staticDir }))
    app.get('*', serveStatic({ path: `${opts.staticDir}/index.html` }))
  }
  return app
}
