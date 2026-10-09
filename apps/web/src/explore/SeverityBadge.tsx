import type { Severity } from '@fdi/schema'

export const SEVERITY_LABEL: Record<Severity, string> = {
  avoid: 'Avoid',
  caution: 'Caution',
  monitor: 'Monitor',
  minimal: 'Minimal',
}

export const SEVERITY_LEGEND: Record<Severity, string> = {
  avoid: "Don't combine. Risk of serious harm.",
  caution: 'Limit or keep intake consistent. Talk to your pharmacist.',
  monitor: 'Usually fine. Watch for symptoms or have levels checked.',
  minimal: 'Documented but rarely clinically important.',
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`badge badge--${severity}`} title={SEVERITY_LEGEND[severity]}>
      {SEVERITY_LABEL[severity]}
    </span>
  )
}
