# Phase 1 — Foundation & Design System — Progress Report

> **Status:** Complete.
> **Scope:** Design system foundation only (tokens, theme architecture, primitive components, RTL-ready CSS architecture). No pages were redesigned, no workflows touched, no API contracts changed, no realtime work.
> **Reference:** [`docs/Wms enterprise frontend spec extended.md`](../../Wms%20enterprise%20frontend%20spec%20extended.md) — Sections A (RTL/i18n), B (Operational Color System), H.5 (Focus management), H.6 (ARIA live), G.2 (Touch targets).

---

## 1. What was refactored

### 1.1 New shared design-system layout

```
shared/
└── design-system/
    ├── tokens.css            ← NEW   single source of truth for design tokens
    ├── globals.css           ← REFACTORED  imports tokens, base layer, badges
    ├── tailwind.preset.cjs   ← REWRITTEN   maps tokens into Tailwind theme
    └── ui/                   ← NEW   primitive component library
        ├── index.ts          (barrel export — consumed via `@ds` alias)
        ├── cn.ts             tiny className combiner
        ├── types.ts          Size / Variant / Tone / OperationalStatus
        ├── Field.tsx         a11y label/helper/error wrapper
        ├── Spinner.tsx
        ├── Button.tsx        primary / secondary / subtle / ghost / danger
        ├── IconButton.tsx
        ├── Input.tsx         w/ adornments + Field a11y
        ├── Textarea.tsx      dir="auto" by default
        ├── Select.tsx        native + chevron, RTL-aware
        ├── Badge.tsx         operational status colour map (Section B.3)
        ├── Card.tsx          Card / Card.Header / Card.Body / Card.Footer
        ├── Skeleton.tsx      shimmer w/ reduced-motion respect
        ├── EmptyState.tsx
        ├── Modal.tsx         focus-trap + Escape + portal + scroll-lock
        ├── Drawer.tsx        side="start"/"end" (logical), portal, focus-trap
        ├── Tooltip.tsx       hover + focus, logical positioning
        ├── Portal.tsx        lazy-creates #ds-portal-root
        ├── useFocusTrap.ts   keyboard focus containment hook
        ├── PageContainer.tsx max-width + responsive padding
        └── SectionContainer.tsx  title/description/actions header
```

### 1.2 App wiring

Both apps were updated to consume the shared library without breaking existing imports.

| App | Change | File |
|-----|--------|------|
| `frontend/` (admin) | Vite alias `@ds` → shared barrel | `vite.config.ts` |
| `frontend/` | tsconfig `paths` + shared `include` | `tsconfig.json` |
| `frontend/` | Tailwind `content` includes shared UI dir | `tailwind.config.js` |
| `client-frontend/` | Same Vite alias | `vite.config.ts` |
| `client-frontend/` | Same tsconfig wiring | `tsconfig.json` |
| `client-frontend/` | Same tailwind content | `tailwind.config.js` |

After wiring, **both `frontend` and `client-frontend` build cleanly** (`npm run build` passes TS + Vite for both). No existing page was modified — primitives are additive.

### 1.3 Design tokens (`tokens.css`)

Single root file exposes every system value as a CSS custom property. Tokens map 1:1 into the Tailwind preset and into primitive component styles.

| Category | Tokens |
|----------|--------|
| **Neutral palette** | `--color-neutral-0` … `--color-neutral-950` (12 stops) |
| **Brand palette** | `--color-brand-{50…900}` (canonical green `#1a7a44` preserved as `--color-brand-600`) |
| **Accent palette** | `--color-accent-{50…900}` (blue family) |
| **Semantic palettes** | `--color-{success,warning,danger,info}-{50…900}` |
| **Operational colours** | `--color-inv-{increase,decrease,neutral}-*`, `--color-task-{assigned,active,blocked}-*`, `--color-locked-*`, `--color-{syncing,live,stale,offline}`, `--color-critical-*`, `--color-expiry-{warning,critical}`, `--color-{shortfall,overage,expired}` — every operational state from Section B of the spec |
| **Surfaces** | `--surface-{app-bg, card, card-muted, elevated, overlay, divider, border, border-strong}` |
| **Text tones** | `--text-{strong, body, muted, subtle, inverse, link, link-hover}` |
| **Typography** | `--font-{sans, mono, arabic}`, type scale `--text-{2xs…4xl}`, `--leading-{tight…relaxed}`, `--tracking-*` |
| **Spacing** | `--space-{0, px, 0_5, 1, 1_5, 2, 2_5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24}` (4 px base) |
| **Radius** | `--radius-{none, xs, sm, md, lg, xl, 2xl, 3xl, pill}` + aliases `--radius-{input, button, card, badge, modal}` |
| **Shadows** | `--shadow-{xs, sm, md, lg, xl, 2xl, focus, focus-danger, inset}` — dark-safe rgba on `#0f172a` |
| **Z-index** | `--z-{base, raised, dropdown, sticky, fixed, overlay, modal, drawer, popover, tooltip, toast, max}` |
| **Motion** | `--duration-{instant, fast, base, slow}` + `--ease-{standard, emphasis, exit}` |
| **Layout** | `--topbar-h(-md)`, `--sidebar-w(-mobile)`, `--content-max-w` |

Legacy aliases (`--app-page-bg`, `--app-primary`, `--app-border`, etc.) are preserved as references into the new tokens — every existing page-level class keeps working.

### 1.4 `globals.css` refactor

- Imports `tokens.css` first (required by PostCSS @import rule).
- `body` now uses `--font-sans` and `--surface-app-bg` from tokens.
- Added a single global `:focus-visible` ring (Section H.5 spec) using `--shadow-focus`.
- Added a global `@media (prefers-reduced-motion)` guard — disables transitions for users who request it.
- Added `.sr-only` utility (used by the `Field` primitive and the future `LiveRegion`).
- Added keyframes: `shimmer` (Skeleton), `fadein`, `modalEnter`, `drawerInRight`, `drawerInLeft`.
- Added an Arabic typography override block: `[lang='ar']` switches to `--font-arabic`, neutralises uppercase/letter-spacing on table headers.
- Existing `.badge`, `.badge-draft`, `.btn`, `.card`, sidebar/topbar classes remain intact for backward compatibility.

### 1.5 Tailwind preset rewrite

`tailwind.preset.cjs` is rewritten as a thin mapping over `tokens.css`. Every value resolves to a CSS variable, so:

- `bg-brand-600` → `var(--color-brand-600)` — future dark theme can swap variables without touching components.
- `shadow-md`, `z-modal`, `font-arabic`, `rounded-card`, `duration-fast`, `max-w-content` all resolve through tokens.
- Operational colours exposed as Tailwind classes: `bg-op-inv-increase-bg`, `text-op-inv-decrease`, `bg-op-task-blocked-bg`, etc.
- Legacy `primary.*` palette is kept as an alias of `accent.*` so existing pages that use `bg-primary-600` continue to work.

---

## 2. Reusable systems created

### 2.1 Primitive library (`@ds`)

| Primitive | Purpose | Key behaviours |
|-----------|---------|----------------|
| `Button` | Standard button with variants/sizes | RTL-safe icon slots (start/end), loading spinner, focus ring |
| `IconButton` | Icon-only square button | `aria-label` required at type level; lg = 48 px tablet target |
| `Input` | Text input with label/helper/error | `Field` a11y wiring, start/end adornments, logical padding |
| `Textarea` | Multi-line input | `dir="auto"` default for bilingual notes |
| `Select` | Styled native select | RTL-aware chevron position, options array or children |
| `Field` | Label/helper/error wrapper | Auto-generates IDs + `aria-describedby` + `aria-invalid` |
| `Badge` | Status pill | Operational status map (Section B.3) + soft/solid/outline + dot |
| `Card` (+ Header/Title/Body/Footer) | Surface container | `elevation`, `padding`, `interactive` variants |
| `Skeleton` | Loading placeholder | Shimmer; honours `prefers-reduced-motion` |
| `EmptyState` | "No data" presentation | Title/description/action/secondary action |
| `Modal` | Accessible dialog | Portal, focus trap, Escape, body-scroll lock, ARIA dialog |
| `Drawer` | Side panel | `side="start"/"end"` (logical), same a11y guarantees |
| `Tooltip` | Hover/focus tooltip | Logical positioning, `aria-describedby` |
| `Spinner` | Loading indicator | Used inline by Button/IconButton |
| `Portal` | Top-level DOM mount | Lazy-creates `#ds-portal-root` |
| `PageContainer` | Top-level page wrapper | Bounded width, responsive padding, optional header slot |
| `SectionContainer` | Grouped section | Title/description/actions + consistent vertical rhythm |
| `useFocusTrap` | Focus containment hook | Used by Modal/Drawer; returns focus on close |
| `cn` | `clsx`-lite | No new dependency added |

### 2.2 Semantic colour system (Section B fidelity)

- The operational status badge map of Section B.3 is encoded once in `Badge.STATUS_TO_TONE`. Every status (`draft`, `confirmed`, `receiving`, `in_progress`, `complete/completed`, `shipped`, `cancelled`, `assigned`, `active`, `blocked`, `suspended`, `archived`, `approved`, `pending`) renders the same way everywhere it is used.
- Operational state colours (Section B.2 — inventory increase/decrease, lease/lock, syncing/live/stale/offline, critical, expiry, shortfall, overage) are first-class Tailwind classes via the `op-*` namespace and CSS variables.
- Colour is never the only signal — Badge accepts `dot` + `startIcon` so each status carries an additional visual cue (Section B.7 a11y requirement).

### 2.3 RTL-ready architecture

- Every primitive uses logical Tailwind utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) — zero physical `ml-/mr-/pl-/pr-/left-/right-`.
- Drawer uses `side="start" | "end"` (not `"left" | "right"`) and flips automatically based on `dir`.
- Tooltip side `start`/`end` are also logical.
- Select chevron uses `rtl:bg-[position:...]` to mirror cleanly.
- Arabic font stack and per-language typography tweaks are wired in `globals.css` so simply setting `<html lang="ar" dir="rtl">` (which the apps already do on language change) switches the typography stack.

### 2.4 Accessibility-ready foundation

- Single uniform `:focus-visible` ring across all primitives and pages.
- `forced-colors` (Windows high-contrast) is handled by the `:focus-visible` ring leaning on `box-shadow` rather than removing outlines outright.
- `prefers-reduced-motion` globally suppresses animations.
- `Field` generates correct `aria-describedby` / `aria-invalid`.
- Modal & Drawer trap focus, return focus on close, lock body scroll, render through a portal.
- `IconButton` requires `aria-label` at the TypeScript type level — impossible to ship a nameless icon button.
- `LiveRegion` is not built yet (Phase 6), but the `.sr-only` utility and `aria-live` patterns are in place for it.

---

## 3. Architectural decisions

1. **Tokens live in CSS, not TypeScript.** A single CSS custom-property surface is consumed by both Tailwind (via the preset) and primitives (via inline `style={{ var(--…) }}` for radii). This means future themes (dark mode, brand re-skin) only need a new `:root` block, not a code change.
2. **No new runtime dependency.** Phase 1 deliberately introduced zero new npm packages. `clsx` was replaced by a 30-line `cn.ts`. Modal/Drawer use a hand-rolled focus trap rather than `react-aria` or `@radix-ui/*` — keeping the bundle small and the SDK control surface understood. We can upgrade these to Radix in a later phase if/when we hit limits.
3. **Primitives are unopinionated.** They expose props that map to semantic intent (`variant`, `tone`, `status`), never visual specifics (`color`, `boxShadow`). Pages can compose without knowing tokens.
4. **Backward compatibility over big-bang.** Every legacy class (`.btn`, `.btn--primary`, `.card`, `.badge-*`, sidebar/topbar classes) was preserved with the same visual output. Phase 1 does NOT require any page migration — pages continue to ship as-is until Phase 2/3 starts migrating them deliberately.
5. **`@ds` barrel as the single entry.** Both apps import from `@ds` so future package extraction (npm-style `@emdad/wms-design-system`) is a refactor of import paths only.
6. **TypeScript path-mapping for `react`.** Because the shared TSX files live outside each app's `src/` directory, app `tsconfig.json` files now include explicit `paths` for `react`, `react/jsx-runtime`, `react-dom`, and `react-dom/client`. This makes `tsc --noEmit` succeed when traversing the shared library.

---

## 4. What remains (next phases)

These are explicitly OUT OF SCOPE for Phase 1 and are listed only so the team knows what to expect.

| Item | Phase per spec |
|------|----------------|
| i18n library (`react-i18next`) + locale files | Phase 3 |
| `useLanguageSwitch` hook (sets `lang` + `dir` atomically) | Phase 3 |
| Operational status badge migration of existing pages | Phase 2 |
| DataTable v2 with sticky columns + virtual scroll | Phase 1 (per blueprint) — to be implemented next sprint |
| FilterBar primitive | Phase 2 |
| Workflow stepper + state colours | Phase 5 |
| Toast / LiveRegion / Error boundary primitives | Phase 4–6 |
| Realtime status context, connection state machine | Phase 4 |
| Production-safe error mapping (`classifyError`, `useOperationalError`) | Phase 4 |
| Keyboard shortcut system (`⌘K`, J/K navigation) | Phase 6 |
| Print-mode CSS | Phase 6 |
| Permission-aware components (`PermissionGate`, `RequireRole`) | Phase 3 |
| Scanner-aware input primitive | Phase 5 |
| Tablet sticky action bar | Phase 5 |
| Dark mode (token swap is ready; CSS rule + toggle pending) | Future |

---

## 5. Technical debt discovered

| # | Item | Severity | Where surfaced |
|---|------|----------|----------------|
| 1 | Both apps have their own `Button`, `Modal`, `Badge` implementations that duplicate the new `@ds` primitives. Migration to `@ds` is needed across pages. | Medium | Inventory in `docs/frontend/admin/03-components-and-api.md` |
| 2 | Mixed brand colours — admin uses `--app-primary: #2563eb` (blue) while sidebar active state is `#1a7a44` (green). Phase 1 standardises on green for primary actions but the admin's existing topbar/buttons still resolve to blue. Page migrations need to choose one. | Medium | Section 4.4 of admin styling docs |
| 3 | Hard-coded hex values still present in many page-level CSS (`.app-main`, `.sidebar__link--active`, `.btn--primary`). Marked for cleanup during Phase 2 page migration. | Low | `globals.css` lines 200–460 |
| 4 | `client-frontend` has no `@types/react` direct dependency check — current build works because npm hoists, but a clean install could break. Consider adding `react`/`react-dom` types to the shared library's own `package.json` once it becomes a publishable package. | Low | TS path-mapping workaround in `tsconfig.json` |
| 5 | The admin frontend bundle is already at **1,050 kB** (303 kB gzip). Code-splitting (Section H.10 of the spec) was deferred to Phase 6 polish. | Low | Vite warning in build output |
| 6 | Tooltip primitive uses pure-CSS positioning — collision detection will be inaccurate in tight viewports. A Popover primitive with floating-ui is queued for Phase 5 when workflow steppers need rich popovers. | Low | `Tooltip.tsx` JSDoc |

---

## 6. Risks for next phases

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migrating existing pages to `@ds` primitives could surface dozens of layout regressions | High | Medium | Migrate incrementally per page; keep legacy classes in `globals.css` until each page is verified. |
| RTL switching today does not update the `lang` attribute (spec A.3 bug). Operational copy and number formatting may render incorrectly in Arabic until Phase 3 lands `useLanguageSwitch`. | Medium | Medium | Phase 1 primitives already use logical CSS, so layouts will flip correctly the moment `dir` changes. Typography needs `lang` for the Arabic font swap — without it, the Arabic stack still falls through to Tahoma/system fonts (acceptable but not ideal). |
| The two apps run different React majors (`frontend` is React 18, `client-frontend` is React 19). Shared primitives must remain compatible with both. | Medium | Medium | Primitives avoid any React 19-only API. Verified by parallel builds in both apps after each batch of changes. |
| `Modal`/`Drawer` focus trap is a baseline implementation — not yet hardened against complex DOM (iframes, custom focusable elements via `tabindex`). | Low | Low | Will be upgraded in Phase 6 alongside `LiveRegion` and `useFocusTrap` extensions. |
| Operational colour additions (Section B) are not yet used by any page — only available. If pages start using them ad-hoc, naming drift could re-emerge. | Medium | Low | Badge primitive enforces the canonical mapping. Page audits in Phase 2 should reference `STATUS_TO_TONE` rather than hand-rolling. |
| Tailwind 3 logical-property class names (`ms-*`, `me-*`) require Tailwind ≥ 3.3. Both apps are on 3.4.17 — safe today, but worth pinning in any future upgrade. | Low | Low | Document in `package.json` engines / Tailwind upgrade SOP. |
| Bundling: when both apps eventually consume `@ds` heavily, the admin app bundle may exceed 1.2 MB without code-splitting. | Medium | Medium | Phase 6 will introduce route-level lazy loading. Until then, primitives are tree-shakeable individually (no barrel side effects). |

---

## 7. How to consume

```tsx
import { Button, Modal, Badge, PageContainer, SectionContainer } from '@ds';

function OrderActions({ order }) {
  return (
    <SectionContainer
      title="Actions"
      actions={
        <>
          <Button variant="ghost" size="sm">Export</Button>
          <Button variant="primary" startIcon={<CheckIcon />}>Confirm Order</Button>
        </>
      }
    >
      <Badge status={order.status} dot>{order.statusLabel}</Badge>
    </SectionContainer>
  );
}
```

- Use `<Badge status="confirmed">` (canonical) over `<Badge tone="accent">` (ad-hoc) wherever possible.
- Use `<Drawer side="end">` instead of `right` so RTL flips automatically.
- Use `<PageContainer header={<PageHeader … />}>` as the outermost shell of every new page.
- Use the `Field` primitive directly when building custom controls so a11y wiring stays consistent.

---

## 8. Verification

- `npm run build` in `client-frontend`: ✅ TS + Vite both clean, 30.6 kB CSS / 378.4 kB JS (117 kB gzip).
- `npm run build` in `frontend`: ✅ TS + Vite both clean, 58.5 kB CSS / 1,050 kB JS (303 kB gzip — pre-existing, code-splitting deferred to Phase 6).
- No existing page or workflow was modified. Routing, data flow, API calls, business logic, and realtime behaviour are unchanged.

---

*End of Phase 1 progress report. Phase 2 will begin with FilterBar + DataTable v2 primitives and the first page migration (Inbound Orders list) as a reference implementation.*
