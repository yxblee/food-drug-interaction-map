import { describe, expect, it } from 'vite-plus/test'
import type { GraphInteraction, GraphNode, GraphPayload } from '@fdi/schema'
import { csvFileName, interactionsToCsv } from './interactionsToCsv.ts'

const node = (kind: GraphNode['kind'], id: string, name = id, group = false): GraphNode => ({
  kind,
  id,
  name,
  aliases: [],
  group,
})
const ix = (over: Partial<GraphInteraction>): GraphInteraction => ({
  id: 'a--b',
  food: 'grapefruit',
  drug: 'simvastatin',
  mechanisms: ['cyp3a4'],
  severity: 'avoid',
  effect: 'increases',
  summary: 'Raises levels.',
  advice: 'Avoid it.',
  citations: [{ type: 'label', title: 'Label', url: 'https://dailymed.example/1' }],
  reviewed_at: '2026-10-08',
  ...over,
})
const graph = (interactions: GraphInteraction[], reviewedAt: string | null = '2026-10-08') =>
  ({
    version: 'v',
    stats: { reviewedAt, citationTypes: ['label'] },
    nodes: [
      node('drug', 'simvastatin', 'Simvastatin'),
      node('drug', 'statins', 'Statins', true),
      node('food', 'grapefruit', 'Grapefruit'),
      node('mechanism', 'cyp3a4', 'CYP3A4 inhibition'),
      node('mechanism', 'p-gp', 'P-gp inhibition'),
    ],
    interactions,
    pairings: [],
  }) satisfies GraphPayload

const lines = (csv: string) => csv.split('\r\n')

describe('interactionsToCsv', () => {
  it('starts with the not-safe / not-medical-advice note, then the header row', () => {
    const [note, header] = lines(interactionsToCsv(graph([ix({})])))
    expect(note).toContain('does not mean')
    expect(note).toContain('safe')
    expect(note).toContain('not medical advice')
    expect(header).toBe('Drug,Food,Severity,Effect,Mechanisms,Summary,Reviewed,Citation URLs')
  })

  it('writes one row per Interaction using recorded names', () => {
    const csv = interactionsToCsv(
      graph([ix({}), ix({ id: 'x', drug: 'statins', food: 'grapefruit' })]),
    )
    const rows = lines(csv).filter(Boolean)
    expect(rows).toHaveLength(2 + 2) // note + header + 2
    expect(rows[2]).toBe(
      'Simvastatin,Grapefruit,avoid,increases,CYP3A4 inhibition,Raises levels.,2026-10-08,https://dailymed.example/1',
    )
    expect(rows[3]!.startsWith('Statins,')).toBe(true) // the Drug class as recorded
  })

  it('joins several Mechanisms and Citation URLs inside one cell', () => {
    const csv = interactionsToCsv(
      graph([
        ix({
          mechanisms: ['cyp3a4', 'p-gp'],
          citations: [
            { type: 'label', title: 'A', url: 'https://a.example/' },
            { type: 'review', title: 'B', url: 'https://b.example/' },
          ],
        }),
      ]),
    )
    const row = lines(csv)[2]!
    expect(row).toContain('CYP3A4 inhibition; P-gp inhibition')
    expect(row.endsWith('https://a.example/ https://b.example/')).toBe(true)
  })

  it('quotes commas, double quotes and newlines per RFC 4180', () => {
    const csv = interactionsToCsv(graph([ix({ summary: 'Raises, "a lot".\nSeriously.' })]))
    expect(csv).toContain('"Raises, ""a lot"".\nSeriously."')
    // The newline stays inside its quoted cell: records are still CRLF-separated.
    expect(lines(csv).filter(Boolean)).toHaveLength(3)
  })

  it('leaves the reviewed cell empty when no date is recorded', () => {
    const row = lines(interactionsToCsv(graph([ix({ reviewed_at: undefined })])))[2]!
    expect(row).toContain('Raises levels.,,https://')
  })

  it('has a note and header but no rows for an empty Dataset', () => {
    expect(lines(interactionsToCsv(graph([]))).filter(Boolean)).toHaveLength(2)
  })
})

describe('csvFileName', () => {
  it('carries the Dataset reviewed date', () => {
    expect(csvFileName(graph([], '2026-10-08'))).toBe('food-drug-interactions-2026-10-08.csv')
  })
  it('omits the date when none is recorded', () => {
    expect(csvFileName(graph([], null))).toBe('food-drug-interactions.csv')
  })
})
