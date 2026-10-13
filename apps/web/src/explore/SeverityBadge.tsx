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

/** Named by the Severity word alone; `decorative` hides it where the word is already in a heading. */
export function SeverityBadge({
  severity,
  decorative,
}: {
  severity: Severity
  decorative?: boolean
}) {
  return (
    <span className={`badge badge--${severity}`} aria-hidden={decorative || undefined}>
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

/** Group heading shared by My meds and the Explore panel: badge, word, then the plain subtitle once. */
export function SeverityGroupHeading({ severity }: { severity: Severity }) {
  return (
    <>
      <h3 id={`sev-${severity}`}>
        <SeverityBadge severity={severity} decorative /> {SEVERITY_LABEL[severity]}
      </h3>
      <p className="sev-meaning">{SEVERITY_LEGEND[severity]}</p>
    </>
  )
}
