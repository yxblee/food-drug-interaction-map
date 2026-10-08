# Food–Drug Interaction Map

Which foods change how your medicines work, why, and how seriously, with a citation behind every answer.

Two ways in, over one curated dataset:

- **My meds**: enter the medications you take (brand names work) and get a list of foods to watch, ordered by severity, in plain language. Your list stays on your device.
- **Explore**: an interactive 3D/2D graph linking foods, drugs and the mechanisms between them (grapefruit → CYP3A4 inhibition → simvastatin). Every view can be shared by URL.

> Informational only — not medical advice. Talk to your pharmacist or doctor before changing your diet or medications.

**Status:** design and plan done; building starts in Build Session 2. See [design spec](docs/superpowers/specs/2026-10-08-core-app-design.md), [implementation plan](docs/superpowers/plans/2026-10-08-core-app.md), [glossary](GLOSSARY.md) and [data sources](docs/data-sources.md).

---

## Build Session 1 evidence

### Problem evidence

**The problem is real, and I am the N of 1.** I take medications myself and also manage them for a family member. The question "can I eat or drink this with it?" comes up for both of us in three situations:

- **A new prescription.** The leaflet mentions food in passing, if at all, and I have to work out which everyday foods and drinks actually matter.
- **A meal or a drink.** Grapefruit, alcohol, coffee, aged cheese, leafy greens: the decision happens at the table, not at the pharmacy counter.
- **Several medications at once.** Checking each drug separately and merging the answers by hand is slow, and it's easy to miss that one food affects two of them.

**It deserves a solution.** A single search or chatbot prompt gives an answer for one drug, without a severity I can compare across drugs, the reason behind it, or a source I can check. Food–drug interactions are spread across drug labels, NIH fact sheets and research papers. Joining them up for a whole medication list is the part nobody does for you.

**What's missing from current tools.** Existing interaction checkers are drug-first lists. This project adds:

- a **food-first view** ("what does grapefruit affect?") alongside the drug-first one
- the **mechanism** behind each interaction, so related warnings make sense together
- a **citation on every claim**, from drug labels, NIH fact sheets or peer-reviewed reviews
- **one combined check across a whole medication list**, ordered by severity, that never leaves the device

**The scope is right.** It's a microproduct, not a platform: no accounts, no drug–drug interactions, US drug names, English only. A useful first version is about 50 well-known, cited interactions (warfarin and vitamin K, MAO inhibitors and tyramine, statins and grapefruit, levothyroxine with coffee and calcium, tetracyclines and dairy, and so on), searchable by brand name and usable on a phone.

### Data evidence

| Source | Role | Access | Terms |
|---|---|---|---|
| [DailyMed](https://dailymed.nlm.nih.gov/) drug labels (NLM) | Primary citation for each interaction | Free web pages and REST API | US government; labels freely reusable |
| [NIH ODS](https://ods.od.nih.gov/) and [NCCIH](https://www.nccih.nih.gov/) fact sheets | Primary citation for supplements and foods without a label | Free web pages | US government, public domain |
| [PubMed](https://pubmed.ncbi.nlm.nih.gov/) reviews | Primary citation where labels are silent | Free | We link only; no abstract text copied |
| [FooDrugs](https://doi.org/10.1093/database/baad075) | Finding and cross-checking candidate pairs | Zenodo download | Paper CC BY 4.0 |
| [FARFOOD](https://doi.org/10.1186/s13040-025-00493-2) | Finding and cross-checking candidate pairs | Database and app from the paper | Paper CC BY-NC-ND 4.0 |
| [DDID](https://doi.org/10.1093/bib/bbae212) | Finding and cross-checking candidate pairs, mechanisms | Web database | Paper CC BY 4.0 |

- **Accessibility.** Every source is free and online. Labels are fetched through the DailyMed API during curation.
- **Permission.** The project is non-commercial and educational. We write summaries in our own words and link to sources rather than copying them. The licences listed for the three research databases cover their papers. Each database's own data terms will be checked before any bulk download. FARFOOD's no-derivatives licence means its records are never copied into this project.
- **Signal.** The three databases hold about 3.4 million potential interactions (FooDrugs) and 23,950 graded records (DDID), which is plenty for finding candidates. Most of those are predicted or text-mined, though. So the published dataset is a smaller curated set: each interaction is checked by a person against a label, fact sheet or review before it ships. The first version targets 53 interactions across about 60 drugs, 39 foods and 22 mechanisms. Details are in [docs/data-sources.md](docs/data-sources.md).

### Taking into Build Session 2

- An approved [design spec](docs/superpowers/specs/2026-10-08-core-app-design.md) and a 19-task [implementation plan](docs/superpowers/plans/2026-10-08-core-app.md), in seven series:
  1. schema and validation
  2. API
  3. seed data
  4. web foundation
  5. Explore
  6. My meds
  7. end-to-end tests
- A [glossary](GLOSSARY.md) and [decision record](docs/adr/0001-grapefruit-relatives-not-citrus.md) fixing the domain language before any code is written.
- The first build target is a phone-friendly *My meds* check and the *Explore* graph over at least 50 cited interactions, deployed as a single service.

> **I have a real problem, I am the first user, solving it creates meaningful value, the scope is buildable, and I have access to data that can reasonably help solve it.**

---

## Tech stack

Node 24 and TypeScript; Vite+ (Vite, Vitest, Oxlint, Oxfmt); Hono API over SQLite compiled from YAML; React, D3 and 3d-force-graph; Playwright; Docker on Fly.io.
