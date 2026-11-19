import { SEVERITIES, type Interaction, type ResolvedInteraction, type Severity } from '@fdi/schema'

/** A panel with more rows than this shows each row as one collapsed line. */
export const COLLAPSE_ABOVE = 5

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

/** Rows grouped by Severity, most severe first; empty groups are skipped. */
export function panelGroups(rows: ResolvedInteraction<Interaction>[]) {
  const groups: PanelGroup[] = SEVERITIES.flatMap((severity) => {
    const mine = rows.filter((r) => r.interaction.severity === severity)
    if (!mine.length) return []
    // Direct rows first, then each Inherited source in order of appearance.
    const inherited = new Set(mine.map((r) => r.inheritedFrom).filter((f) => f !== undefined))
    const sources = [...(mine.some((r) => !r.inheritedFrom) ? [undefined] : []), ...inherited]
    const runs = sources.map((from) => ({
      inheritedFrom: from,
      rows: mine.filter((r) => r.inheritedFrom === from),
    }))
    return [{ severity, rows: mine, runs }]
  })
  return { collapsed: rows.length > COLLAPSE_ABOVE, groups }
}

export interface JumpLink {
  /** The id of the heading the link jumps to. */
  id: string
  severity?: Severity
  count: number
}

/** Jump links for a panel: one per Severity group, then Helpful pairings. None unless two or more. */
export function jumpLinks(groups: PanelGroup[], hasPairings: boolean): JumpLink[] {
  const links: JumpLink[] = groups.map((g) => ({
    id: `sev-${g.severity}`,
    severity: g.severity,
    count: g.rows.length,
  }))
  if (hasPairings) links.push({ id: 'pairs-title', count: 0 })
  return groups.length >= 2 ? links : []
}
