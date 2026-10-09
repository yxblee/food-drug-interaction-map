import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { loadStore } from './store.ts'

const port = Number(process.env.PORT ?? 8787)
const store = loadStore(process.env.DB_PATH ?? 'dist/data.db')
serve({ fetch: createApp(store, { staticDir: process.env.STATIC_DIR }).fetch, port })
console.log(`API listening on :${port} (data version ${store.version})`)
