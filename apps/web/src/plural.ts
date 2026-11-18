export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The notice shown when saved Medications are no longer in the dataset. */
export const droppedNotice = (n: number) =>
  `Removed ${plural(n, 'medication that is', 'medications that are')} no longer in our dataset.`
