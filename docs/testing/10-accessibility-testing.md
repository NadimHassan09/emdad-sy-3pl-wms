# 10 — Accessibility testing

**Standard.** WCAG 2.2 AA as target (the system is a business tool used by staff all day; clients may use phones). English + Arabic (RTL). Light + dark.
**Tools.** axe-core (Playwright `@axe-core/playwright`, `jest-axe` in component tests), Lighthouse a11y, pa11y-ci, WAVE (manual), keyboard-only runs, NVDA (Windows, Arabic + English voices) and VoiceOver (iOS/macOS) for the P0 flows, Chrome "forced colors"/high-contrast, browser zoom 200 %/400 %, `prefers-reduced-motion`.
**Applies to:** all 88 admin + 35 client page entries in `04a/04b`, all shared components (`02`), PDF outputs (tagged PDF/readable text for GRN/DN/invoice).

## 1. Automated sweeps (every page × 4 devices × EN/AR × light/dark)

| ID | Check | Pass |
|---|---|---|
| A11Y-AUT-001 | axe: zero *serious/critical* violations per page and per open modal/menu state | 0 |
| A11Y-AUT-002 | Lighthouse accessibility ≥ 95 | ≥ 95 |
| A11Y-AUT-003 | Colour contrast: text ≥ 4.5:1 (3:1 large), UI components/borders ≥ 3:1 — **especially** grey helper text, status badges (green/amber/red on tinted bg), disabled-looking buttons, sidebar grey on black, placeholders, chart colours | 0 failures; list tokens to fix (note existing duplicate `--text-link` token bug class) |
| A11Y-AUT-004 | Landmarks: one `main`, nav, header, skip link; heading order (page title H1 exists — shipping companies has none, V-031) | OK |
| A11Y-AUT-005 | Every form control has a programmatic label; `aria-describedby` for hints/errors | OK |
| A11Y-AUT-006 | Names for icon-only controls: sidebar collapsed links (D-041 `[object Object]`), row ⋯, fee-rate ✎ ▶ ⏸, copy buttons, close ×, eye icon, language chip, bell | meaningful names |
| A11Y-AUT-007 | Tables: `th scope`, caption/aria-label, sortable header announces `aria-sort`, row selection checkbox names ("Select OUT-2026-04465" — already good) | OK |
| A11Y-AUT-008 | Language attributes: `lang`/`dir` update on language switch; mixed-language strings tagged | OK |
| A11Y-AUT-009 | Images: alt text for product images (decorative `alt=""`), QR codes in waybill have text equivalent | OK |
| A11Y-AUT-010 | Page title (`<title>`) unique per route (currently "EMDAD 3PL WMS" on every admin route; "Client Portal" for client) — SPA route announcements | per-route title |

## 2. Keyboard (A11Y-KEY) — manual + scripted

| ID | Scenario | Expected |
|---|---|---|
| A11Y-KEY-001 | Tab through every page start→end: order logical, no traps, focus visible (≥ 2 px, 3:1) | OK |
| A11Y-KEY-002 | Sidebar: arrow keys optional; `Enter` opens; collapsed state accessible; Ctrl+K quick jump: open, type, ↑↓, Enter, Esc, focus return | OK |
| A11Y-KEY-003 | Combobox/searchable dropdown: Down opens, type filters, Enter selects, Esc closes and keeps focus, Home/End | WAI-ARIA combobox |
| A11Y-KEY-004 | Modal: focus moves in, trapped, Esc closes, focus returns to opener; nested confirm | OK |
| A11Y-KEY-005 | DataTable: sortable header via Enter/Space; row action menu via keyboard; row open via Enter | OK |
| A11Y-KEY-006 | Date pickers, toggles ("Remember me"), radio cards (COD policy), chips (custom role permissions), tabs (pill sub-nav, report tabs) | arrow-key behaviour per ARIA APG |
| A11Y-KEY-007 | Bulk selection with Shift/Ctrl? header checkbox tri-state | |
| A11Y-KEY-008 | QR scan modal: manual entry fallback fully keyboard operable; scanner wedge input | |
| A11Y-KEY-009 | Toasts do not steal focus; are announced (`role=status`/`alert` by severity); dismiss by keyboard | |
| A11Y-KEY-010 | No keyboard shortcut conflicts with screen readers/browser (Ctrl+K) and can be disabled | |

## 3. Screen reader (A11Y-SR) — P0 flows only (login, create OMS order, approve, ship, COD confirm, invoice edit, client order create)

| ID | Scenario | Expected |
|---|---|---|
| A11Y-SR-001 | Login (EN+AR): fields, errors, remember-me, show-password announced | OK |
| A11Y-SR-002 | List page: table announces headers/row/col counts; status badges have text; pagination announces range; filter results count live region | OK |
| A11Y-SR-003 | Forms: required, invalid, error summary, dependent dropdown changes announced | OK |
| A11Y-SR-004 | Dashboards/charts: text alternative or data table for each chart (PieChart, reports) | OK |
| A11Y-SR-005 | Status changes (toast, realtime badge) announced politely | OK |
| A11Y-SR-006 | Arabic content read with Arabic voice; numerals; mixed Latin codes (INB-2026-00063) read sensibly | OK |
| A11Y-SR-007 | Inline-editable invoice cells: role/state ("editable", "locked") and save result announced | OK |

## 4. Visual accessibility and adaptive behaviour (A11Y-VIS)

| ID | Scenario | Expected |
|---|---|---|
| A11Y-VIS-001 | Zoom 200 % and 400 % (1280 px reflow) on all list/form/detail kinds | no loss, no horizontal scroll except data tables |
| A11Y-VIS-002 | Text-only zoom / large fonts (OS setting), line-height 1.5 override | no clipping |
| A11Y-VIS-003 | Colour is never the only signal (status chips have text, red/green) | OK |
| A11Y-VIS-004 | `prefers-reduced-motion`: animations/skeleton shimmer reduced | OK |
| A11Y-VIS-005 | High-contrast/forced-colors: buttons/borders/focus visible | OK |
| A11Y-VIS-006 | Dark mode contrast (A11Y-AUT-003 repeated) | OK |
| A11Y-VIS-007 | Touch targets ≥ 44×44 CSS px (WCAG 2.2 target size 24 minimum; project goal 44) on mobile/tablet: table row actions, pagination, icon buttons, chips | OK |
| A11Y-VIS-008 | Orientation: tablet landscape/portrait; no orientation lock | OK |
| A11Y-VIS-009 | Time limits: session expiry warning with extend option | |
| A11Y-VIS-010 | Error identification & prevention: destructive actions confirm; forms allow review (financial) | |

## 5. Documents (A11Y-DOC)
GRN/DN/invoice/contract/waybill PDFs: selectable text (not images), Arabic shaping + reading order, language metadata, sufficient contrast, QR plus human-readable code.

## 6. Reporting
For each page: axe JSON, list of violations with selector + screenshot, and *who is affected* (keyboard/screen-reader/low-vision). Release rule: no open serious/critical violations on P0 flows; others tracked.
