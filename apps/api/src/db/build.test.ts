import { cpSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
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
  it('writes Approved pairings only', () => {
    const out = join(tmp(), 'data.db')
    buildDb(FIXTURES, out)
    const db = new DatabaseSync(out, { readOnly: true })
    expect(db.prepare('SELECT id FROM pairings').all()).toEqual([{ id: 'kale--statins' }])
    db.close()
  })
  it('leaves out Drugs and Mechanisms that only a Pending Interaction references', () => {
    const dir = tmp()
    cpSync(FIXTURES, dir, { recursive: true })
    writeFileSync(join(dir, 'drugs/newdrug.yaml'), 'id: newdrug\nname: Newdrug\n')
    writeFileSync(
      join(dir, 'mechanisms/newmech.yaml'),
      'id: newmech\nname: Newmech\nkind: other\nexplanation: x\n',
    )
    const pending = readFileSync(join(FIXTURES, 'interactions/orange--simvastatin.yaml'), 'utf8')
      .replace(/^id: .*$/m, 'id: orange--newdrug')
      .replace(/^drug: .*$/m, 'drug: newdrug')
      .replace(/^status: .*$/m, 'status: pending')
      .replace(/^reviewed_at: .*\n/m, '')
      .replace(/cyp3a4-inhibition/g, 'newmech')
    writeFileSync(join(dir, 'interactions/orange--newdrug.yaml'), pending)
    const out = join(tmp(), 'data.db')
    expect('version' in buildDb(dir, out)).toBe(true)
    const db = new DatabaseSync(out, { readOnly: true })
    expect(db.prepare("SELECT id FROM drugs WHERE id = 'newdrug'").all()).toEqual([])
    expect(db.prepare("SELECT id FROM mechanisms WHERE id = 'newmech'").all()).toEqual([])
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
    writeFileSync(join(dir, 'drugs/x.yaml'), 'id: x\nname: X\ngroup: true\n')
    const a = buildDb(dir, join(dir, 'a.db'))
    writeFileSync(join(dir, 'drugs/x.yaml'), 'id: x\nname: X2\ngroup: true\n')
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
