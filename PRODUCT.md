# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who take medications and people who manage them for a family member. They ask one recurring question, *can I eat or drink this with it?*, in three moments: when a new prescription arrives (the leaflet mentions food in passing, if at all), at the table about to have grapefruit, coffee or a glass of wine, and whenever several medications are in play and the answers would otherwise have to be checked one by one and merged by hand. Caregivers often act for older adults.

## Product Purpose

Show which Foods change how a person's Drugs work, why, and how strongly to avoid combining them, with a Citation behind every answer. Success: a person enters their whole medication list (brand names work) and in seconds sees the Foods to watch, ordered by Severity, each with the reason, the advice and a source they can check.

## Positioning

Searches and chatbots answer one drug at a time with no comparable severity, no reason and no checkable source; interaction checkers are drug-first lists. This product offers, together: a food-first view, the Mechanism that links related warnings (grapefruit → CYP3A4 inhibition → simvastatin), a Citation on every claim, and one check across the whole medication list that never leaves the device.

## Operating Context

- **My meds:** enter medications, get Foods to watch grouped by Severity in plain language. Used at prescription time and at the table, likely on a phone.
- **Explore:** interactive 3D/2D graph of Foods, Drugs and Mechanisms; search a Food or Drug, read the panel, share the view by URL.
- Public static demo on GitHub Pages; full-stack variant (Hono API + SQLite) deployable via Docker/Fly.

## Capabilities and Constraints

- Curated Dataset in `data/` YAML: 59 Drugs (including Drug classes), 39 Foods, 22 Mechanisms, 53 Interactions; validated into SQLite, served by a small read API or exported as static JSON.
- Severity vocabulary is fixed: avoid, caution, monitor, minimal. It is advice from the primary Citation, not a clinical grade; research-database grades are never mapped onto it.
- Effect is increases or decreases.
- Private by design: the medication list lives only in browser storage; the check runs on device and never sends a drug name to the API.
- Out of scope: accounts, drug–drug interactions, non-US drug names, languages other than English.
- Terminology is binding; see `GLOSSARY.md` (e.g. "Sources" is the on-screen label for Citations; avoid "risk level", "contraindication").

## Brand Commitments

- Name: Food–Drug Interaction Map.
- Voice: plain language, calm, specific; explains the why, never alarms.
- Disclaimer must stay visible: informational only, not medical advice; talk to a pharmacist or doctor before changing diet or medications.

## Evidence on Hand

- 53 hand-written Interactions, each citing a DailyMed label, NIH ODS/NCCIH fact sheet or PubMed review (`data/`, `docs/data-sources.md`). Sources are linked, not copied.
- Live demo: https://yxblee.github.io/food-drug-interaction-map/
- No testimonials, user counts, clinical validation or endorsements exist; do not fabricate them.
- Absence from the Dataset does not mean a combination is safe; never imply otherwise.

## Product Principles

1. Every claim traces to a Citation the person can open.
2. Severity first, mechanism second: answer "how worried should I be" before "why".
3. The medication list is the person's, and stays on their device.
4. Plain language over clinical jargon, without losing accuracy.
5. Honest about limits: informational, curated, incomplete.

## Accessibility & Inclusion

WCAG 2.2 AA. Design for older adults and caregivers acting for them: readable type, generous touch targets, sufficient contrast. The 3D graph is never the only path; the 2D view and screen-reader rows must carry the same information.
