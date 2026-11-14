# 11 — Visual (UI layout & regression) testing

Two purposes: **(A) regression baseline** — pixel/DOM comparison so that unintended visual change is caught; **(B) layout correctness** — find alignment, overlap, overflow, clipping, spacing, hierarchy problems like those already seen (buttons overlapping tabs, clipped actions, truncated titles, broken tables on tablet/mobile).

## 1. Baseline assets
`docs/testing/screenshots/staging-admin-frontend-screenshots/<device>/NNN_route.png` — 88 pages × 4 devices (352 images), super_admin, EN, light, data as of 14 Nov 2026. `staging-client-frontend-screenshots/` — login captured; the rest after client login. The baseline is **not an approved design** — it is the *current* state. Each image is classified during phase 3 as `APPROVED` (becomes the golden image), `DEFECT(V-nnn)` or `NEEDS-OWNER`.

## 2. Matrix
Pages (88 + 35) × devices 4 × language EN/AR × theme light/dark × role where UI differs (super_admin, wh_operator, viewer, finance, client_admin, client_staff) = driven by `04a/04b`; **P0 pages get the full matrix, others EN-light on 4 devices + AR-light on desktop/mobile + dark on desktop**.
Browsers: Chromium (baseline), Firefox, WebKit (screens for the client portal), Edge manual spot-check.

## 3. Regression mechanics (phase 2)
* Playwright `toHaveScreenshot` with per-device projects; fixed time (`page.clock`), frozen data via API fixtures or masked dynamic regions (dates, counters, avatars, charts); disable animations; wait for fonts and network idle; `maxDiffPixelRatio` 0.002 for pages, 0 for components.
* Component-level visual snapshots (Playwright CT) for: Button (all variants/states), TextField states, Combobox open/filtered, DataTable (empty/loading/long text/selected), Modal, StatusBadge matrix, FilterPanel, PillSubNav, invoice editable cell states, toast stack, charts.
* Baseline updates only through reviewed PR with owner approval for user-visible changes.

## 4. Layout checklist applied to **every screenshot** (VIS-L-xx) — automated where possible (DOM measurements), otherwise by eye with an annotated image

| ID | Check | Method |
|---|---|---|
| VIS-L-01 | No horizontal page scroll at 390/820/1366/1920 (`scrollWidth == clientWidth` of `html`/`body`), except inside explicit table scrollers | DOM |
| VIS-L-02 | No element clipped by viewport/overflow-hidden (right/left edges) — e.g. client login card on mobile, "Locatio/Deactiv" action buttons | DOM bounding boxes vs parent |
| VIS-L-03 | No overlap between interactive elements (bounding-box intersection test) — e.g. backups header buttons over tabs (V-030), invoice export buttons over title (V-022) | DOM |
| VIS-L-04 | Buttons in the same row share baseline/height/gutter; *no row where one button sits higher/lower by a few pixels* (owner example) | DOM: compare `top`/`height` of siblings, tolerance 1 px |
| VIS-L-05 | Alignment: label ↔ input, columns of a grid, KPI cards equal height, form columns start at same x | DOM + eye |
| VIS-L-06 | Spacing scale: paddings/margins/gaps are multiples of the design token scale; same spacing for same component across pages | computed styles |
| VIS-L-07 | Typography: font families/sizes/weights from tokens; minimum 12 px; line-height; truncation with ellipsis + title tooltip; no one-word-per-line wrapping | computed styles |
| VIS-L-08 | Colour: tokens only; semantic use (red destructive only, green primary, amber warning); consistent status badge palette; dark mode complete (no white islands) | computed styles |
| VIS-L-09 | Icons: aligned with text, same size per context, none missing (finance page-title icon empty square, V-047), correct mirrored in RTL | eye |
| VIS-L-10 | Floating UI (menus, dropdowns, popovers, tooltips, toasts, action cards "flying" after row select): anchored to trigger, not off-screen, not behind other layers, correct z-order | DOM + eye |
| VIS-L-11 | Tables: header sticky/aligned with cells, numeric columns right-aligned (RTL: left), consistent row height, zebra/hover, empty cell dash, long text wrap/ellipsis, order numbers `nowrap` | DOM |
| VIS-L-12 | Cards/sections: equal radii, shadows, borders; title area consistent (icon + title + subtitle); pages w/o title (V-031) | eye |
| VIS-L-13 | Page header pattern identical across pages (title, subtitle, primary action position right, secondary left) | eye |
| VIS-L-14 | Empty/loading/error states consistent (skeleton shape equals content; no perpetual skeleton V-016) | eye |
| VIS-L-15 | Responsive rules per breakpoint (documented): sidebar collapse < 1024? (A-01), table → scroll/cards, filters stack, actions wrap, sticky action bars | eye + DOM |
| VIS-L-16 | RTL: mirrored layout, logical properties (`margin-inline`), numbers LTR inside RTL text, charts axes, pagination arrows, tabs order | eye |
| VIS-L-17 | Images: aspect ratio preserved, placeholders for missing, retina sharpness, QR/barcode crispness | eye |
| VIS-L-18 | Print views: waybill 10×15 cm, A4 documents, margins, page breaks, no sidebar in print | PDF render |
| VIS-L-19 | Text content: no `undefined`, `NaN`, `[object Object]`, raw enums/UUIDs/internal tickets visible | DOM text scan (regex) |
| VIS-L-20 | Dates/numbers/currency formatting consistent per context (A-19) | DOM text scan |
| VIS-L-21 | Scrollbars: nested scroll areas not trapping (map wheel D-018; modal inside page) | interaction |
| VIS-L-22 | Z-index/stacking of sticky header vs dropdowns vs modals vs toasts | interaction |
| VIS-L-23 | Focus/hover/active/disabled/loading states for each interactive element visible and distinct | per component |
| VIS-L-24 | Animation/transition: no layout jump (CLS), skeleton → content stable | Lighthouse/trace |

## 5. Mapping of existing findings to checks
V-004/V-030/V-037 → VIS-L-02/03; V-005/V-008/V-010 → VIS-L-11/15; V-021/V-047 → VIS-L-09/12; V-044 → VIS-L-15; V-048 (client login mobile) → VIS-L-02; V-003 → VIS-L-08. Full list in `16`.

## 6. Output
Per page/device: annotated screenshot (boxes + check ids), verdict, link to defect. A table `page × device × language × theme` showing APPROVED/DEFECT/NEEDS-OWNER counts goes into the final report.
