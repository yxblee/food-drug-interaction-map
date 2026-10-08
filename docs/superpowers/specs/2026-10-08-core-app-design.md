# Food-Drug Interaction Map — Core App (Part A) Design

Date: 2026-10-08
Status: Draft for review

## 1. Purpose

A web app that shows which foods interact with which drugs, why, and how seriously, backed by citations.

Two audiences, served by two equal modes over one dataset:

- **Patients and caregivers** (*My meds* tab): "I take these drugs. What should I watch out for eating?" Plain language, severity first, practical advice.
- **Researchers and students** (*Explore* tab): an interactive graph of drugs, foods, and the mechanisms connecting them (e.g. grapefruit → CYP3A4 inhibition → simvastatin).

### Success criteria

- At least 50 approved, cited interactions in the seed set at launch, covering the well-known high-impact pairs (warfarin/vitamin K, MAOIs/tyramine, statins/grapefruit, levothyroxine/calcium and coffee, tetracyclines/dairy, etc.).
- Every published interaction has a severity, at least one mechanism, and at least one citation. The build enforces this.
- A patient can enter their medications (including brand names) on a phone and see a severity-ordered list of foods to watch, without their medication list leaving the device.
- A researcher can find any drug, food, or mechanism, see its neighborhood in the graph, and share that exact view by URL.

### Scope split

This spec covers **Part A: the core app**: data model, curated seed data, read API, and web frontend.

**Part B: the curation pipeline** (openFDA label mining → pending candidates → admin review queue) is a separate spec. Part A only reserves the data fields Part B needs (`status`, `source`, `reviewed_at`).

### Out of scope for Part A

User accounts; the openFDA pipeline and admin UI; drug-drug interactions; non-English content; non-US drug naming; sound effects (the design reference has them; skipped).

### Disclaimer

The app is informational, not medical advice. A persistent footer says so and points users to their pharmacist. Every `avoid`-severity interaction repeats a one-line caution in its detail view.

## 2. Data model

### Source of truth

Curated data lives in git as YAML, one file per entity, under `data/`:

```
data/
  drugs/        warfarin.yaml, statins.yaml, simvastatin.yaml, ...
  foods/        citrus.yaml, grapefruit.yaml, leafy-greens.yaml, kale.yaml, ...
  mechanisms/   cyp3a4-inhibition.yaml, vitamin-k-antagonism.yaml, ...
  interactions/ grapefruit--simvastatin.yaml, leafy-greens--warfarin.yaml, ...
```

Changes go through pull requests, so every data change is a reviewable diff. A build step validates the YAML and compiles it into SQLite. The SQLite file is a build artifact and is never edited by hand.

IDs are lowercase kebab-case slugs and equal the filename without extension. Interaction IDs are `<food-id>--<drug-id>`.

### Entities

**Drug**

| Field | Type | Notes |
|---|---|---|
| `id` | slug | |
| `name` | string | Display name, e.g. "Warfarin" |
| `aliases` | string[] | Brand and alternate names, e.g. ["Coumadin", "Jantoven"]. Searchable. |
| `group` | boolean | `true` for a drug class (e.g. `statins`, `maois`). Default `false`. |
| `parent` | slug? | ID of the class this drug belongs to. Must reference a drug with `group: true`. |
| `drug_class` | string? | Free-text pharmacological class for display. |
| `rxnorm` | string? | RxNorm CUI. Optional; used by Part B to match openFDA labels. |

**Food**

| Field | Type | Notes |
|---|---|---|
| `id` | slug | |
| `name` | string | |
| `aliases` | string[] | e.g. kale: ["curly kale", "lacinato"] |
| `group` | boolean | `true` for a food group (e.g. `citrus`, `leafy-greens`, `aged-cheeses`). |
| `parent` | slug? | ID of the group this food belongs to. Must reference a food with `group: true`. |
| `category` | enum | `fruit` · `vegetable` · `dairy` · `meat-fish` · `grain` · `beverage` · `alcohol` · `supplement` · `other` |

Hierarchy is **one level only**: a group cannot have a parent. That covers the real cases (class → drug, group → food) without recursive resolution.

**Mechanism**

| Field | Type | Notes |
|---|---|---|
| `id` | slug | e.g. `cyp3a4-inhibition` |
| `name` | string | e.g. "CYP3A4 inhibition" |
| `kind` | enum | `enzyme` · `transporter` · `pharmacodynamic` · `absorption` · `other` |
| `explanation` | string | Plain-language explanation, 1–3 sentences. |

**Interaction**

| Field | Type | Notes |
|---|---|---|
| `id` | slug | `<food>--<drug>` |
| `food` | slug | A food or a food group. |
| `drug` | slug | A drug or a drug class. |
| `mechanisms` | slug[] | At least one. |
| `severity` | enum | `avoid` · `caution` · `monitor` · `minimal` |
| `effect` | enum | `increases` · `decreases`. Direction of the effect on drug level or action. |
| `summary` | string | One plain sentence for patients. |
| `advice` | string | What to do in practice. |
| `details` | string | Mechanism-level explanation for researchers (Markdown allowed). |
| `example` | object? | `{ patient: string, pharmacist: string }`: a short realistic exchange. |
| `citations` | Citation[] | At least one. |
| `status` | enum | `approved` · `pending` · `rejected`. Part A publishes `approved` only. |
| `source` | enum | `curated` · `openfda` |
| `reviewed_at` | date | ISO `YYYY-MM-DD`. Date a human last checked the entry against its citations. |

**Citation**

| Field | Type | Notes |
|---|---|---|
| `type` | enum | `label` · `review` · `study` · `guideline` |
| `title` | string | |
| `url` | URL | |
| `pmid` | string? | PubMed ID |
| `setid` | string? | DailyMed SPL set ID (for `label` citations) |

Summaries and details are written in our own words. Citations are links, not copied text.

Severity meanings, shown to users as a legend:

- `avoid`: Don't combine. Risk of serious harm.
- `caution`: Limit or keep intake consistent. Talk to your pharmacist.
- `monitor`: Usually fine. Watch for symptoms or have levels checked.
- `minimal`: Documented but rarely clinically important.

### Group resolution

An interaction can target a group or class, and a specific food or drug can override it. For a concrete pair (food F, drug D), with F's group Fg and D's class Dc, the effective interaction is the **first match** in this order:

1. `F--D`
2. `F--Dc`
3. `Fg--D`
4. `Fg--Dc`

A more specific entry fully replaces less specific ones for that pair. For example, `orange--simvastatin` (`minimal`) overrides `citrus--simvastatin` (`caution`) for orange, while grapefruit still inherits from citrus unless it has its own entry.

When a group-level interaction is shown for a specific item, the UI labels it "applies to <group name>".

### Validation

Zod schemas in `packages/schema` define all entities. The build step (`scripts/build-db.ts`) fails, and therefore CI fails, on:

- Any schema violation (missing field, bad enum, bad URL, empty `citations` or `mechanisms`)
- Unknown referenced ID (`food`, `drug`, `mechanisms[]`, `parent`)
- `parent` pointing at a non-group, or a group having a `parent`
- Duplicate interaction for the same `food--drug` pair, or a filename/ID mismatch
- Alias collisions (the same alias on two different drugs, or on two different foods)

## 3. Architecture

### Repository layout

```
data/                      YAML source of truth
packages/schema/           Zod schemas + inferred TypeScript types (shared)
apps/api/                  Hono server on Node; reads SQLite; serves built web app
apps/web/                  React + TypeScript frontend
scripts/build-db.ts        YAML → validate → SQLite (dist/data.db)
docs/                      specs, ADRs, agent config
```

Vite+ (`vp`) manages the workspace: dev server, build, Vitest, Oxlint.

### Stack

- **Frontend:** React + TypeScript, built with Vite+.
- **Graph rendering:** `3d-force-graph` (three.js + d3-force-3d) for 3D; D3 (`d3-force`, `d3-zoom`) rendering to SVG for 2D.
- **API:** Hono on Node.
- **Database:** SQLite via `better-sqlite3` + Drizzle ORM, read-only at runtime.
- **Deploy:** one Docker container (API serves the static web build and the baked-in `data.db`), hosted on Fly.io.

### Build and deploy flow

1. `scripts/build-db.ts` reads `data/**/*.yaml`, validates, and writes `dist/data.db`.
2. `vp build` builds `apps/web` to static assets.
3. The Docker image bundles the API, the web assets, and `data.db`.
4. Data changes ship by merging a YAML PR, which triggers rebuild and redeploy.

## 4. API

Read-only JSON. Every response sets `Cache-Control: public, max-age=300` plus an `ETag` derived from the data build hash, since data only changes on deploy. Only `approved` interactions are ever returned.

### `GET /api/search?q=<text>`

Case-insensitive prefix and substring match over drug and food names and aliases, groups included. Prefix matches rank above substring matches. Returns at most 20 results:

```json
[{ "kind": "drug", "id": "warfarin", "name": "Warfarin", "matched": "Coumadin", "group": false }]
```

An empty or missing `q` returns `[]`.

### `GET /api/graph`

The full published graph in one compact payload, used by both the Explore overview and My meds:

```json
{
  "version": "<data build hash>",
  "nodes": [{ "kind": "drug|food|mechanism", "id": "...", "name": "...", "aliases": ["..."], "group": false, "parent": "..." }],
  "interactions": [{ "id": "...", "food": "...", "drug": "...", "mechanisms": ["..."], "severity": "...", "effect": "...", "summary": "...", "advice": "..." }]
}
```

Heavy fields (`details`, `example`, `citations`, mechanism `explanation`) are excluded and are fetched per node.

### `GET /api/node/:kind/:id`

Full detail for one node: its fields, its parent, its children (for groups), and every interaction touching it, including inherited group interactions (marked with `via: "<group-id>"`), with `details`, `example`, `citations`, and mechanism explanations.

Unknown kind or ID → `404 { "error": "not_found" }`.

### Privacy

The API never receives a user's medication list. My meds runs entirely in the browser over `/api/graph`. The server logs no query strings and runs no analytics.

## 5. Frontend

### Shell

Two tabs, **Explore** and **My meds**, sharing one side panel component, one search component, and the global controls (palette toggle; on Explore, 2D/3D and mechanisms toggles).

All view state lives in the URL so every view is shareable:

| Param | Meaning |
|---|---|
| `tab` | `explore` (default) · `meds` |
| `q` | search text |
| `node` | selected node, `<kind>:<id>` |
| `view` | `3d` · `2d` |
| `mech` | `1` show mechanism nodes (default) · `0` collapse |
| `tint` | `1` tinted palette · absent = grey |

My meds' medication list is **not** in the URL (privacy). It lives in `localStorage` only.

### Visual language

Modeled on aicodingdictionary.com:

- Warm grey "paper" background with a subtle CSS grain overlay; monochrome nodes, edges, and UI.
- Uppercase monospace node labels; bold grotesque sans for headings; quiet sans for body text.
- Node size scales with interaction count. In 3D, grey value encodes depth.
- Node type by shape and tone: drug ● filled circle, food ■ filled rounded square, mechanism ◆ small hollow diamond. Group nodes get a double outline.
- **Severity accent** is the only color in grey mode: `avoid` deep red-brown, `caution` ochre, `monitor` dark grey, `minimal` light grey. Severity is always a text badge too, never color alone.

**Palette toggle** (grey ↔ tinted), persisted in `localStorage` and in the URL as `tint=1`:

- Tinted mode recolors the whole UI in shades of a single hue, as the reference does.
- The hue follows context: warm sand with no selection; slate blue when a drug is selected; sage green for a food; muted plum for a mechanism.
- Hue changes cross-fade over 400 ms, or switch instantly under `prefers-reduced-motion`.
- Severity badges keep their accent colors on a light inner background in every tint. A contrast-check script (run in the test suite) asserts WCAG AA (4.5:1 for badge text) for every tint × severity × light/dark combination.

Dark mode follows `prefers-color-scheme`: charcoal paper, with dark variants of each tint.

### Graph rendering

Both renderers implement one interface and contain no React:

```ts
interface GraphRenderer {
  mount(el: HTMLElement): void
  setData(graph: RenderGraph): void            // nodes + edges after mechanism collapse
  select(nodeId: string | null): void          // focus, camera move, neighbor highlight
  highlight(nodeIds: Set<string> | null): void // search matches; null clears
  onSelect(cb: (nodeId: string | null) => void): void
  destroy(): void
}
```

React owns the panel, search, tabs, and URL state, and calls into the active renderer. It never re-renders the canvas.

**Renderer choice:**

- Mobile (`(max-width: 768px), (pointer: coarse)`): **2D only**; the 2D/3D toggle is hidden and `view=3d` in the URL is ignored.
- Otherwise: **3D by default**, with a toggle to 2D.
- No WebGL available → 2D, toggle hidden.
- `prefers-reduced-motion` → 2D by default, no auto-rotation, no edge particles. The user can still switch to 3D.

**Mechanism toggle:**

- On: edges run food → mechanism → drug, with mechanism nodes shown. Grapefruit → CYP3A4 inhibition → (all affected statins) becomes visible as a hub.
- Off: mechanism nodes hidden; each interaction is a single food → drug edge whose thickness and tone encode severity. Collapsing is a pure function, `collapseMechanisms(graph) → RenderGraph`.

Group membership is drawn as faint dotted child → parent edges in both modes.

### Explore tab

- **Overview:** 3D sphere slowly auto-rotating (2D force layout on mobile). Edges are faint until something is focused. Drag to rotate or pan, scroll or pinch to zoom.
- **Search** (top-left, `/` to focus): live results with an "N MATCHES" count. Matching nodes highlight and others dim. Enter or click selects.
- **Selection:** focus ring, camera eases to the node, neighbors brighten, everything else dims. Particles flow along edges in the direction food → mechanism → drug (3D, motion allowed).
- **Side panel** (right on desktop, bottom sheet on mobile):
  - Header: kind and group label ("FOOD · CITRUS"), a position counter "12 / 140" (alphabetical order within the current search results, or all nodes), name.
  - Body for a drug or food: interaction rows sorted by severity. Each row shows severity badge, the counterpart, summary, advice, and "applies to <group>" if inherited. Expanding a row shows details, mechanisms (linked), the example exchange in chat-bubble style (after the reference's "heard in the wild"), and citations.
  - Body for a mechanism: explanation, then all interactions that use it.
  - Footer: Prev / Next. Keyboard: ← → for prev/next, `Esc` to close.
- **Accessibility:** 2D SVG nodes are focusable with accessible names. The 3D canvas is `aria-hidden` and is accompanied by a visually hidden, screen-reader-accessible list of the current focus node's neighbors and interactions.

### My meds tab

- **Add medications:** a type-ahead over drug names and aliases (client-side over `/api/graph` nodes; "Coumadin" resolves to Warfarin). Shows each added drug as a removable chip, plus a "Clear all" button. The list is stored in `localStorage` and a line states: "Your list stays on this device."
- **Results:** "Foods to watch," grouped by severity (`avoid` → `minimal`). Each food row lists which of the user's drugs it affects, the summary, and the advice, and expands into the same detail view as Explore (fetched from `/api/node`).
- Aggregation is a pure client-side function, `checkMeds(graph, drugIds) → FoodWarning[]`, using the group-resolution rules from §2. When one food hits several of the user's drugs, it appears once, at its highest severity, listing all affected drugs.
- **"See on map":** switches to Explore with the graph filtered to the user's drugs and their interacting foods (this filter is passed in memory, not in the URL).
- No graph is required to use this tab. It works as plain, readable content on any phone and with a screen reader.
- **Empty states:** no meds added → a short prompt with examples. Meds with no known interactions → "No food interactions in our dataset for these drugs," plus a reminder that the dataset is not exhaustive.

### Error handling

- `/api/graph` fails → a banner with Retry; the canvas area shows the error state, never a blank canvas.
- `/api/node` 404 (stale URL) → the panel shows "Not found," the selection clears, and the URL `node` param is removed.
- Unknown medication ID in `localStorage` (removed from the dataset) → dropped from the list on load, with a one-time notice.

## 6. Testing

- **Data:** the build step is the data test suite (§2 Validation). CI runs it on every PR.
- **Unit (Vitest):** pure functions with no DOM:
  - Group resolution: precedence order, override behavior, "applies to" labeling.
  - `checkMeds`: aggregation, dedupe across drugs, severity ordering, inherited interactions.
  - `collapseMechanisms`: food → mechanism → drug becomes food → drug carrying the interaction's severity.
  - URL state: encode/decode round-trip; invalid params fall back to defaults.
  - Tint contrast check: all tint × severity × light/dark combinations pass WCAG AA.
- **API (Vitest + Hono `app.request()`):** against a fixture database built from `apps/api/test/fixtures/*.yaml`. Covers `/search` (name, alias, and brand matches; prefix ranking; empty `q`), `/graph` (shape, approved only), and `/node` (inherited interactions with `via`, 404s).
- **End-to-end (Playwright), at desktop (3D) and mobile (2D) viewports:**
  - Explore: search "grapefruit", select it, and the panel shows a simvastatin row with an `avoid` badge. Reloading the URL restores the same view.
  - My meds: add "Coumadin", and results include leafy greens at `caution`. The list survives a reload.
- **Medical accuracy:** a human gate, not automated. The PR template for `data/` changes requires the reviewer to confirm each changed summary, severity, and advice against its citation, and to update `reviewed_at`.
