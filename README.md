# Food–Drug Interaction Map

Which foods change how your medicines work, why, and how seriously, with a citation behind every answer.

Two ways in, over one curated dataset:

- **My meds**: enter the medications you take (brand names work) and get a list of foods to watch, ordered by severity, in plain language. Your list stays on your device.
- **Explore**: an interactive 3D/2D graph linking foods, drugs and the mechanisms between them (grapefruit → CYP3A4 inhibition → simvastatin). Every view can be shared by URL.

> Informational only — not medical advice. Talk to your pharmacist or doctor before changing your diet or medications.

**Status:** core app built (schema, API, 53 cited interactions, Explore, My meds, end-to-end tests). See the [design spec](docs/superpowers/specs/2026-10-08-core-app-design.md), [implementation plan](docs/superpowers/plans/2026-10-08-core-app.md), [glossary](GLOSSARY.md) and [data sources](docs/data-sources.md).

## Development

Needs Node ≥ 24.11 and pnpm. Layout: `apps/api` (Hono), `apps/web` (React), `packages/schema` (shared zod types), `data/` (curated YAML), `e2e/` (Playwright).

| Command | Description |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm run build:db` | Compile and validate `data/` YAML into `dist/data.db` |
| `pnpm --filter @fdi/web dev` | Web dev server |
| `pnpm --filter @fdi/web build` | Production web build to `apps/web/dist` |
| `pnpm start` | Serve the API on `PORT` (default 8787) |
| `vp check` / `vp test` | Lint, format and type check / unit tests (as in CI) |
| `vp exec playwright test` | End-to-end tests |

`pnpm start` reads `DB_PATH` (default `dist/data.db`) and `STATIC_DIR` (web build to serve; unset = API only). The [Dockerfile](Dockerfile) sets both and deploys via [fly.toml](fly.toml).

---

## Build Session 2

### Idea and choices

I take medications and manage them for a family member; "can I eat this with it?" has no quick, cited, whole-list answer (see [Build Session 1 evidence](#build-session-1-evidence)). Choices:

- **Two views, one dataset.** *My meds* answers my own question (what should I watch, by severity). *Explore* shows the mechanism links so related warnings make sense together.
- **Curated, not scraped.** The research databases are mostly predicted or text-mined, so I hand-wrote 53 interactions, each citing a drug label, NIH fact sheet or review. Their grades are never mapped onto severity.
- **Private by design.** The medication list lives only in the browser's storage; the check runs on the device and never calls the API with a drug name.
- **Small stack.** YAML in git → validated → SQLite → small read API → React app. No accounts, no drug–drug interactions, US drug names, English only.

### Data

`data/` holds 59 drugs (including classes such as statins and MAOIs), 39 foods, 22 mechanisms and 53 interactions as YAML. Sources are DailyMed labels, NIH ODS/NCCIH fact sheets and PubMed reviews, linked but not copied (permission and terms in [docs/data-sources.md](docs/data-sources.md)). Each interaction file carries severity, a plain-language summary and advice, and its citations, so every result on screen traces to a file in `data/` and a source link.

### Run locally

```bash
pnpm install
pnpm run build:db                     # validates data/ YAML, writes dist/data.db
pnpm --filter @fdi/web build          # builds the web app to apps/web/dist
STATIC_DIR=apps/web/dist pnpm start   # app + API at http://localhost:8787
```

For live-reload development run `pnpm start` and `pnpm --filter @fdi/web dev` in two terminals (the dev server proxies `/api` to port 8787). `build:db` fails with a message if any YAML breaks the schema.

### Demo path

1. **Situation:** I'm prescribed Coumadin and I eat salads most days.
2. **Action:** open *My meds*, type `Coumadin`, press Enter. The brand name resolves to **Warfarin**.
3. **Result:** foods to watch appear grouped by severity. *Leafy greens* is a **Caution** with the reason (vitamin K opposes warfarin, INR drops), the advice (keep intake steady rather than avoiding it) and the DailyMed label citation. Reloading keeps the list; no request containing the drug name leaves the browser.
4. **Then explore:** open *Explore*, search `grapefruit`. The panel lists affected drugs, e.g. Simvastatin marked **Avoid**, and the graph shows the CYP3A4 mechanism linking them. The URL is shareable.

The e2e tests in `e2e/` replay these paths (`vp exec playwright test`).

### What works now / before Build Session 3

- **Works:** schema validation, SQLite build, read API, Explore (3D/2D graph, search, side panel, URL state), My meds (brand-name lookup, severity-ordered check, on-device storage), unit and e2e tests, CI, Docker/Fly config.
- **Before Session 3:** deploy the public URL, get feedback from users beyond me, expand beyond 53 interactions, and a pharmacist/clinician review of the severity ratings.

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
