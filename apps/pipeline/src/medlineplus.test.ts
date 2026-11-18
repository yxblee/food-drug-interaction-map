import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'
import { addMedlineplus, medlineplusUrl, withMedlineplus } from './medlineplus.ts'

// Responses recorded from https://connect.medlineplus.gov/service (RxCUI 36567 and 1).
const connect: Record<string, unknown> = JSON.parse(
  readFileSync(new URL('./fixtures/medlineplus-connect.json', import.meta.url), 'utf8'),
)
const DRUG_PAGE = 'https://medlineplus.gov/druginfo/meds/a692030.html'

describe('medlineplusUrl', () => {
  it('picks the drug page and drops the tracking query, ignoring the health topic', () => {
    expect(medlineplusUrl(connect['36567'])).toBe(DRUG_PAGE)
  })

  it('returns nothing when MedlinePlus has no match', () => {
    expect(medlineplusUrl(connect['1'])).toBeUndefined()
  })

  it('refuses a link that is not an https MedlinePlus drug page', () => {
    const feed = (href: string) => ({ feed: { entry: [{ link: [{ href }] }] } })
    expect(medlineplusUrl(feed('http://medlineplus.gov/druginfo/meds/a1.html'))).toBeUndefined()
    expect(medlineplusUrl(feed('https://evil.example/druginfo/meds/a1.html'))).toBeUndefined()
  })
})

const yaml = (s: TemplateStringsArray) => s[0].trimStart()

describe('withMedlineplus', () => {
  it('adds the URL after the rxnorm line, touching nothing else', () => {
    expect(
      withMedlineplus(
        yaml`
id: "simvastatin"
rxnorm: "36567"
aliases: ["Zocor"]
`,
        DRUG_PAGE,
      ),
    ).toBe(yaml`
id: "simvastatin"
rxnorm: "36567"
medlineplus: "https://medlineplus.gov/druginfo/meds/a692030.html"
aliases: ["Zocor"]
`)
  })
})

describe('addMedlineplus', () => {
  const file = (id: string, extra: string) => ({
    file: `${id}.yaml`,
    text: `id: "${id}"\nname: "${id}"\n${extra}\n`,
  })
  const getJson = async (cui: string) => connect[cui]

  it('links Drugs with a match; classes, Drugs without an rxnorm id and non-matches get none', async () => {
    const r = await addMedlineplus(
      [
        file('simvastatin', 'rxnorm: "36567"'),
        file('nothing', 'rxnorm: "1"'),
        file('statins', 'group: true'),
        file('mystery', 'aliases: []'),
      ],
      getJson,
    )
    expect(r.changed.map((c) => c.file)).toEqual(['simvastatin.yaml'])
    expect(r.unmatched).toEqual(['nothing'])
  })

  it('leaves a Drug that already has a link alone', async () => {
    const r = await addMedlineplus(
      [file('simvastatin', `rxnorm: "36567"\nmedlineplus: "${DRUG_PAGE}"`)],
      getJson,
    )
    expect(r.changed).toEqual([])
  })
})
