# EMDAD Design System v2 (DS2) — Reference

**Status:** Single source of visual authority for the entire EMDAD platform (Client Portal + Admin Dashboard).
**Source of truth:** `shared/design-system-next/` (tokens, Tailwind preset, primitives), validated in production by `client-frontend/`.
**Purpose of this document:** reverse-engineered reference so the Admin Dashboard redesign never invents new visual language — every decision below is sourced directly from the shipped Client Portal implementation, not proposed anew.

Do not add new tokens or new component APIs while executing the Admin redesign. If something seems missing, it almost certainly already exists under a name below — search this doc first.

---

## 1. Architecture

```
shared/design-system-next/
  tokens.css              — CSS custom properties, :root (light) + .dark overrides
  globals.css              — @tailwind directives, base layer, badge/utility classes
  tailwind.preset.cjs      — maps Tailwind theme keys → var(--token)
  lib/
    use-ui-theme.ts        — light/dark/system state + .dark class toggling
    use-ui-language.ts     — EN/AR state + <html dir> toggling
    use-debounced-value.ts
    sidebar-nav-icons.ts
    statusMeta.ts           — status → {label, tone} normalization
  ui/
    index.ts                — single barrel export, consumed as `@ds`
    *.tsx                    — ~50 primitives (see §4)
```

Both apps alias `@ds` to `shared/design-system-next/ui/index.ts` and use `shared/design-system-next/tailwind.preset.cjs` as a Tailwind preset. **Never** import from `shared/design-system` (v1) in new/updated code — v1 is left in place only for compatibility during transition, not as a design reference.

`darkMode: 'class'` — dark theme is activated by toggling a `.dark` class on `document.documentElement` (and an app-specific root wrapper, e.g. `#client-portal-root`), never via `data-theme` or media-query-only switching. Components never branch on theme in JS for color — they consume CSS variables that flip meaning under `.dark`.

---

## 2. Design tokens

All values live in `tokens.css` as CSS custom properties. Tailwind utility classes (`bg-surface-card`, `text-text-muted`, `border-border-strong`, `shadow-md`, `rounded-card`, `z-modal`, `duration-fast`, `ease-standard`, …) resolve to these variables via the preset — **always prefer the semantic Tailwind class over a raw CSS var**, and always prefer semantic tokens (`text-text-*`, `bg-surface-*`, `border-border-*`) over raw palette classes (`text-slate-700`, `bg-gray-50`) so components stay theme-aware automatically.

### 2.1 Neutral palette (light theme surfaces — slate-based)
`neutral-0` `#fff` → `neutral-50` `#f8fafc` → `100` `#f1f5f9` → `200` `#e2e8f0` → `300` `#cbd5e1` → `400` `#94a3b8` → `500` `#64748b` → `600` `#475569` → `700` `#334155` → `800` `#1e293b` → `900` `#0f172a` → `950` `#020617`.

### 2.2 Dark neutral palette (dark theme surfaces — zinc-based, deliberately NOT slate)
`dark-0` `#000` → `dark-50` `#fafafa` → `100` `#e4e4e7` → `200` `#a1a1aa` → `300` `#71717a` → `400` `#52525b` → `500` `#3f3f46` → `600` `#27272a` → `700` `#1f1f23` → `800` `#18181b` → `850` `#141416` → `900` `#0d0d0f` → `950` `#09090b`.
Used explicitly via `dark:bg-dark-800` etc. — the `neutral-*` Tailwind key is **not** theme-swapped (a raw palette step means something different in each theme), components opt in per-usage instead.

### 2.3 Brand palette — locked identity, never change hue
`brand-50` `#ecfdf5` … `brand-500` `#10b981` … `brand-600` `#059669` (light-theme CTA) … `brand-900` `#064e3b`.
- `--brand-cta` = `brand-600` in light, `brand-500` in dark (`bg-cta` / `text-on-brand`)
- `--brand-cta-hover` = `brand-700` light / `brand-400` dark
- `--brand-cta-active` = `brand-800` light / `brand-600` dark
- `--brand-text-accent` = `brand-600` light / `brand-400` dark (links, active nav text)
- Accent (informational blue, distinct from brand): `accent-50…900`, `#eff6ff → #1e3a8a`.

### 2.4 Semantic state palette
`success` (green), `warning` (amber), `danger` (red), `info` (sky) each have `50/100/200/500/600/700/900` steps. Additional one-off tones: `violet` (`#6d28d9`/`#f5f3ff`/`#ddd6fe`), `orange` (`#c2410c`/`#fff7ed`/`#fed7aa`).

**Status pill tokens** (the only correct way to color a badge) — theme-aware, tinted-bg + matching-fg + border, three per tone: `status-{success,warning,danger,info,neutral,violet,orange}-{fg,bg,border}`. Light values use pastel `*-50` backgrounds with `*-700` text; dark values use ~12% opacity tinted backgrounds with lightened (`400`-ish) text — never invert this convention manually.

### 2.5 Operational warehouse colors (theme-invariant hues, Section B of WMS spec)
`op-inv-increase` / `-bg` (green), `op-inv-decrease` / `-bg` (red), task states `op-task-assigned` (violet) / `op-task-active` (cyan) / `op-task-blocked` (burnt orange), `op-locked` / `-bg` (amber), realtime status `op-syncing` / `op-live` / `op-stale` / `op-offline`, `op-critical`, `op-shortfall` / `op-overage`, expiry `op-expiry-warning` / `op-expiry-critical` / `op-expired`. Use these (not ad-hoc colors) for inventory ledger deltas, task-board states, sync/connection indicators, and expiry badges — directly applicable to Admin warehouse-ops pages.

### 2.6 Surface / text / border tokens (the ones actually used in JSX)

| Token | Light | Dark |
|---|---|---|
| `surface-page` / `surface-app-bg` | `#f8fafc` | `dark-950` `#09090b` |
| `surface-card` | `neutral-0` white | `dark-800` `#18181b` |
| `surface-card-muted` | `neutral-50` | `dark-850` |
| `surface-raised` | `neutral-50` | `dark-850` |
| `surface-elevated` | `neutral-0` | `dark-700` |
| `surface-panel` (dropdowns/popovers) | `neutral-0` | `dark-800` |
| `surface-hover` | `neutral-50` | `white/4%` |
| `surface-active` | `brand-50` | `brand/10%` |
| `surface-sunken` (inputs, table zebra, track bg) | `neutral-100` | `dark-900` |
| `border-default` | `neutral-200` | `white/8%` |
| `border-strong` | `neutral-300` | `white/14%` |
| `border-subtle` | `neutral-100` | `white/5%` |
| `text-strong` (headings) | `neutral-900` | `dark-50` |
| `text-body` (default) | `neutral-700` | `dark-200` |
| `text-muted` (secondary) | `neutral-500` | `dark-300` |
| `text-subtle` / `text-faint` (placeholders, icons) | `neutral-400` | `dark-400` |
| `text-on-brand` | white | white |
| `text-link` | `brand-text-accent` | `brand-text-accent` |
| `skeleton-base` / `skeleton-shine` | `neutral-200`/`100` | `dark-700`/`600` |

Class usage: `bg-surface-card`, `text-text-strong`, `text-text-muted`, `border-border-default`, etc. Never write `bg-white`, `text-slate-900`, `border-gray-200` etc. in new/updated code.

### 2.7 Typography
- Sans (`--font-sans`): Inter → DM Sans → system-ui stack. Mono (`--font-mono`): JetBrains Mono. Arabic (`--font-arabic`): IBM Plex Arabic → Noto Naskh Arabic → Cairo — auto-applied via `[lang='ar']` selector, never hardcode font per-component.
- Base root font-size is **14px** (compact enterprise density), so all `rem`-based Tailwind sizing is already scaled down ~12.5% vs default Tailwind.
- Scale (Tailwind classes → rem, all relative to the 14px root): `text-2xs` .643rem, `text-xs` .714rem, `text-sm` .857rem, `text-base` 1rem, `text-lg` 1.143rem, `text-xl` 1.286rem, `text-2xl` 1.571rem, `text-3xl` 1.857rem, `text-4xl` 2.286rem.
- Line-heights: `leading-tight` 1.2 (headings/2xl+), `leading-snug` 1.35 (xs/sm/lg/xl), `leading-normal` 1.5 (base body), `leading-relaxed` 1.65 (long-form copy).
- Page titles: `text-2xl font-bold text-text-strong` (or `text-xl` for dense sub-pages). Section headers: `text-lg font-semibold text-text-strong`. Body: `text-sm text-text-body`. Meta/caption: `text-xs text-text-muted`. Table headers: `text-[10px]`/`text-2xs` uppercase tracking-wide `text-text-faint`.

### 2.8 Spacing scale (4px base)
`space-0.5` 2px, `1` 4px, `1.5` 6px, `2` 8px, `2.5` 10px, `3` 12px, `4` 16px, `5` 20px, `6` 24px, `8` 32px, `10` 40px, `12` 48px, `16` 64px, `20` 80px, `24` 96px. Standard page padding: `p-4 md:p-6 lg:p-8` inside a `max-w-7xl mx-auto` wrapper (see §6 Grid).

### 2.9 Radius scale
`radius-xs` 3px, `sm` 6px, `md` 8px, `lg` 10px, `xl` 12px, `2xl` 14px, `3xl` 20px, `pill` 9999px. Semantic aliases: `radius-input`/`radius-button` = 8px (`rounded-md`/`rounded-lg` on controls), `radius-card` = 14px (`rounded-card` — cards/panels are noticeably rounder than inputs, this is a deliberate DS2 signature vs the tighter v1 look), `radius-badge` = 6px, `radius-modal` = 16px.

### 2.10 Shadows
`shadow-xs/sm/md/lg/xl/2xl` — soft, low-opacity slate shadows in light theme (e.g. `shadow-sm` = `0 1px 2px rgb(15 23 42/.06), 0 1px 3px rgb(15 23 42/.10)`); in dark theme these are replaced with near-opaque black shadows at the same offsets (depth in dark mode relies more on `border` + subtle white-opacity backgrounds than shadow bloom). `shadow-focus` = `0 0 0 3px var(--brand-ring)` — the **only** focus-ring treatment across the app, applied via `:focus-visible` globally in `globals.css`, so components should not hand-roll `focus:ring-*` in a different color. `shadow-focus-danger` for destructive/invalid fields. `shadow-popover` for floating menus/comboboxes.

### 2.11 Z-index scale
`z-base` 0, `raised` 10, `dropdown` 20, `sticky` 30, `fixed` 40, `overlay` 50, `modal`/`drawer` 60, `popover` 70, `tooltip` 80, `toast` 90, `max` 100. Topbar uses `sticky top-0 z-30`.

### 2.12 Motion
Durations: `instant` 80ms, `fast` 150ms (hover/focus micro-interactions), `base` 200ms (default transitions), `slow` 320ms (panel/drawer enter). Easings: `ease-standard` (default), `ease-emphasis`, `ease-exit`, `ease-spring` (playful confirmations), `ease-decelerate`/`ease-accelerate`. Respect `prefers-reduced-motion` (already globally disabled in `globals.css`, no per-component work needed). Page/section entrance uses the `.animate-enter` utility class (fade + 8px rise, 350ms). Interactive cards use `.hover-lift` (translateY(-1px) + shadow-md on hover) or `.card-interactive` (adds brand-colored border on hover). Table "new row" flash uses the `rowFlash` keyframe (brand-50 fading to transparent over 2s) — reuse for realtime warehouse updates (e.g. new task appears).

### 2.13 Layout constants
`--topbar-h` 64px, `--sidebar-w` 256px, `--sidebar-compact-w` 72px, `--sidebar-w-mobile` 16rem, `--content-max-w` 1440px. Exposed as Tailwind `h-topbar`, `w-sidebar`, `max-w-content` (note: preset also declares `--topbar-h-md`/`topbar-md` but this variable is not currently defined in `tokens.css` — harmless unless referenced; don't rely on it).

---

## 3. Color semantics — decision rules

- **Brand emerald** is reserved for primary actions, active nav states, and the loudest positive affirmation (never for purely decorative accents). Use `bg-cta text-on-brand hover:bg-cta-hover` for primary buttons — not raw `bg-emerald-600`.
- **Accent blue** (`accent-*`, `status-info-*`) is informational only — links inside body copy that aren't nav, "info" badges, neutral chart series.
- **Status badges** always use tone-matched `status-*-{fg,bg,border}` triads, never a single hardcoded hex — this is what makes badges correctly re-tint in dark mode automatically.
- **Operational (`op-*`) tokens** are reserved for warehouse-domain semantics distinct from generic UI status (an inventory *decrease* is domain data, not a generic "error"). Admin warehouse-ops pages (ledger, cycle count, tasks) should reach for these first before reusing `status-danger`/`status-warning`.
- **Sidebar is always dark** (`--sidebar-bg` = `dark-950`) in both light and dark theme — this is a deliberate, validated convention (matches Vercel/Linear/Notion) and must be preserved for Admin exactly as done for Client Portal. Only the **topbar and content canvas** are theme-aware.
- Never inline raw hex in JSX/CSS for anything token-covered. If a genuinely new hue is needed (should be rare), it must be added to `tokens.css` first — not invented inline — and only after confirming no existing token/tone fits.

---

## 4. Component pattern catalog (`@ds` primitives)

Grouped as exported from `shared/design-system-next/ui/index.ts`. Admin should compose these directly rather than rebuilding equivalents — Admin's `Layout.tsx` already imports the same primitive *names* from v1, so the migration is a repoint, not a rewrite (see Phase B).

**Core / Form:** `Button`, `IconButton`, `FaIconButton`, `Input`, `Textarea`, `Select`, `Field`, `TextField`, `SelectField`, `Combobox`, `Spinner`.

**Display:** `Badge`, `StatusBadge` (+ `statusMeta`/`normalizeStatusKey`/`statusLabel` helpers for consistent status → tone mapping), `Card`, `Skeleton`, `EmptyState`.

**Overlay:** `Modal`, `Drawer`, `Tooltip`, `Portal`, `useFocusTrap`.

**Layout:** `PageContainer`, `SectionContainer`.

**Chrome / Shell (Phase 3 architecture):**
- `AppShell` (+ `AppShell.SkipNav`, `AppShell.Body`, `AppShell.Column`, `AppShell.Main`) — the outer shell grid; `AppShell.Main` takes a `noPad` prop when the page wants to control its own max-width wrapper (standard pattern: `<div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">`).
- `Sidebar`, `SidebarBrand`, `SidebarNav`, `SidebarSection` (collapsible, `defaultOpen`), `SidebarLink` (`isActive`, `icon`, `onClick`), `SidebarDivider`, `SidebarFooter`, `SidebarCollapseButton`, `MobileSidebarOverlay`.
- `Topbar` (+ `Topbar.Start`, `Topbar.End`), `TopbarMobileMenuButton`, `TopbarUserMenu`, `TopbarLanguageToggle`, `TopbarThemeToggle`, `TopbarNotifications`.
- `AppPageHeader`, `ListPageHeader`, `Breadcrumb`.
- `PageLoadFallback` (route-level Suspense fallback), `LanguageSwitchOverlay` (full-screen transition shown while `isSwitching` during EN/AR toggle), `LoginScreen` (full-page auth pattern).
- `Alert` (variant-based inline banners), `WorkflowStatus` (step tracker for order/task lifecycles).

**Data (Phase 2 architecture):**
- `DataTable` + `DataTableContainer` (`Column`, `RowState`, `SortDir` types) — the canonical dense table with sticky header, zebra/hover rows, sort.
- `Pagination`, `TableFooterPagination` (+ `ServerPaginationLike`), `SearchInput`.
- `TableToolbar` (+ `DensityToggle`, `RefreshButton`), `TableCardHeader`.
- `FilterBar` (+ `FilterBarToggle`, `FilterBarActions`, `StatusFilter`) and the raw class exports `FILTER_APPLY_BUTTON_CLASS`, `FILTER_RESET_BUTTON_CLASS`, `FILTER_FIELD_LABEL_CLASS`, `FILTER_FIELD_CONTROL_CLASS`, `FILTER_GRID_CLASS` for hand-rolled filter rows that don't use the full `FilterBar` wrapper.

**Hooks/utilities exported from `@ds`:** `cn` (classnames), `useUiLanguage`/`applyUiLanguage`, `useUiTheme`/`applyUiTheme`, `useDebouncedValue`, `renderSidebarNavIcon`.

---

## 5. Navigation rules

- Sidebar composition: `SidebarBrand` (logo + wordmark, `px-5`) → `SidebarNav` (`space-y-0.5`) containing either flat `SidebarLink`s or `SidebarSection`s grouping related routes (Client Portal groups by `Store`/`Warehouse`/`Account`; Admin should preserve its existing WMS/OMS grouping labels — only the *visual* treatment changes) → `SidebarFooter` (profile button, `p-3`).
- `SidebarSection`'s `defaultOpen` is computed from whether any child route `isActive` — sections containing the current route start expanded.
- Active-state detection: exact-match for top-level items (`item.exact`), `pathname.startsWith(item.to)` otherwise.
- Nav icon convention: FontAwesome solid icons (`fa-solid fa-*`) at `text-sm`, one icon per route via a lookup map (`NAV_ICONS: Record<path, faClass>`).
- Badges on nav items (e.g. unread notification count): small pill `bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full`.
- RBAC filtering happens **before** rendering — a `xxxNavForRole(role)` function returns the pre-filtered nav item list; the shell never conditionally hides items with inline role checks. Admin already has an equivalent (`navItemsForRole`) — preserve it as-is, only reskin the rendering.
- Topbar: `Topbar.Start` holds the mobile menu button + global "quick jump" search (`⌘K`/`Ctrl+K`, filters a static destination list client-side, dropdown result list styled as `bg-surface-panel border border-border rounded-xl shadow-xl`). `Topbar.End` holds, left to right: theme toggle → vertical divider (`w-px h-6 bg-border`) → notifications bell → user menu (name, role, language switch, sign out).
- Mobile: `MobileSidebarOverlay` renders the same brand/nav/footer content as the desktop `Sidebar`, toggled by `TopbarMobileMenuButton`.

---

## 6. Grid / layout / responsive rules

- Shell: `AppShell` → `AppShell.Body` (flex row: `Sidebar` + `AppShell.Column`) → `AppShell.Column` (flex column: `Topbar` sticky + `AppShell.Main`).
- Content wrapper inside `AppShell.Main noPad`: `<div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">` — this is the standard page canvas width (note: narrower than the `--content-max-w: 1440px` token, which governs the outer shell, not inner content — `max-w-7xl` = 1280px is the actual content ceiling used everywhere).
- Root wrapper: `<div id="{app}-root" className="h-dvh max-h-dvh overflow-hidden">` wrapping the whole `AppShell` — the document itself never scrolls; only `AppShell.Main` scrolls internally (`html:has([data-app-shell])` gets `overflow:hidden` globally in `globals.css`).
- Dashboard/list grids: KPI/stat cards use `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` (or `lg:grid-cols-3` for fewer cards); two-column content below (e.g. chart + side list) uses `grid grid-cols-1 lg:grid-cols-3 gap-6` with the primary content spanning `lg:col-span-2`.
- Breakpoints follow default Tailwind (`sm` 640, `md` 768, `lg` 1024, `xl` 1280) — no custom breakpoints defined.
- RTL: layout mirrors automatically via `dir="rtl"` on `<html>` + Tailwind `rtl:` variants used explicitly wherever a directional icon/spacing needs manual flipping (arrows, search icon position, `pl-*`/`pr-*` pairs). Never assume CSS logical properties alone are enough — audit every directional icon (`rtl:rotate-180` on back/forward chevrons is the established convention, see §9).

---

## 7. Table pattern

- `DataTable`/`DataTableContainer` is the only table primitive to use for list pages — do not hand-roll `<table>` markup.
- Convention header row: `bg-surface-card-muted` or `bg-surface-sunken`, `text-2xs`/`text-xs` uppercase tracking-wide `text-text-faint`, `divide-border-subtle` row dividers, `hover:bg-surface-hover` row hover.
- Column values: monetary/numeric columns right-aligned with tabular numerals; identifiers (order #, SKU, barcode) use `.text-op` utility (monospace, `text-xs`, forced LTR via `direction: ltr; unicode-bidi: embed` — critical so IDs don't get bidi-reordered in Arabic).
- Loading state: `Skeleton` rows (`bg-skeleton-base`) matching the real row height/column count, not a spinner overlay.
- Empty state: centered `EmptyState` primitive (icon + title + description + optional action), not just "No data" text.
- Filtering: `FilterBar` (or the raw `FILTER_*` class exports for a custom-shaped filter row) above the table, `TableToolbar` for density/refresh controls, `TableFooterPagination` below.
- New-row realtime insert flash uses the `rowFlash` keyframe.

---

## 8. Form pattern

- Every field wraps `Field`/`TextField`/`SelectField`/`Combobox` — never a bare `<input>`/`<select>` with manual label markup.
- Standard field anatomy: label (`text-sm font-medium text-text-body`) → control → optional hint (`text-xs text-text-faint`) below, or error (`text-danger-600 dark:text-status-danger-fg`) replacing the hint when invalid.
- Control chrome: `bg-surface-sunken border border-border-strong text-text-body rounded-md`, focus state uses the global `shadow-focus` treatment (never a custom colored ring).
- Primary submit button: `bg-cta text-on-brand hover:bg-cta-hover`. Secondary/cancel: `border border-border-strong text-text-body hover:bg-surface-hover`. Destructive: `status-danger-*` triad or `Button` `variant="danger"`.
- Full-page Create/Edit forms are a genuinely new archetype not yet built in Client Portal (Client Portal's forms are modal/inline, e.g. `ImageUploadField`) — this is one of the four AIDesigner-adapted patterns in Phase D, still governed by all tokens/primitives above.

---

## 9. Dashboard pattern

Reference: `client-frontend/src/pages/DashboardPage.tsx` + `ClientMetricCard.tsx` + `ClientRecentInvoicesCard.tsx` + `ClientStoragePanel.tsx`.

- KPI row: `ClientMetricCard`-style cards — `bg-surface-card border border-border-subtle rounded-card p-5`, icon in a tinted circle (`bg-brand-50 dark:bg-white/10 text-brand-700 dark:text-brand-300`), label `text-xs text-text-muted uppercase tracking-wide`, value `text-2xl font-bold text-text-strong`, optional trend delta with `status-success`/`status-danger` coloring.
- "Emphasized"/primary KPI card gets a distinguishing treatment: `dark:border-white/10 dark:bg-white/[0.04]`, `dark:hover:border-white/20`, brand-tinted value text.
- Below KPIs: chart card (Recharts) + recent-activity list card in a `grid-cols-1 lg:grid-cols-3` layout (chart spans 2 cols). Chart colors pull from CSS vars directly (`var(--color-brand-500)`, `var(--color-info-500)`, `var(--border-strong)` for gridlines) — never hardcoded hex in chart config.
- Loading uses skeleton blocks shaped like the real content (not a full-page spinner); empty states use `EmptyState`.

---

## 10. Motion & interaction principles (recap)

- Hover affordance on any clickable card/row: subtle `-translate-y-px` + shadow increase (`.hover-lift`/`.card-interactive`), 150ms `ease-standard`.
- Page/section mount: `.animate-enter` (fade + rise, 350ms, `cubic-bezier(0.16,1,0.3,1)`).
- All interactive elements get the global `shadow-focus` ring on `:focus-visible` — no custom focus styling per component.
- Respect `prefers-reduced-motion` (handled globally, do not re-implement per component).

---

## 11. Responsive rules (recap)

- Sidebar collapses to an off-canvas `MobileSidebarOverlay` below `md` (768px); `TopbarMobileMenuButton` only renders below `md`.
- Global search bar in the topbar is `hidden sm:block` (icon-only equivalent not yet needed since Admin can keep parity with Client Portal's approach).
- KPI grids collapse `4→2→1` columns at `lg`/`sm`; two-column content sections collapse to a single stacked column below `lg`.

---

## 12. What this means for the Admin Dashboard

1. Admin's shell (`Layout.tsx`) already composes the identical primitive **names** (`AppShell`, `Sidebar`, `Topbar`, etc.) from v1 — the DS2 migration is a repoint of `@ds` + Tailwind preset + theme wiring, not a rewrite (Phase B/C).
2. ~55-60 of Admin's 86 pages map directly onto the three patterns already validated above (Dashboard §9, Table §7 for List+Detail, and a denser Table variant for Catalog pages) — implement these by reuse, not by AIDesigner generation.
3. Warehouse-domain pages should reach for the `op-*` operational tokens (§2.5) before generic status tokens — this is the one area where Admin content is genuinely different from anything in Client Portal, even though the chrome/tokens are identical.
4. Any new archetype (full-page forms, settings/config, reports/analytics, warehouse task execution) must still resolve every color/spacing/radius/shadow/motion decision to a token or primitive listed in this document — AIDesigner is prompted to *adapt*, not invent, and this document is what "the established Client Portal language" concretely means.
