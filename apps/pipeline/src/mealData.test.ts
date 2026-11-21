// Data checks for #153: Drug labels are manufacturer labels, and "a meal" entries cite the Drug's own label.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { describe, expect, it } from 'vite-plus/test'

const DATA = join(import.meta.dirname, '../../../data')
type Doc = {
  id: string
  food?: string
  drug?: string
  dailymed?: string
  effect?: string
  status?: string
  citations?: { type: string; setid?: string }[]
}
const load = (dir: string): Doc[] =>
  readdirSync(join(DATA, dir))
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => parse(readFileSync(join(DATA, dir, f), 'utf8'), { schema: 'core' }) as Doc)

const drugs = load('drugs')
const mealDocs = [...load('interactions'), ...load('pairings')].filter((d) => d.food === 'a-meal')

// Labels that were repackagers' (RemedyRepack, Bryant Ranch, Proficient Rx, Hawaii Repack,
// A-S Medication, Cardinal Health, Major) or the wrong dosage form (minocycline injection).
const OLD_SETIDS = [
  '9508caf5-0e3a-4d32-909d-bff7ea40ec30', // adenosine
  'ef8fc378-7fee-4d20-81ec-31211e34dc6e', // buspirone
  '0fe3becb-f90e-4187-a8e8-bd0de5a79ad2', // ciprofloxacin
  '0f69b9c6-8c00-45e2-b950-34dc5ae62352', // colchicine
  '3bd4006a-8bad-4909-ac6d-b6d84390155c', // dronedarone
  '6dab7b7b-a3a9-47ef-b423-134bc6970d8b', // isoniazid
  'cc004be0-da13-4b6b-83d5-d45b23fd37c9', // metronidazole
  'e415c323-8219-464b-9e3e-72c5a796cdaa', // minocycline (injection)
  '46d5c0d1-a97b-46d9-8cf4-994780673337', // phenytoin
  '936b4ea8-82bf-461d-bc73-4b3bf3f3e9a0', // quetiapine
  '9bf059f4-4da8-48fe-aacb-c50717d36606', // rasagiline
  '882657ae-e15b-4c86-a571-b55460bd4726', // theophylline
  '1ce5786e-22e6-4afa-8052-6eababc6aa4e', // venlafaxine
  '006cf920-04ae-0b53-cb91-85481972abc2', // verapamil
]

describe('Drug labels (#153)', () => {
  it('no Drug records a repackager or wrong-form label setid', () => {
    expect(
      drugs.filter((d) => d.dailymed && OLD_SETIDS.includes(d.dailymed)).map((d) => d.id),
    ).toEqual([])
  })
})

describe('"a meal" entries (#153)', () => {
  it("every label Citation is the Drug's own DailyMed setid", () => {
    const own = new Map(drugs.map((d) => [d.id, d.dailymed]))
    const wrong = mealDocs.filter((d) =>
      d.citations?.some((c) => c.type === 'label' && c.setid !== own.get(d.drug!)),
    )
    expect(wrong.map((d) => d.id)).toEqual([])
  })
  it('timing advice from labels: an a-meal Interaction (decreases) per empty-stomach Drug', () => {
    const have = new Set(mealDocs.filter((d) => d.effect === 'decreases').map((d) => d.drug))
    for (const drug of ['levothyroxine', 'alendronate', 'risedronate', 'isoniazid', 'nimodipine'])
      expect(have, drug).toContain(drug)
  })
})
