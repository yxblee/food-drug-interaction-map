import { SEVERITIES, type Interaction, type ResolvedInteraction, type Severity } from '@fdi/schema'

/** A panel with more rows than this shows each row as one collapsed line. */
export const COLLAPSE_ABOVE = 5

export interface PanelGroup {
  severity: Severity
  rows: ResolvedInteraction<Interaction>[]
  /** The Drug class or Food group every row in this group is inherited from, stated once. */
  inheritedFrom?: string
}

/** Rows grouped by Severity, most severe first; empty groups are skipped. */
export function panelGroups(rows: ResolvedInteraction<Interaction>[]) {
  const groups: PanelGroup[] = SEVERITIES.flatMap((severity) => {
    const mine = rows.filter((r) => r.interaction.severity === severity)
    if (!mine.length) return []
    const from = mine[0].inheritedFrom
    const shared = mine.every((r) => r.inheritedFrom === from)
    return [{ severity, rows: mine, inheritedFrom: shared ? from : undefined }]
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
