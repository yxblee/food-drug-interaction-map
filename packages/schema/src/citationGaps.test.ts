import { describe, expect, it } from 'vite-plus/test'
import { citationGaps } from './citationGaps.ts'

const cite = (url: string) => ({ type: 'label', title: 't', url })
const ix = (id: string, severity: string, status: string, urls: string[]) =>
  ({ id, severity, status, citations: urls.map(cite) }) as never

describe('citationGaps', () => {
  it('lists an approved avoid Interaction with one Citation', () => {
    expect(citationGaps([ix('a--b', 'avoid', 'approved', ['https://x.org/1'])])).toEqual(['a--b'])
  })
  it('passes once it has two Citations', () => {
    expect(
      citationGaps([ix('a--b', 'avoid', 'approved', ['https://x.org/1', 'https://y.org/2'])]),
    ).toEqual([])
  })
  it('ignores other severities and non-approved entries', () => {
    expect(
      citationGaps([
        ix('c--d', 'caution', 'approved', ['https://x.org/1']),
        ix('e--f', 'avoid', 'pending', ['https://x.org/1']),
      ]),
    ).toEqual([])
  })
})
