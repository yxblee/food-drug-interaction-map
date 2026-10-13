import { describe, expect, it } from 'vite-plus/test'
import { validateDataset, type RawDataset } from './validate.ts'

const interaction = (food: string, drug: string, extra: Record<string, unknown> = {}) => ({
  file: `interactions/${food}--${drug}.yaml`,
  data: {
    id: `${food}--${drug}`,
    food,
    drug,
    mechanisms: ['cyp3a4-inhibition'],
    severity: 'caution',
    effect: 'increases',
    summary: 's',
    advice: 'a',
    details: 'd',
    citations: [{ type: 'label', title: 't', url: 'https://example.org' }],
    status: 'approved',
    source: 'curated',
    reviewed_at: '2026-10-08',
    ...extra,
  },
})

function base(): RawDataset {
  return {
    drugs: [
      { file: 'drugs/statins.yaml', data: { id: 'statins', name: 'Statins', group: true } },
      {
        file: 'drugs/simvastatin.yaml',
        data: { id: 'simvastatin', name: 'Simvastatin', aliases: ['Zocor'], parent: 'statins' },
      },
    ],
    foods: [
      {
        file: 'foods/sample-fruits.yaml',
        data: { id: 'sample-fruits', name: 'Sample fruits', group: true, category: 'fruit' },
      },
      {
        file: 'foods/grapefruit.yaml',
        data: { id: 'grapefruit', name: 'Grapefruit', parent: 'sample-fruits', category: 'fruit' },
      },
    ],
    mechanisms: [
      {
        file: 'mechanisms/cyp3a4-inhibition.yaml',
        data: {
          id: 'cyp3a4-inhibition',
          name: 'CYP3A4 inhibition',
          kind: 'enzyme',
          explanation: 'x',
        },
      },
    ],
    interactions: [
      interaction('grapefruit', 'simvastatin'),
      interaction('sample-fruits', 'statins'),
    ],
  }
}

const errorsOf = (raw: RawDataset) => {
  const r = validateDataset(raw)
  return 'errors' in r ? r.errors : []
}

describe('validateDataset', () => {
  it('returns the parsed dataset when valid', () => {
    const r = validateDataset(base())
    expect('dataset' in r && r.dataset.interactions.length).toBe(2)
  })

  it('reports schema errors with file and path', () => {
    const raw = base()
    raw.drugs[1].data = { id: 'simvastatin' }
    expect(errorsOf(raw)).toContainEqual(expect.stringMatching(/^drugs\/simvastatin\.yaml: name: /))
  })

  it('requires id to match filename', () => {
    const raw = base()
    raw.foods[1].file = 'foods/pomelo.yaml'
    expect(errorsOf(raw)).toContain('foods/pomelo.yaml: id "grapefruit" does not match filename')
  })

  it('requires interaction id to equal food--drug', () => {
    const raw = base()
    raw.interactions.push(interaction('grapefruit', 'statins', { id: 'sample-fruits--statins' }))
    raw.interactions[2].file = 'interactions/sample-fruits--statins.yaml'
    expect(errorsOf(raw)).toContain(
      'interactions/sample-fruits--statins.yaml: id: must be "grapefruit--statins"',
    )
  })

  it('reports duplicate ids', () => {
    const raw = base()
    raw.interactions.push(interaction('sample-fruits', 'statins'))
    expect(errorsOf(raw)).toContainEqual(
      expect.stringContaining('duplicate id "sample-fruits--statins"'),
    )
  })

  it('reports unknown references', () => {
    const raw = base()
    raw.interactions.push(interaction('kale', 'warfarin', { mechanisms: ['nope'] }))
    const errors = errorsOf(raw)
    expect(errors).toContain('interactions/kale--warfarin.yaml: food: unknown food "kale"')
    expect(errors).toContain('interactions/kale--warfarin.yaml: drug: unknown drug "warfarin"')
    expect(errors).toContain(
      'interactions/kale--warfarin.yaml: mechanisms: unknown mechanism "nope"',
    )
  })

  it('enforces one-level groups', () => {
    const raw = base()
    raw.drugs.push({
      file: 'drugs/lipid.yaml',
      data: { id: 'lipid', name: 'Lipid', group: true, parent: 'statins' },
    })
    raw.foods.push({
      file: 'foods/pomelo.yaml',
      data: { id: 'pomelo', name: 'Pomelo', parent: 'grapefruit', category: 'fruit' },
    })
    raw.foods.push({
      file: 'foods/lime.yaml',
      data: { id: 'lime', name: 'Lime', parent: 'nothing', category: 'fruit' },
    })
    const errors = errorsOf(raw)
    expect(errors).toContain('drugs/lipid.yaml: parent: a group cannot have a parent')
    expect(errors).toContain('foods/pomelo.yaml: parent: "grapefruit" is not a group')
    expect(errors).toContain('foods/lime.yaml: parent: unknown parent "nothing"')
  })

  it('reports name and alias collisions within a kind, case-insensitively', () => {
    const raw = base()
    raw.drugs.push({ file: 'drugs/zocor-xr.yaml', data: { id: 'zocor-xr', name: 'ZOCOR' } })
    expect(errorsOf(raw)).toContain(
      'drugs/zocor-xr.yaml: name/aliases: "zocor" already used by simvastatin',
    )
  })

  it('fails an interaction with no mechanism or no citation, naming file and field', () => {
    const raw = base()
    raw.interactions[0] = interaction('grapefruit', 'simvastatin', { mechanisms: [] })
    raw.interactions[1] = interaction('sample-fruits', 'statins', { citations: [] })
    const errors = errorsOf(raw)
    expect(errors).toContainEqual(
      expect.stringMatching(/^interactions\/grapefruit--simvastatin\.yaml: mechanisms: /),
    )
    expect(errors).toContainEqual(
      expect.stringMatching(/^interactions\/sample-fruits--statins\.yaml: citations: /),
    )
  })

  it('accepts every source value', () => {
    for (const source of ['curated', 'openfda', 'foodrugs', 'ddid']) {
      const raw = base()
      raw.interactions[0] = interaction('grapefruit', 'simvastatin', { source })
      expect(errorsOf(raw)).toEqual([])
    }
  })

  it('allows a pending interaction with no reviewed_at and only study citations', () => {
    const raw = base()
    raw.interactions.push(
      interaction('grapefruit', 'statins', {
        status: 'pending',
        source: 'ddid',
        reviewed_at: undefined,
        citations: [{ type: 'study', title: 't', url: 'https://example.org' }],
      }),
    )
    expect(errorsOf(raw)).toEqual([])
  })

  it('requires reviewed_at once an interaction is approved or rejected', () => {
    for (const status of ['approved', 'rejected']) {
      const raw = base()
      raw.interactions.push(
        interaction('grapefruit', 'statins', { status, reviewed_at: undefined }),
      )
      expect(errorsOf(raw)).toContainEqual(
        expect.stringMatching(/^interactions\/grapefruit--statins\.yaml: reviewed_at: /),
      )
    }
  })

  it('requires an approved interaction to have a label, review or guideline citation', () => {
    const raw = base()
    raw.interactions[0] = interaction('grapefruit', 'simvastatin', {
      citations: [{ type: 'study', title: 't', url: 'https://example.org' }],
    })
    expect(errorsOf(raw)).toContainEqual(
      expect.stringMatching(
        /^interactions\/grapefruit--simvastatin\.yaml: citations: approved interaction needs a label, review or guideline citation/,
      ),
    )
  })

  it('fails a non-class drug or a mechanism no approved interaction references', () => {
    const raw = base()
    raw.drugs.push({ file: 'drugs/orphan.yaml', data: { id: 'orphan', name: 'Orphan' } })
    raw.mechanisms.push({
      file: 'mechanisms/unused.yaml',
      data: { id: 'unused', name: 'Unused', kind: 'other', explanation: 'x' },
    })
    raw.interactions.push(
      interaction('grapefruit', 'orphan', { status: 'pending', reviewed_at: undefined }),
      interaction('sample-fruits', 'orphan', { status: 'rejected', mechanisms: ['unused'] }),
    )
    const errors = errorsOf(raw)
    expect(errors).toContainEqual('drugs/orphan.yaml: no approved interaction references this drug')
    expect(errors).toContainEqual(
      'mechanisms/unused.yaml: no approved interaction references this mechanism',
    )
  })

  it('counts a drug as referenced when an approved interaction targets its class', () => {
    const raw = base()
    raw.drugs.push({
      file: 'drugs/atorvastatin.yaml',
      data: { id: 'atorvastatin', name: 'Atorvastatin', parent: 'statins' },
    })
    expect(errorsOf(raw)).toEqual([])
  })

  it('exempts classes, food groups and foods from the reference rule', () => {
    const raw = base()
    raw.drugs.push({
      file: 'drugs/other-class.yaml',
      data: { id: 'other-class', name: 'Other', group: true },
    })
    raw.foods.push({
      file: 'foods/kale.yaml',
      data: { id: 'kale', name: 'Kale', category: 'vegetable' },
    })
    expect(errorsOf(raw)).toEqual([])
  })
})
