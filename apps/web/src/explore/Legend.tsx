import { PillLabel } from '../PillLabel.tsx'
import { SEVERITIES } from '@fdi/schema'
import { SEVERITY_LABEL } from './SeverityBadge.tsx'

// Matches the 2D renderer: Drug = circle, Food = square, Mechanism = diamond (unfilled).
const SHAPES = [
  { kind: 'Drug', d: 'M 1 7 A 6 6 0 1 0 13 7 A 6 6 0 1 0 1 7 Z', fill: true },
  { kind: 'Food', d: 'M 2 2 H 12 V 12 H 2 Z', fill: true },
  { kind: 'Mechanism', d: 'M 7 1 L 13 7 L 7 13 L 1 7 Z', fill: false },
]
const WIDTH = { avoid: 2.4, caution: 2, monitor: 1.6, minimal: 1.2 } as const

export function Legend() {
  return (
    <details className="legend">
      <summary className="mono-label">
        <PillLabel>How to read the map</PillLabel>
      </summary>
      <ul className="legend__list">
        {SHAPES.map((s) => (
          <li key={s.kind}>
            <svg width="14" height="14" aria-hidden="true">
              <path
                d={s.d}
                fill={s.fill ? 'var(--muted)' : 'none'}
                stroke={s.fill ? 'none' : 'var(--ink)'}
              />
            </svg>
            {s.kind}
          </li>
        ))}
        <li>
          <svg width="14" height="14" aria-hidden="true">
            <path d="M 2 2 H 12 V 12 H 2 Z" fill="none" stroke="var(--muted)" />
          </svg>
          Outlined: a group or class
        </li>
      </ul>
      <ul className="legend__list">
        {SEVERITIES.map((sev) => (
          <li key={sev}>
            <svg width="24" height="14" aria-hidden="true">
              <line
                x1="1"
                y1="7"
                x2="23"
                y2="7"
                stroke={`var(--sev-${sev})`}
                strokeWidth={WIDTH[sev]}
                strokeDasharray={sev === 'minimal' ? '4 3' : undefined}
              />
            </svg>
            {SEVERITY_LABEL[sev]}
          </li>
        ))}
      </ul>
      <p>Thicker, darker lines are more serious. Select anything to see why.</p>
      <p>Color tints the page by what you've selected: drug, food or mechanism.</p>
    </details>
  )
}
