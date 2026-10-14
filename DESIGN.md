---
name: Food–Drug Interaction Map
description: A pocket field guide to which foods change how your medicines work, why, and how seriously.
colors:
  paper: "#e8e6e1"
  ink: "#1c1b19"
  muted: "#67645e"
  line: "#b9b5ad"
  surface: "#f8f7f4"
  paper-dark: "#1b1a18"
  ink-dark: "#ecebe7"
  muted-dark: "#a29e96"
  line-dark: "#3d3b37"
  surface-dark: "#25241f"
  badge-bg-dark: "#f1efea"
  paper-sand: "#ecd9a0"
  paper-slate: "#c5d0dc"
  paper-sage: "#bcd4a9"
  paper-plum: "#d8c4d4"
  sev-avoid: "#7a2a1c"
  sev-caution: "#6e4f00"
  sev-monitor: "#3d3d3d"
  sev-minimal: "#5c5c5c"
typography:
  headline:
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.12em"
  badge:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
  graph-label:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "9px"
    fontWeight: 400
    letterSpacing: "0.1em"
  severity-meaning:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  fine-print:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0"
  sm: "8px"
  md: "12px"
  pill: "999px"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  button-pill-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  chip-medication:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "4px 6px 4px 12px"
  badge-avoid:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.sev-avoid}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  badge-caution:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.sev-caution}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  badge-monitor:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.sev-monitor}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  badge-minimal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.sev-minimal}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  input-medication:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 10px"
  panel-detail:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "16px"
    width: "min(26rem, 100%)"
---

# Design System: Food–Drug Interaction Map

## Overview

**Creative North Star: "The Field Guide"**

A printed reference you carry to the table. Everything sits on matte paper with a faint film grain, ruled with hairlines and labeled in small monospaced capitals, like specimen tags in a naturalist's guide. Text is ink; the only colored marks that carry meaning are the severity inks, stamped in earth pigments onto light badges. The interface is quiet so the warnings can be read without alarm.

Density is moderate and editorial: one column of findings grouped by severity, a ruled list of entries, a detail panel that reads like a page of the guide. The graph in Explore is the guide's fold-out map: muted grey nodes and faint links until something is selected, then the relevant paths take on severity ink and everything else recedes.

Context is carried by paper colour, not decoration. With the Color toggle on, the paper itself shifts to say what kind of thing you are looking at: sand for the overview, slate for a drug, sage for a food, plum for a mechanism. This rejects three things by name: sterile clinical/hospital UI (white plus medical blue, red-cross alarmism), glowing neon data-viz dashboards, and SaaS defaults (gradient buttons, card grids, rounded-shadow boxes).

**Key Characteristics:**
- Matte tinted paper with an 8% fractal-noise grain over everything.
- Ink on paper; colour reserved for severity and for kind-of-thing wayfinding.
- Monospaced uppercase labels as the guide's tagging voice.
- Hairline (1px) rules and outlines instead of filled boxes.
- Soft pill controls that fill with ink when active.
- Light and dark modes, each with every tint, all contrast-tested to WCAG AA.

## Colors

Muted, earthy, low-chroma: paper and ink first, pigment only where it means something.

### Primary
- **Field Ink** (`ink`): all body text, headings, focus outlines, and the fill of pressed controls and medication chips. It is the system's only "accent" for interaction.

### Secondary
- **Oxblood** (`sev-avoid`): Avoid severity. Badge text and outline, focused graph links (thickest stroke), and the error/offline banner border.
- **Raw Umber Ochre** (`sev-caution`): Caution severity. Badge and focused graph links.
- **Graphite** (`sev-monitor`): Monitor severity.
- **Pencil Grey** (`sev-minimal`): Minimal severity; dashed when drawn as a graph link.

### Tertiary
Wayfinding papers, shown only with the Color toggle on:
- **Sand Paper** (`paper-sand`): overview, nothing selected.
- **Slate Paper** (`paper-slate`): a drug is selected.
- **Sage Paper** (`paper-sage`): a food is selected.
- **Plum Paper** (`paper-plum`): a mechanism is selected.

Each tint is a full six-role palette (paper, ink, muted, line, badge background, surface) in both light and dark mode. `apps/web/src/theme/tokens.ts` holds the full matrix and is the source of truth; `useTheme` writes the active palette to CSS custom properties on `:root`.

### Neutral
- **Stone Paper** (`paper`): page background; the default "grey" world.
- **Bone Surface** (`surface`): raised things ink sits on: inputs, search results, the detail panel, badge backgrounds, unpressed pills.
- **Weathered Grey** (`muted`): mono labels, secondary text, aliases, footer, placeholders, graph labels and unselected nodes; also the outline of every control (inputs, pill buttons), which needs 3:1 non-text contrast.
- **Hairline** (`line`): 1px dividing rules. Decorative only: never the sole boundary of a control.
- Dark mode inverts paper and ink (`paper-dark`, `ink-dark`, …) but keeps badge backgrounds light (`badge-bg-dark`) so the severity inks read the same in both modes.

### Named Rules
**The Pigment Is Meaning Rule.** Severity inks appear only where a severity is being stated: badges, focused interaction links, the danger banner. Never as decoration, headings, or brand colour.

**The Paper Says What It Is Rule.** A tint always signals the selected kind (drug, food, mechanism, overview). Tints are never decorative, never mixed within one view, and always optional behind the Color toggle; grey is the default.

**The Tested Pair Rule.** Every ink/paper, muted/surface and severity/badge pair must pass the AA tests in `theme/tokens.test.ts`. A new colour is not added until its pairs are in that test.

## Typography

**Display Font:** Helvetica Neue (with Helvetica, Arial, sans-serif)
**Body Font:** system-ui (with -apple-system, Segoe UI, sans-serif)
**Label/Mono Font:** ui-monospace (with SF Mono, Menlo, Consolas, monospace)

**Character:** A tight grotesque for headings, the platform's own sans for reading, and a monospace for tags, like a field guide that pairs a bold entry name with typewritten specimen labels.

### Hierarchy
- **Headline** (700, 28px, -0.01em): view titles such as "My meds" and "Foods to watch".
- **Title** (700, 18px, -0.01em): severity group headings; the detail panel's entry name uses the browser-default h2 size.
- **Body** (400, 15px, 1.5): summaries, advice, list entries. Plain-language sentences, kept within the panel's 26rem or the results column.
- **Label** (400, 11px, uppercase, 0.12em): the app title, section tags ("ADD A MEDICATION"), panel breadcrumbs ("FOOD · GRAPEFRUIT AND RELATIVES").
- **Badge** (600, 11px, uppercase, 0.08em): severity badges only.
- **Graph label** (9px mono, 0.1em): node names in the 2D graph.
- **Severity meaning** (400, 15px, sentence case, line-height 1.5, Weathered Grey): the one sentence under each severity group heading in My meds and the Explore panel. Body text, not a label; `.mono-label` stays for true metadata.
- **Fine print** (14px): the persistent disclaimer footer.

### Named Rules
**The Typewritten Tag Rule.** Anything that classifies (kind, group, section, severity) is set in uppercase monospace with open tracking. Anything a person reads as a sentence is set in the body sans, sentence case.

## Layout

A full-height column: top bar (title left, view pills right), the view in a flexible middle, and a ruled footer carrying the disclaimer at all times.

- **My meds** is a two-column grid, input column `minmax(260px, 360px)` beside results, 32px gap, centred at max 1100px. It collapses to one column (16px gap) at 768px and below.
- **Explore** is full-bleed: the graph fills the main area; search and controls float top-left over it; the detail panel docks bottom-right at `min(26rem, 100%)` and up to 80vh, scrolling internally.
- The app title hides at 768px and below to keep the view pills on one line.
- Spacing steps are 4, 6, 8, 12, 16, 24, 32px; 16px is the standard edge gutter.

## Elevation & Depth

Flat by default. Layering is carried by tone (surface over paper), 1px hairlines and `currentColor` outlines, and the ink fill of active controls; the film grain sits over everything at z-index 100 and gives the matte, printed feel. Frosted controls over the graph (below) gain a soft shadow only on hover or focus. Subtle shadows are permitted for genuinely floating elements (search results over the graph, the docked detail panel) if separation ever needs more than a hairline, but they stay soft and low and never become the resting state of in-flow content.

### Frosted Controls
The Explore search input, the unselected explore-bar pills (2D/3D, Mechanisms), the hint and the legend sit over the graph, so at rest they are see-through: `color-mix(in srgb, var(--paper) 55%, transparent)` with `backdrop-filter: blur(8px)` and the `--btn-border` hairline; text colour is unchanged (AA). On hover (`hover: hover`), `:focus-within` or `:focus-visible` they turn solid Bone Surface, the border darkens to `--btn-border-hover` and a `0 6px 24px` shadow appears (0.12 black, 0.4 in dark), over 200ms (none under reduced motion). Selected pills keep the ink fill, an open legend is solid, and the search results list stays solid. Without `backdrop-filter` support everything falls back to solid surface. One shared selector group in `styles.css` carries the recipe.

### Named Rules
**The Hairline First Rule.** Reach for a 1px rule or outline before a shadow. A shadow is allowed only on something that floats over the graph or page, never on in-flow content.

## Shapes

Two corner languages. Controls you press or hold are full pills (999px): view toggles, medication chips, severity badges, the medication input. Surfaces you read are square-cornered: the detail panel, the Explore search field, the error banner. Small radii appear only on My meds' suggestion list (12px, with 8px hover rows), its notice (8px), and the pharmacist chat bubbles (12px).

The Explore search field (square) and the My meds input (pill) currently disagree; treat that as known drift to resolve, not a pattern to copy.

## Components

### Buttons
Quiet and tactile; they look like paper until pressed.
- **Shape:** full pill (999px).
- **Default:** transparent fill, 1px outline at 26% ink, label at 72% ink (the reference's 64% falls under 4.5:1 on the tinted papers; `tokens.test.ts` guards 72% on paper and surface in every tint and mode), 6px 12px padding, 44px minimum height (the panel's close button is a 44×44 square). The same treatment covers Color, the legend's "How to read the map" summary and the panel close. Shared `--btn-border`, `--btn-border-hover` and `--btn-label` tokens live in `styles.css`.
- **Hover** (only where `hover: hover`): outline to 60% ink, label to full ink, both over 200ms. Text pills (`PillLabel`) also slide the label up to reveal a copy beneath it; the copy is CSS content with empty alt text so the name is read once. Reduced motion drops the slide. Selected pills ignore the colour change so paper-on-ink stays legible.
- **Pressed / Selected** (`aria-pressed="true"`; the view tabs use `aria-selected`): fills with Field Ink, text turns paper. Used for the active view (Explore / My meds, a tablist with arrow keys and one tab stop) and the 2D and Mechanisms toggles. Color is a setting, not a view: it sits apart from the view tabs behind a hairline rule, drawn as a text button with a square check mark (filled when on) rather than a pill. On phones the product name shows as the 11px mono label on its own line above the tabs; at rest with an empty Medication list, the Explore hint adds "Taking medicines? Check them in My meds" beside "Try grapefruit".
- **Focus:** 2px ink outline, 2px offset (global `:focus-visible`).
- **Link button:** unstyled underlined text for in-panel navigation.

### Chips
- **Medication chip:** solid Field Ink pill with paper text and a × remove button whose hit area is 44px (negative margins keep the chip compact); one per medication in My meds. The Brand name in parentheses uses a chip-specific muted ink (`--chip-muted`, paper mixed 80% toward ink per tint and mode in `theme/tokens.ts`), at least 4.5:1 on the ink fill in every tint and mode.
- **Not-checked chip:** same pill, but transparent with a 1px dashed ink outline and ink text, plus a "not checked" mono tag before the ×. Marks a name the Dataset doesn't know; always paired with the dashed "Not checked: …" line above Foods to watch.
- **Undo line:** in My meds' status region, "List cleared · Undo" with Undo as an underlined text button (44px tall), shown for 10 seconds after Clear all.

### Severity Badges
The guide's stamp. Pill, light badge background, 1px `currentColor` outline, uppercase mono 600 at 11px, in the severity's ink. Always printed with its word (AVOID, CAUTION, MONITOR, MINIMAL); colour never stands alone.

### Cards / Containers
- **Detail panel:** square, Bone Surface, 1px `currentColor` border, 16px padding, docked bottom-right. Interaction rows are grouped under Severity headings (avoid, caution, monitor, minimal), the same badge, word and subtitle as My meds; a group states once what its rows share ("Applies to …" when every row inherits from the same parent, the Avoid caution sentence), and rows keep only their own summary, advice and details, separated by 20%-ink hairlines. No position counter; Prev/Next are named by the kind browsed ("← Previous food").
- **Warning entries (My meds):** not cards; rows separated by top hairlines. Avoid and Caution rows are open: a lead line (Food, affected Drugs) then each Drug's "What to do" advice, loaded eagerly, with Mechanism, Example exchange and Sources behind one 44px-minimum "Details and sources" disclosure (never nested). Monitor and Minimal rows stay a collapsed `<details>`. The Severity badge appears once, in the group heading; a row or Drug shows its own badge only when its Severity differs from the group's.
- **Notices / banner:** hairline outline on surface; the danger banner uses an Oxblood outline.

### Inputs / Fields
- **Both inputs (Explore search, medication):** inherit the body font at 16px (iOS Safari zooms smaller text on focus) and are at least 44px tall. Both are ARIA comboboxes over a listbox: ArrowUp/Down move the active option, Enter picks it (first by default), Escape closes.
- **Medication input:** pill, Bone Surface, Weathered Grey outline, 10px 14px padding; suggestions below on a 12px-radius surface with 8px-radius rows that fill with paper on hover/focus.
- **Explore search:** square, frosted at rest and solid on hover or focus (see Frosted Controls), hairline outline, 8px 10px padding, max 420px; results as a ruled list with muted aliases and a muted match count.
- **Focus:** global 2px ink outline.

### Navigation
Two pill buttons top-right (Explore, My meds) plus the Color toggle; the active view is ink-filled. In My meds the picker and chips come first, then Foods to watch, then Clear all and See on map (below the picker on desktop, after the results on phones), so the first Avoid row sits high. Every view state (tab, query, selected node, tint) lives in the URL so any view can be shared.

### Interaction Graph
The fold-out map. 2D (d3) and 3D (3d-force-graph) render the same data. At rest: muted grey nodes, interaction links in their severity ink (minimal dashed; 2D opacity 0.75, 3D thin 0.5 cylinders at 0.7), group-member links dotted muted ink at 0.6; mechanisms are unfilled ink outlines. On selection the node fills with ink, its links take their severity ink with weight by severity (avoid 2.4 > caution 2 > monitor 1.6 > minimal 1.2 dashed), and everything else dims to 8–15%. Hovering a node with a mouse lifts it without selecting: it turns full ink and shows its label (3D also grows it to 1.4x and shows a pointer cursor), and its links go full strength and a little wider (3D +0.4 width, severity ink or ink for structure links; 2D opacity 1, 2px). Hover never undoes selection dimming on other elements, and touch never triggers it. Keyboard focus thickens the node outline to 3px ink. Screen-reader rows mirror the graph so it is never the only path.

### Map Legend
A collapsed "How to read the map" disclosure, bottom-left over the graph: square, frosted when closed and solid when open or hovered, hairline outline, mono summary with a +/− marker and a 44px target. Open, it shows the three node shapes, the outlined group/class form, the four severity line samples at their real weights, and one line explaining the Color toggle. With nothing selected and no search, the Explore bar offers "New here? Try grapefruit".

### Motion
Paper and ink cross-fade over 400ms `ease` when the tint or colour mode changes; graph focus/dim changes fade over 200ms. Both are removed under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** set classifications in uppercase mono labels (11px, 0.12em) and sentences (including severity meanings) in the body sans.
- **Do** pair every severity colour with its word in a badge.
- **Do** use the paper tint only to signal the selected kind, and only when the Color toggle is on.
- **Do** separate content with 1px hairlines before reaching for fills or shadows.
- **Do** add new colour pairs to `theme/tokens.test.ts` and keep them at AA (4.5:1) in every tint and mode.
- **Do** keep the disclaimer footer visible on every view.

### Don't:
- **Don't** use sterile clinical styling: white backgrounds with medical blue, red crosses, or alarm-red warnings.
- **Don't** make the graph a glowing neon dashboard; it stays ink and paper on a matte ground.
- **Don't** use SaaS defaults: gradient buttons, card grids, or rounded boxes with drop shadows.
- **Don't** use severity inks for decoration, branding or headings.
- **Don't** put shadows on in-flow content; shadows, if ever used, are for floating layers only.
