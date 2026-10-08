import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parse } from 'yaml'
import { validateDataset, type Dataset, type RawDataset, type RawFile } from '@fdi/schema'

const KIND_DIRS = ['drugs', 'foods', 'mechanisms', 'interactions'] as const

function listYaml(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.yaml'))
      .sort()
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}

export function readDataDir(dir: string): RawDataset {
  const out: RawDataset = { drugs: [], foods: [], mechanisms: [], interactions: [] }
  for (const kind of KIND_DIRS) {
    for (const name of listYaml(join(dir, kind))) {
      const file = `${kind}/${name}`
      let data: unknown
      try {
        data = parse(readFileSync(join(dir, file), 'utf8'))
      } catch (e) {
        throw new Error(`${file}: ${(e as Error).message}`)
      }
      out[kind].push({ file, data } satisfies RawFile)
    }
  }
  return out
}

export function writeDb(ds: Dataset, outPath: string): string {
  const version = createHash('sha256').update(JSON.stringify(ds)).digest('hex').slice(0, 12)
  mkdirSync(dirname(outPath), { recursive: true })
  rmSync(outPath, { force: true })
  const db = new DatabaseSync(outPath)
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE drugs (id TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE foods (id TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE mechanisms (id TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE interactions (
      id TEXT PRIMARY KEY, food TEXT NOT NULL, drug TEXT NOT NULL,
      severity TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL
    );
  `)
  db.exec('BEGIN')
  db.prepare('INSERT INTO meta VALUES (?, ?)').run('version', version)
  for (const table of ['drugs', 'foods', 'mechanisms'] as const) {
    const insert = db.prepare(`INSERT INTO ${table} VALUES (?, ?)`)
    for (const e of ds[table]) insert.run(e.id, JSON.stringify(e))
  }
  const insert = db.prepare('INSERT INTO interactions VALUES (?, ?, ?, ?, ?, ?)')
  for (const i of ds.interactions) {
    insert.run(i.id, i.food, i.drug, i.severity, i.status, JSON.stringify(i))
  }
  db.exec('COMMIT')
  db.close()
  return version
}

export function buildDb(
  dataDir: string,
  outPath: string,
): { version: string } | { errors: string[] } {
  const result = validateDataset(readDataDir(dataDir))
  if ('errors' in result) return result
  return { version: writeDb(result.dataset, outPath) }
}
