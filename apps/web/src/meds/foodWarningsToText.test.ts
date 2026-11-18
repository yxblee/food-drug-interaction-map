import { describe, expect, it } from 'vite-plus/test'
import type { GraphInteraction, GraphNode } from '@fdi/schema'
import type { FoodWarning } from './checkMeds.ts'
import { foodWarningsToText } from './foodWarningsToText.ts'

const node = (kind: GraphNode['kind'], name: string): GraphNode => ({
  kind,
  id: name.toLowerCase(),
  name,
  aliases: [],
  group: false,
})
const warning = (
  food: string,
  severity: GraphInteraction['severity'],
  drug: string,
  advice: string,
): FoodWarning => ({
  food: node('food', food),
  severity,
  affected: [
    {
      drug: node('drug', drug),
      interaction: {
        id: `${food}--${drug}`,
        food: food.toLowerCase(),
        drug: drug.toLowerCase(),
        mechanisms: [],
        severity,
        effect: 'increases',
        summary: '',
        advice,
      },
    },
  ],
})

describe('foodWarningsToText', () => {
  it('opens with the date and disclaimer, then lists Severity groups in order', () => {
    const text = foodWarningsToText(
      [
        warning('Alcohol', 'monitor', 'Warfarin', 'Keep it modest.'),
        warning('Grapefruit', 'avoid', 'Simvastatin', 'Skip it.'),
      ],
      'November 18, 2026',
    )
    expect(text).toBe(
      [
        'Foods to watch, November 18, 2026. Informational only, not medical advice.',
        '',
        'Avoid',
        '- Grapefruit (Simvastatin). What to do: Skip it.',
        '',
        'Monitor',
        '- Alcohol (Warfarin). What to do: Keep it modest.',
      ].join('\n'),
    )
  })

  it('says to add medications when there is nothing to copy', () => {
    expect(foodWarningsToText([], 'November 18, 2026')).toBe(
      'Foods to watch, November 18, 2026. Informational only, not medical advice.\n\nAdd medications to see which foods to watch.',
    )
  })
})
