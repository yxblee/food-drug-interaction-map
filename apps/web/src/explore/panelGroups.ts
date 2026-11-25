import { SEVERITIES, type Interaction, type ResolvedInteraction, type Severity } from '@fdi/schema'

/** A panel with more rows than this shows each row as one collapsed line. */
export const COLLAPSE_ABOVE = 5

/** True when a list of this many rows shows each row as one collapsed line. */
export const collapsesAt = (count: number) => count > COLLAPSE_ABOVE

export interface PanelRun {
  /** The Drug class or Food group these Inherited interactions come from, stated once. */
  inheritedFrom?: string
  rows: ResolvedInteraction<Interaction>[]
}

export interface PanelGroup {
  severity: Severity
  /** Every row in the Severity group; its length is the count. */
  rows: ResolvedInteraction<Interaction>[]
  /** Direct rows first, then one run per Inherited source, in the rows' own order. */
  runs: PanelRun[]
}

/** Anything with a Severity, such as a My meds Food warning, grouped most severe first; empty groups skipped. */
export function severityGroups<T extends { severity: Severity }>(items: T[]) {
  const groups = SEVERITIES.flatMap((severity) => {
    const rows = items.filter((i) => i.severity === severity)
    return rows.length ? [{ severity, rows }] : []
  })
  return { collapsed: collapsesAt(items.length), groups }
}

/** Rows grouped by Severity, most severe first; empty groups are skipped. */
export function panelGroups(rows: ResolvedInteraction<Interaction>[]) {
  const { collapsed, groups: bySeverity } = severityGroups(
    rows.map((r) => Object.assign(r, { severity: r.interaction.severity })),
  )
  const groups: PanelGroup[] = bySeverity.map(({ severity, rows: mine }) => {
    // Direct rows first, then each Inherited source in order of appearance.
    const inherited = new Set(mine.map((r) => r.inheritedFrom).filter((f) => f !== undefined))
    const sources = [...(mine.some((r) => !r.inheritedFrom) ? [undefined] : []), ...inherited]
    const runs = sources.map((from) => ({
      inheritedFrom: from,
      rows: mine.filter((r) => r.inheritedFrom === from),
    }))
    return { severity, rows: mine, runs }
  })
  return { collapsed, groups }
}

export interface JumpLink {
  /** The id of the heading the link jumps to. */
  id: string
  severity?: Severity
  count: number
}

/** Jump links for a panel: one per Severity group, then Helpful pairings. None unless two or more. */
export function jumpLinks(
  groups: { severity: Severity; rows: readonly unknown[] }[],
  hasPairings: boolean,
  pairingsId = 'pairs-title',
): JumpLink[] {
  const links: JumpLink[] = groups.map((g) => ({
    id: `sev-${g.severity}`,
    severity: g.severity,
    count: g.rows.length,
  }))
  if (hasPairings) links.push({ id: pairingsId, count: 0 })
  return groups.length >= 2 ? links : []
}
