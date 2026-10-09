import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { validateDataset } from '@fdi/schema'
import { readDataDir } from './build.ts'

const r = validateDataset(readDataDir(join(import.meta.dirname, '../../../../data')))
const ds = 'dataset' in r ? r.dataset : undefined
const get = (id: string) => ds?.interactions.find((i) => i.id === id)

describe('seed dataset', () => {
  it('validates', () => {
    expect('errors' in r ? r.errors : []).toEqual([])
  })
  it('has the catalogue sizes from the ticket', () => {
    const drugs = ds!.drugs.length
    expect(drugs).toBeGreaterThanOrEqual(55)
    expect(drugs).toBeLessThanOrEqual(65)
    expect(ds!.foods.length).toBe(39)
    expect(ds!.mechanisms.length).toBe(22)
    expect(ds!.interactions.length).toBe(53)
  })
  it('keeps grapefruit relatives as a group, not citrus (ADR 0001)', () => {
    const rel = ds!.foods.filter((f) => f.parent === 'grapefruit-relatives').map((f) => f.id)
    expect(rel.sort()).toEqual(['grapefruit', 'pomelo', 'seville-orange'])
    expect(ds!.foods.some((f) => f.id === 'citrus')).toBe(false)
  })
  it('has brand-name aliases and drug classes', () => {
    expect(ds!.drugs.find((d) => d.id === 'warfarin')?.aliases).toContain('Coumadin')
    expect(ds!.drugs.find((d) => d.id === 'simvastatin')?.drug_class).toBeTruthy()
  })
  it('pins the e2e interactions', () => {
    expect(get('grapefruit-relatives--simvastatin')?.severity).toBe('avoid')
    expect(get('leafy-greens--warfarin')?.severity).toBe('caution')
  })
  it('backs every interaction with an authoritative citation and no placeholders', () => {
    const ok =
      /^https:\/\/(dailymed\.nlm\.nih\.gov|pubmed\.ncbi\.nlm\.nih\.gov|ods\.od\.nih\.gov|www\.nccih\.nih\.gov|www\.niaaa\.nih\.gov|www\.ncbi\.nlm\.nih\.gov)\//
    for (const i of ds!.interactions) {
      expect(i.status, i.id).toBe('approved')
      expect(i.source, i.id).toBe('curated')
      for (const c of i.citations) expect(c.url, i.id).toMatch(ok)
      expect(JSON.stringify(i), i.id).not.toMatch(/[<>]/)
    }
  })
})
