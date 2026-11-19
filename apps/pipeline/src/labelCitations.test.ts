import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'
import { relabel, type LabelInfo } from './labelCitations.ts'

// Label title (DailyMed spls.json?setid=) and section text (openFDA set_id), trimmed from real responses.
const labels: Record<string, LabelInfo> = JSON.parse(
  readFileSync(new URL('./fixtures/label-citations.json', import.meta.url), 'utf8'),
)
const getLabel = async (setid: string) => labels[setid]

const OLD = 'aaaaaaaa-0000-0000-0000-000000000001'
const cite = (title: string, setid: string) =>
  `  - type: "label"\n    title: "${title}"\n    url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setid}"\n    setid: "${setid}"\n`
const interaction = (id: string, drug: string, citations: string) => ({
  file: `data/interactions/${id}.yaml`,
  text: `id: ${id}\nfood: grapefruit\ndrug: ${drug}\nsummary: "s"\ncitations:\n${citations}  - type: "study"\n    title: "A study"\n    url: "https://example.org/s"\nstatus: approved\nreviewed_at: 2026-10-09\n`,
})
const drugs = { simvastatin: 'own-setid', isoniazid: 'own-setid-no-food' }
const foods = { grapefruit: ['Grapefruit', 'grapefruit juice'] }

describe('relabel', () => {
  it('leaves a Citation that already matches the Drug label', async () => {
    const f = interaction('grapefruit--simvastatin', 'simvastatin', cite('X', 'own-setid'))
    const r = await relabel([f], drugs, foods, getLabel)
    expect(r.changed).toEqual([])
    expect(r.rewritten).toEqual([])
    expect(r.kept).toEqual([])
  })

  it('rewrites title, url and setid when the Drug label mentions the Food; nothing else moves', async () => {
    const f = interaction(
      'grapefruit--simvastatin',
      'simvastatin',
      cite('SIMVASTATIN TABLET [REMEDYREPACK INC.]', OLD),
    )
    const r = await relabel([f], drugs, foods, getLabel)
    expect(r.rewritten).toEqual([
      {
        file: f.file,
        from: 'SIMVASTATIN TABLET [REMEDYREPACK INC.]',
        to: 'SIMVASTATIN TABLET, FILM COATED [MERCK SHARP & DOHME LLC]',
      },
    ])
    expect(r.changed[0].text).toBe(
      f.text.replace(
        cite('SIMVASTATIN TABLET [REMEDYREPACK INC.]', OLD),
        cite('SIMVASTATIN TABLET, FILM COATED [MERCK SHARP & DOHME LLC]', 'own-setid'),
      ),
    )
  })

  it('keeps and reports a Citation when the Food is not in the Drug label', async () => {
    const f = interaction('grapefruit--isoniazid', 'isoniazid', cite('ISONIAZID [BRYANT]', OLD))
    const r = await relabel([f], drugs, foods, getLabel)
    expect(r.changed).toEqual([])
    expect(r.kept).toEqual([
      { file: f.file, title: 'ISONIAZID [BRYANT]', reason: 'Drug label does not mention grapefruit' },
    ])
  })

  it('skips Drugs without a dailymed setid and non-label Citations', async () => {
    const f = interaction('grapefruit--statins', 'statins', cite('T [X]', OLD))
    const r = await relabel([f], drugs, foods, getLabel)
    expect(r).toEqual({ changed: [], rewritten: [], kept: [] })
  })
})
