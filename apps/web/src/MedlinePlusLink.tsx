interface Props {
  url: string
  /** Visible text; the panel says "this medication", a list names the Drug. */
  label: string
}

// Opens in a new tab, and says so in its accessible name. The name starts with the visible text.
export function MedlinePlusLink({ url, label }: Props) {
  return (
    <a
      className="extlink"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}, opens in a new tab`}
    >
      {label} <span aria-hidden="true">↗</span>
    </a>
  )
}
