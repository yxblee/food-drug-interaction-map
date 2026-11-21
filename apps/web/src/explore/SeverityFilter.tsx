import { SEVERITIES, type Severity } from '@fdi/schema'
import { SEVERITY_LABEL } from './SeverityBadge.tsx'

interface Props {
  shown: readonly Severity[]
  onChange: (shown: readonly Severity[]) => void
}

/** Which Severities the map draws. At least one stays on, so the map is never blank by accident. */
export function SeverityFilter({ shown, onChange }: Props) {
  const filtered = shown.length < SEVERITIES.length
  const toggle = (s: Severity) => {
    if (!shown.includes(s)) onChange(SEVERITIES.filter((v) => v === s || shown.includes(v)))
    else if (shown.length > 1) onChange(shown.filter((v) => v !== s))
  }
  return (
    <div className="sev-filter">
      <div role="group" aria-label="Show Severities" className="sev-filter__group">
        {SEVERITIES.map((s) => {
          const on = shown.includes(s)
          return (
            <button
              key={s}
              type="button"
              className={`pill-button sev-filter__btn sev-filter__btn--${s}`}
              aria-pressed={on}
              aria-disabled={on && shown.length === 1 ? true : undefined}
              onClick={() => toggle(s)}
            >
              <span className="sev-filter__dot" aria-hidden="true" />
              {SEVERITY_LABEL[s]}
            </button>
          )
        })}
      </div>
      <div role="status" className="sev-filter__note">
        {filtered && (
          <p>
            Filter on: showing {shown.map((s) => SEVERITY_LABEL[s]).join(', ')} only.{' '}
            <button type="button" className="link-button" onClick={() => onChange(SEVERITIES)}>
              Show all
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
