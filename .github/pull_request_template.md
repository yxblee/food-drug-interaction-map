## Summary

<!-- What does this PR change and why? -->

## Data changes (delete this section if `data/` is untouched)

- [ ] Every new or changed Interaction has at least one Citation: a DailyMed label, an NIH fact sheet or a peer-reviewed review.
- [ ] Each DailyMed `setid` and each PMID was opened, and the source mentions this Food and Drug.
- [ ] Summary, advice, details, Severity and Effect are in our own words and match what the primary Citation supports.
- [ ] Severity comes from the primary Citation. FooDrugs, FARFOOD and DDID were used only to find candidates, and their grades were not mapped onto Severity.
- [ ] No text or records were copied from a research database or a label.
- [ ] No placeholder text is left (`<`, `>`, `TODO`).
- [ ] Grapefruit and its relatives stay a Food group, not "citrus" (ADR 0001).
- [ ] `vp run build:db` prints `Built dist/data.db`.
- [ ] The owner has medically reviewed the Interactions in this PR and set `reviewed_at`.

## Checks

- [ ] `vp check`
- [ ] `vp test`
