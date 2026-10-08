import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vite-plus/test'
import { buildDb, readDataDir } from './build.ts'

const FIXTURES = join(import.meta.dirname, '../../test/fixtures')
const tmp = () => mkdtempSync(join(tmpdir(), 'fdi-'))

describe('readDataDir', () => {
  it('reads every yaml file per kind with its relative path', () => {
    const raw = readDataDir(FIXTURES)
    expect(raw.drugs.map((f) => f.file)).toEqual([
      'drugs/simvastatin.yaml',
      'drugs/statins.yaml',
      'drugs/warfarin.yaml',
    ])
    expect(raw.interactions).toHaveLength(5)
  })
  it('keeps unquoted dates as strings', () => {
    const raw = readDataDir(FIXTURES)
    expect((raw.interactions[0].data as { reviewed_at: unknown }).reviewed_at).toBe('2026-10-08')
  })
  it('names the file on YAML syntax errors', () => {
    const dir = tmp()
    mkdirSync(join(dir, 'drugs'))
    writeFileSync(join(dir, 'drugs/bad.yaml'), 'id: [unclosed')
    expect(() => readDataDir(dir)).toThrow(/^drugs\/bad\.yaml: /)
  })
})

describe('buildDb', () => {
  it('writes all entities and a version', () => {
    const out = join(tmp(), 'data.db')
    const r = buildDb(FIXTURES, out)
    expect('version' in r && r.version).toMatch(/^[0-9a-f]{12}$/)
    const db = new DatabaseSync(out, { readOnly: true })
    expect(db.prepare('SELECT count(*) AS n FROM interactions').get()).toEqual({ n: 5 })
    expect(db.prepare("SELECT value FROM meta WHERE key = 'version'").get()).toEqual({
      value: 'version' in r ? r.version : '',
    })
    db.close()
  })
  it('is deterministic', () => {
    const a = buildDb(FIXTURES, join(tmp(), 'a.db'))
    const b = buildDb(FIXTURES, join(tmp(), 'b.db'))
    expect(a).toEqual(b)
  })
  it('changes the version when content changes', () => {
    const dir = tmp()
    mkdirSync(join(dir, 'drugs'))
    writeFileSync(join(dir, 'drugs/x.yaml'), 'id: x\nname: X\n')
    const a = buildDb(dir, join(dir, 'a.db'))
    writeFileSync(join(dir, 'drugs/x.yaml'), 'id: x\nname: X2\n')
    const b = buildDb(dir, join(dir, 'b.db'))
    expect(a).not.toEqual(b)
  })
  it('returns validation errors and writes nothing', () => {
    const dir = tmp()
    mkdirSync(join(dir, 'drugs'))
    writeFileSync(join(dir, 'drugs/x.yaml'), 'id: x\n')
    const r = buildDb(dir, join(dir, 'out.db'))
    expect('errors' in r && r.errors[0]).toMatch(/^drugs\/x\.yaml: name: /)
  })
})
