import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Store } from './store.ts'

/** Writes the read API as static files: api/graph.json and api/node/{kind}/{id}.json. */
export function exportStatic(store: Store, outDir: string): void {
  const write = (path: string, body: unknown) => {
    const file = join(outDir, 'api', path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(body))
  }
  write('graph.json', store.graph)
  for (const { kind, id } of store.graph.nodes) {
    write(`node/${kind}/${id}.json`, store.detail(kind, id))
  }
}
