import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'
import { addBrands, brandNames, mergeAliases, withAliases } from './brands.ts'

describe('mergeAliases', () => {
  it('adds new Brand names after the existing Aliases', () => {
    expect(mergeAliases({ name: 'Simvastatin', aliases: ['Zocor'] }, ['Flolipid'])).toEqual([
      'Zocor',
      'Flolipid',
    ])
  })

  it('dedupes against the name and existing Aliases, ignoring case', () => {
    expect(
      mergeAliases({ name: 'Oxycodone', aliases: ['OxyContin'] }, [
        'Oxycontin',
        'OXYCODONE',
        'Roxicodone',
        'roxicodone',
      ]),
    ).toEqual(['OxyContin', 'Roxicodone'])
  })

  it('never removes or reorders existing Aliases', () => {
    expect(
      mergeAliases({ name: 'Warfarin', aliases: ['Jantoven', 'blood thinner', 'Coumadin'] }, [
        'Coumadin',
      ]),
    ).toEqual(['Jantoven', 'blood thinner', 'Coumadin'])
  })

  it('skips a Drug class', () => {
    expect(mergeAliases({ name: 'Statins', aliases: [], group: true }, ['Zocor'])).toEqual([])
  })
})

const rxnav: Record<string, unknown> = JSON.parse(
  readFileSync(new URL('./fixtures/rxnav-brands.json', import.meta.url), 'utf8'),
)
const getJson = async (path: string) => {
  if (!(path in rxnav)) throw new Error(`not in fixture: ${path}`)
  return rxnav[path]
}

describe('brandNames', () => {
  it('reads the Brand names of an ingredient and leaves out combination products', async () => {
    // Vytorin is ezetimibe + simvastatin
    expect(await brandNames('36567', getJson)).toEqual(['Flolipid', 'Zocor'])
  })
})

const yaml = (strings: TemplateStringsArray) => strings[0].trimStart()

describe('withAliases', () => {
  it('rewrites a flow list in place', () => {
    const text = yaml`
id: "simvastatin"
name: "Simvastatin"
rxnorm: "36567"
aliases: ["Zocor"]
parent: "statins"
`
    expect(withAliases(text, ['Zocor', 'Flolipid'])).toBe(yaml`
id: "simvastatin"
name: "Simvastatin"
rxnorm: "36567"
aliases: ["Zocor", "Flolipid"]
parent: "statins"
`)
  })

  it('appends to a block list, quoting only when YAML needs it', () => {
    const text = yaml`
id: venlafaxine
name: Venlafaxine
aliases:
  - Effexor
rxnorm: "39786"
`
    expect(withAliases(text, ['Effexor', 'Effexor XR', 'Odd: name'])).toBe(yaml`
id: venlafaxine
name: Venlafaxine
aliases:
  - Effexor
  - Effexor XR
  - "Odd: name"
rxnorm: "39786"
`)
  })

  it('adds the list after rxnorm in the style of the file when there is none', () => {
    expect(withAliases('id: verapamil\nname: Verapamil\nrxnorm: "11170"\n', ['Calan'])).toBe(
      'id: verapamil\nname: Verapamil\nrxnorm: "11170"\naliases:\n  - Calan\n',
    )
    expect(
      withAliases('id: "nadolol"\nname: "Nadolol"\nrxnorm: "7226"\ndrug_class: "Beta blocker"\n', [
        'Corgard',
      ]),
    ).toBe(
      'id: "nadolol"\nname: "Nadolol"\nrxnorm: "7226"\naliases: ["Corgard"]\ndrug_class: "Beta blocker"\n',
    )
  })
})

describe('addBrands', () => {
  const simvastatin = {
    file: 'data/drugs/simvastatin.yaml',
    text: 'id: "simvastatin"\nname: "Simvastatin"\nrxnorm: "36567"\naliases: ["Zocor"]\nparent: "statins"\n',
  }

  it('merges the Brand names of each Drug with an rxnorm id into its file', async () => {
    const r = await addBrands([simvastatin], getJson)
    expect(r.changed).toEqual([
      {
        file: 'data/drugs/simvastatin.yaml',
        added: ['Flolipid'],
        text: 'id: "simvastatin"\nname: "Simvastatin"\nrxnorm: "36567"\naliases: ["Zocor", "Flolipid"]\nparent: "statins"\n',
      },
    ])
  })

  it('leaves Drug classes and Drugs with nothing new untouched, without asking RxNav about classes', async () => {
    const statins = {
      file: 'data/drugs/statins.yaml',
      text: 'id: "statins"\nname: "Statins"\ngroup: true\n',
    }
    const complete = {
      ...simvastatin,
      text: simvastatin.text.replace('["Zocor"]', '["Zocor", "flolipid"]'),
    }
    expect((await addBrands([statins, complete], getJson)).changed).toEqual([])
  })

  it('does not add a Brand name that another Drug already answers to, and reports it', async () => {
    const other = {
      file: 'data/drugs/other.yaml',
      text: 'id: other\nname: Other\naliases:\n  - flolipid\n',
    }
    const r = await addBrands([simvastatin, other], async (path) =>
      path.startsWith('rxcui.json') ? { idGroup: {} } : getJson(path),
    )
    expect(r.changed).toEqual([])
    expect(r.collisions).toEqual([{ id: 'simvastatin', brand: 'Flolipid', usedBy: 'other' }])
  })

  it('looks up a missing rxnorm id by name and reports it without writing the file', async () => {
    const verapamil = { file: 'data/drugs/verapamil.yaml', text: 'id: verapamil\nname: Verapamil\n' }
    const combined = {
      file: 'data/drugs/combined-oral-contraceptives.yaml',
      text: 'id: "combined-oral-contraceptives"\nname: "Combined oral contraceptives"\n',
    }
    const r = await addBrands([verapamil, combined], getJson)
    expect(r.changed).toEqual([])
    expect(r.lookedUp).toEqual([
      { id: 'verapamil', name: 'Verapamil', rxnorm: '11170' },
      { id: 'combined-oral-contraceptives', name: 'Combined oral contraceptives', rxnorm: undefined },
    ])
  })
})
