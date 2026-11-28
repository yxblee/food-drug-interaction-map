interface Props {
  url: string
  /** Visible text; the panel says "this medication", a list names the Drug. */
  label: string
  /**
   * Shorter visible text for phone widths. The accessible name stays `label`, which must contain
   * this outside any parentheses: axe's label-in-name check (WCAG 2.5.3) ignores
   * parenthesised words.
   */
  short?: string
}

// Opens in a new tab, and says so in its accessible name. The name starts with the visible text.
export function MedlinePlusLink({ url, label, short }: Props) {
  return (
    <a
      className="extlink"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}, opens in a new tab`}
    >
      {short ? (
        <>
          <span className="extlink__full">{label}</span>
          <span className="extlink__short">{short}</span>
        </>
      ) : (
        label
      )}{' '}
      <span aria-hidden="true">↗</span>
    </a>
  )
}

export const dailymedUrl = (setid: string) =>
  `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setid}`

// The one NLM attribution line, naming whichever of the two NLM sources are linked.
export function NlmSource({ medlineplus, dailymed }: { medlineplus: boolean; dailymed: boolean }) {
  const names = [medlineplus && 'MedlinePlus', dailymed && 'DailyMed'].filter(Boolean).join(' and ')
  return (
    <span className="mono-label">
      Source: {names}, National Library of Medicine. NLM is not responsible for and does not endorse
      this site.
    </span>
  )
}
