interface Props {
  /** The Drug's name, so each link in a list says which medication it is about. */
  name: string
  url: string
  /** Short label for a tight spot such as a chip; the panel spells it out. */
  compact?: boolean
}

// Opens in a new tab, and says so in its accessible name. The name starts with the visible text.
export function MedlinePlusLink({ name, url, compact }: Props) {
  const label = compact ? 'MedlinePlus' : 'About this medication (MedlinePlus)'
  return (
    <a
      className={compact ? 'extlink extlink--compact' : 'extlink'}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        compact ? `About ${name} (${label}), opens in a new tab` : `${label}, opens in a new tab`
      }
    >
      {label} <span aria-hidden="true">↗</span>
    </a>
  )
}
