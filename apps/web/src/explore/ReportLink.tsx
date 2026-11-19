import './ReportLink.css'

/** "Report a mistake": opens a prefilled GitHub issue in a new tab. 44px tall. */
export function ReportLink({ href, about }: { href: string; about?: string }) {
  return (
    <a
      className="report-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={about ? `Report a mistake: ${about}` : undefined}
    >
      Report a mistake
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  )
}
