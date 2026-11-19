import { describe, expect, it } from 'vite-plus/test'
import { reportUrl, ABOUT_REPORT_URL } from './reportUrl.ts'

describe('reportUrl', () => {
  it('prefills only the template, Interaction id and title', () => {
    const u = new URL(
      reportUrl({ id: 'grapefruit--simvastatin', food: 'Grapefruit', drug: 'Simvastatin' }),
    )
    expect(u.origin + u.pathname).toBe(
      'https://github.com/yxblee/food-drug-interaction-map/issues/new',
    )
    expect([...u.searchParams.keys()].sort()).toEqual(['interaction', 'template', 'title'])
    expect(u.searchParams.get('template')).toBe('wrong-interaction.yml')
    expect(u.searchParams.get('interaction')).toBe('grapefruit--simvastatin')
    expect(u.searchParams.get('title')).toBe('Wrong Interaction: Grapefruit and Simvastatin')
  })

  it('encodes reserved characters', () => {
    const raw = reportUrl({ id: 'a&b=c', food: 'Fish & chips', drug: 'X#1' })
    expect(raw).not.toMatch(/&b=c|#1/)
    expect(new URL(raw).searchParams.get('interaction')).toBe('a&b=c')
  })

  it('generic About link carries the template only', () => {
    expect(new URL(ABOUT_REPORT_URL).search).toBe('?template=wrong-interaction.yml')
  })
})
