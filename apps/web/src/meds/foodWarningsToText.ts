import { SEVERITIES } from '@fdi/schema'
import { SEVERITY_LABEL } from '../explore/SeverityBadge.tsx'
import type { FoodWarning } from './checkMeds.ts'

/** Plain-text Foods to watch for the clipboard: the same Severity groups Print shows, no links. */
export function foodWarningsToText(warnings: FoodWarning[], date: string): string {
  const head = `Foods to watch, ${date}. Informational only, not medical advice.`
  if (!warnings.length) return `${head}\n\nAdd medications to see which foods to watch.`
  const groups = SEVERITIES.flatMap((sev) => {
    const rows = warnings
      .filter((w) => w.severity === sev)
      .flatMap((w) =>
        w.affected.map(
          (h) => `- ${w.food.name} (${h.drug.name}). What to do: ${h.interaction.advice}`,
        ),
      )
    return rows.length ? [[SEVERITY_LABEL[sev], ...rows].join('\n')] : []
  })
  return [head, ...groups].join('\n\n')
}
