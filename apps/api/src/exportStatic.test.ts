import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vite-plus/test'
import type { GraphPayload, NodeDetail } from '@fdi/schema'
import { buildDb } from './db/build.ts'
import { exportStatic } from './exportStatic.ts'
import { loadStore, type Store } from './store.ts'

let store: Store
let out: string
const read = <T>(path: string): T => JSON.parse(readFileSync(join(out, path), 'utf8')) as T

beforeAll(() => {
  const db = join(mkdtempSync(join(tmpdir(), 'fdi-')), 'data.db')
  const r = buildDb(join(import.meta.dirname, '../test/fixtures'), db)
  if ('errors' in r) throw new Error(r.errors.join('\n'))
  store = loadStore(db)
  out = mkdtempSync(join(tmpdir(), 'fdi-static-'))
  exportStatic(store, out)
})

describe('static export', () => {
  it('writes the graph and one detail file per Drug, Food and Mechanism', () => {
    const files = readdirSync(out, { recursive: true, withFileTypes: true })
      .filter((f) => f.isFile())
      .map((f) => join(f.parentPath, f.name).slice(out.length + 1))
      .sort()
    expect(files).toEqual([
      'api/graph.json',
      'api/node/drug/simvastatin.json',
      'api/node/drug/statins.json',
      'api/node/drug/warfarin.json',
      'api/node/food/grapefruit.json',
      'api/node/food/kale.json',
      'api/node/food/leafy-greens.json',
      'api/node/food/orange.json',
      'api/node/food/sample-fruits.json',
      'api/node/mechanism/cyp3a4-inhibition.json',
      'api/node/mechanism/vitamin-k-antagonism.json',
    ])
  })

  it('publishes only Approved interactions', () => {
    const graph = read<GraphPayload>('api/graph.json')
    expect(graph.interactions.map((i) => i.id).sort()).toEqual([
      'grapefruit--simvastatin',
      'leafy-greens--warfarin',
      'orange--simvastatin',
      'sample-fruits--statins',
    ])
  })

  it('serves the same payloads as the read API, including Inherited interactions', () => {
    expect(read('api/graph.json')).toEqual(store.graph)
    const kale = read<NodeDetail>('api/node/food/kale.json')
    expect(kale.interactions.map((r) => r.interaction.id)).toEqual(['leafy-greens--warfarin'])
    expect(kale).toEqual(store.detail('food', 'kale'))
  })
})
