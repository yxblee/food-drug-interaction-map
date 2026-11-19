const NEW_ISSUE = 'https://github.com/yxblee/food-drug-interaction-map/issues/new'
const TEMPLATE = 'wrong-interaction.yml'

/** Generic "report a mistake" link (About the data). */
export const ABOUT_REPORT_URL = `${NEW_ISSUE}?${new URLSearchParams({ template: TEMPLATE })}`

/** Prefilled issue for one Interaction. Public data only: never the My meds list. */
export function reportUrl(i: { id: string; food: string; drug: string }): string {
  const q = new URLSearchParams({
    template: TEMPLATE,
    interaction: i.id,
    title: `Wrong Interaction: ${i.food} and ${i.drug}`,
  })
  return `${NEW_ISSUE}?${q}`
}
