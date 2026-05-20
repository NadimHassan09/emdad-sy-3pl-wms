# Phase 3 Progress Report
## Layout Modernization & App Shell

**Date completed:** May 2026  
**Admin build (`frontend`):** ✅ Vite 6, 397 modules, no errors  
**Client build (`client-frontend`):** ✅ Vite 8/rolldown, 204 modules, no errors  
**Breaking changes:** None — all pages, routes, API contracts, and workflows preserved

---

## 1. Layout Systems Created

### Shared layout primitives (`shared/design-system/ui/`)

| File | Exports | Purpose |
|------|---------|---------|
| `AppShell.tsx` | `AppShell`, `AppShell.Body`, `AppShell.Main` | Outer viewport scaffolding |
| `Sidebar.tsx` | `Sidebar`, `SidebarBrand`, `SidebarNav`, `SidebarSection`, `SidebarLink`, `SidebarDivider`, `SidebarFooter`, `SidebarCollapseButton`, `MobileSidebarOverlay` | Full sidebar system |
| `Topbar.tsx` | `Topbar`, `Topbar.Start`, `Topbar.End`, `TopbarMobileMenuButton`, `TopbarUserMenu`, `TopbarLanguageToggle` | App chrome header |
| `AppPageHeader.tsx` | `AppPageHeader` | Page-level title + description + actions |
| `Breadcrumb.tsx` | `Breadcrumb`, `BreadcrumbItem` | Navigation breadcrumb trail |

All exported from `@ds` barrel (`shared/design-system/ui/index.ts`).

### Token additions (`shared/design-system/tokens.css`)

```css
--topbar-h:           52px;    /* was 64-96px — saves 12-44px per page */
--sidebar-w:          240px;
--sidebar-compact-w:  56px;    /* new — icon-only compact mode */
--sidebar-w-mobile:   17.5rem;
--content-max-w:      1440px;
--z-topbar:           var(--z-fixed);     /* 40 */
--z-sidebar:          var(--z-fixed);     /* 40 */
--z-mob-overlay:      var(--z-overlay);   /* 50 */
--z-mob-sidebar:      var(--z-modal);     /* 60 */
```

---

## 2. Navigation Systems Created

### AppShell
Stateless flex-column viewport container. Sets `bg-neutral-50` as the page background. `AppShell.Body` provides the flex-row context for sidebar + main. `AppShell.Main` is the scrollable content area with standardized `px-4 py-5 sm:px-5 sm:py-6 md:px-6` padding (overridable via `noPad`).

### Sidebar system
- **`Sidebar`** — `<aside>` with `transition-[width] duration-300 ease-emphasis` between `var(--sidebar-w)` (240px) and `var(--sidebar-compact-w)` (56px). Uses `border-e` (logical, RTL-safe).
- **`SidebarBrand`** — Top brand area, `h-[var(--topbar-h)]` = 52px, synchronized with Topbar height so the top line is visually continuous.
- **`SidebarSection`** — Collapsible group with `<button aria-expanded>` and a rotating chevron. Shows `defaultOpen` when a child is active. In compact mode, renders icon-only with title tooltip.
- **`SidebarLink`** — Styled `<a>` element with `isActive` + `nested` + `collapsed` props. Uses `aria-current="page"` when active. Active state: `bg-brand-50 text-brand-700 font-medium`. Hover: `bg-neutral-100`. Green dot indicator on active non-collapsed links.
- **`SidebarCollapseButton`** — Double-chevron toggle at sidebar bottom. Rotates 180° in compact mode.
- **`MobileSidebarOverlay`** — Full-screen modal dialog (`role="dialog" aria-modal`). Backdrop + sidebar panel. Z-index: overlay (50) for backdrop, modal (60) for panel. Hidden on `md:` breakpoint (desktop).

### Topbar system
- **`Topbar`** — `<header>` with `sticky top-0 z-[var(--z-topbar)]`, exactly `h-[var(--topbar-h)]` = 52px.
- **`Topbar.Start`** — `flex-1` start slot (hamburger + breadcrumb / title).
- **`Topbar.End`** — `ms-auto` end slot (language toggle, user, actions).
- **`TopbarMobileMenuButton`** — Hamburger, `md:hidden`.
- **`TopbarUserMenu`** — Avatar + name + role + online green dot.
- **`TopbarLanguageToggle`** — `<select>` with EN/AR, styled with token radius.

### AppPageHeader
- Replaces the old admin `PageHeader` component (which remains for backward compatibility).
- `title` (ReactNode), `description`, `actions`, `meta` slots.
- `h1` sized `text-lg sm:text-xl` — not oversized.
- Responsive: stacks vertically on mobile, side-by-side on sm+.

### Breadcrumb
- `items: BreadcrumbItem[]` with `label`, `href`, `onClick`.
- Last item is `aria-current="page"`.
- Chevron separator auto-flips RTL via `rtl:scale-x-[-1]`.
- All items truncate with `min-w-0` to prevent overflow.

---

## 3. Migrated Pages

| Page | App | Change |
|------|-----|--------|
| `DashboardOverviewPage` | `frontend` | ✅ **Reference implementation** — AppPageHeader, token colors, logical CSS, semantic table classes |

### Layout files (full rewrites)

| File | Change |
|------|--------|
| `frontend/src/components/Layout.tsx` | Full rewrite: 2-col slide-out → single-col collapsible sidebar; 64-96px topbar → 52px; all `#1a7a44` → token classes |
| `client-frontend/src/components/PortalLayout.tsx` | Full rewrite: CSS-class-based → Tailwind token classes; same AppShell/Sidebar/Topbar primitives as admin |

---

## 4. Spacing Decisions

| Element | Before | After | Rationale |
|---------|--------|-------|-----------|
| Topbar height | 64–96px | 52px | Dense enterprise chrome — saves 12–44px per page |
| Sidebar width | 72px + 168px (2 cols) | 240px / 56px | Standard single-column, compact mode for tight displays |
| Main content padding | `px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6` | `px-4 py-5 sm:px-5 sm:py-6 md:px-6` | Uniform across both apps |
| Page header bottom margin | `mb-4 sm:mb-5` | `mb-5` | Consistent vertical rhythm |
| StatCard padding | `p-4` | `p-4` | Unchanged — operational density preserved |
| Nav section label height | n/a | `h-8` | Compact section headers, no oversized groups |
| Nav link height | per-section ~40px | `h-auto py-1.5` = ~32px | Tighter nav, more items visible above fold |

---

## 5. Operational UX Decisions

### Single-column collapsible sidebar (replacing 2-column slide-out)
The old admin sidebar used a 2-column "slide panel" approach: a narrow icon strip on the left that slid in a secondary panel on click. This was unusual for enterprise SaaS and had RTL issues (`translate-x-full` always translated physically left regardless of direction). The new design uses a standard collapsible tree (Linear / Vercel / Notion pattern):
- Section labels always visible → better scanability
- Active section auto-expands on load → no extra click to see current context
- Compact mode (icon-only) for small screens or operator preference
- Standard `aria-expanded` chevron — keyboard-accessible

### Topbar height reduction (96px → 52px)
The original topbar occupied up to 96px on desktop — nearly 10% of a 1080p screen height. At 52px, it matches modern enterprise SaaS chrome density (Linear: 44px, Vercel: 48px, Notion: 45px). The logo moves to the sidebar brand area. The topbar becomes a thin functional bar: mobile hamburger + user + language.

### Token-based color system fully applied to DashboardOverviewPage
All `bg-[#1a7a44]`, `text-[#1a7a44]`, `border-[#1a7a44]`, `focus-visible:ring-[#1a7a44]` replaced with:
- `bg-brand-600` / `text-brand-600` / `border-brand-600`
- `hover:bg-brand-700`
- `focus-visible:shadow-focus` (from Phase 1 global token)
This makes the page immediately themeable and consistent with the design system.

### Both apps use the same shared layout primitives
Client portal and admin dashboard now share AppShell, Sidebar, Topbar, AppPageHeader from `@ds`. This means:
- One visual change fixes both apps
- Spacing, border styles, focus states, animation durations — identical
- "One product" feel achieved through shared primitives, not copied code

### `dir="ltr"` on operational identifiers
Order numbers, lot numbers, and SKUs in DashboardOverviewPage are wrapped in `<span dir="ltr">`. This ensures codes like `IN-2024-00123` remain left-to-right inside the RTL Arabic UI (spec §A.7).

---

## 6. Responsive Improvements

| Breakpoint | Layout |
|------------|--------|
| `< md` (< 768px) | Topbar only. Sidebar hidden. Hamburger opens `MobileSidebarOverlay`. |
| `md+` (≥ 768px) | Sidebar visible (240px expanded, 56px compact). |
| All widths | `AppShell.Main` uses `overflow-auto` — tables scroll horizontally without breaking layout. |
| Logo visibility | Mobile: logo in topbar (`md:hidden`). Desktop: logo in sidebar brand area (`hidden md:flex`). |

---

## 7. RTL Considerations

All new primitives use CSS logical properties exclusively:

| Physical property | Logical equivalent used |
|-------------------|------------------------|
| `border-right` | `border-e` |
| `border-left` | `border-s` |
| `padding-left/right` | `ps-*` / `pe-*` |
| `margin-left: auto` | `ms-auto` |
| Sidebar position | `inline-start: 0` (via flex-row logical order) |
| Breadcrumb chevron | `rtl:scale-x-[-1]` to flip physical SVG |

The mobile sidebar correctly appears on the inline-start edge in both LTR and RTL because the `MobileSidebarOverlay` uses `flex` with the panel as the first child — flex direction reverses automatically with `dir="rtl"`.

The `SidebarCollapseButton` chevron uses `rotate-180` which is direction-neutral.

---

## 8. Accessibility Improvements

- `<aside aria-label="Main navigation">` on Sidebar
- `<nav aria-label="Main navigation">` on SidebarNav
- `<button aria-expanded={isOpen}>` on SidebarSection toggles
- `<a aria-current="page">` on active SidebarLink
- `role="dialog" aria-modal="true" aria-label="Navigation menu"` on MobileSidebarOverlay
- `<nav aria-label="Breadcrumb">` + `<ol>` structure + `aria-current="page"` on last item
- `TopbarUserMenu` avatar is `aria-hidden` (decorative) — name + role rendered as visible text
- `TopbarMobileMenuButton` has `aria-label`
- All interactive elements have `focus-visible:shadow-focus` from Phase 1 global tokens
- `SidebarCollapseButton` has `aria-label` that changes between expand/collapse context

---

## 9. Performance Considerations

- Zero new external dependencies added
- `AppShell`, `Topbar`, `Sidebar` are all stateless presentational components — no render side effects
- Sidebar collapse state (`sidebarCollapsed`) lives in `Layout.tsx` — single state update, no context overhead
- `SidebarSection` manages its own open/closed state locally (no global nav state)
- `MobileSidebarOverlay` returns `null` when closed — no DOM nodes rendered when hidden (conditional render, not CSS `hidden`)
- The width transition (`transition-[width] duration-300`) uses CSS-only animation — no JS in the animation path

---

## 10. Technical Debt Discovered

1. **Admin `PageHeader` component** (`frontend/src/components/PageHeader.tsx`) still exists and is used by non-migrated pages (InboundListPage, OutboundListPage, etc.). It will need to be replaced page-by-page with `AppPageHeader` from `@ds` as pages migrate. Both coexist for now.

2. **Client portal CSS classes still in `globals.css`** (`.sidebar`, `.topbar`, `.app-shell`, `.sidebar__link`, etc.) — these are legacy from the pre-Phase-3 `PortalLayout.tsx`. Since the new PortalLayout uses Tailwind classes, these CSS rules are now dead code. However, they must remain until all client portal pages are audited and confirmed not to use them.

3. **`SidebarSection` in compact mode** currently shows a tooltip via `title` attribute (browser native tooltip). For Phase 4+, replace with the `Tooltip` primitive from `@ds` for consistent styling and RTL positioning.

4. **Breadcrumb not yet wired to any page** — the `Breadcrumb` component is built and exported but not integrated into the topbar on any page yet. Integration requires route-aware breadcrumb state (useMatches from react-router-dom). Phase 4 should wire this up as part of page-by-page migration.

5. **`AppShell.Main` padding** is controlled by the shell itself (`px-4 py-5`). Some existing pages add their own top-level `space-y-6` or `mb-4` wrappers — these will create double-spacing on migrated pages. Audit needed during Phase 4 per-page migration.

6. **No global search or notification slots** — the topbar has slots for these but they are not implemented. The spec calls for "global search placeholder" and "notifications placeholder". These are Phase 4+ concerns.

---

## 11. Layout Inconsistencies Discovered

1. **Admin pages use `PageHeader` with `mb-4 sm:mb-5`** while the new `AppPageHeader` uses `mb-5`. Migrated pages will gain 4px bottom margin compared to unmigrated pages.

2. **Admin `Layout.tsx` outer `<div key={language}>`** forces a React tree remount on language change (to re-render all child components with new Arabic translations). This is a pre-existing pattern that works but causes a full unmount/remount. A proper i18n solution (Phase 4+) would eliminate this.

3. **`DashboardOverviewPage` has inline `isArabic` detection** using `localStorage.getItem` — same pattern as other pages. This creates a snapshot at render time and doesn't update when language changes without a remount. This is mitigated by the `key={language}` on the outer div in Layout.tsx.

---

## 12. Operational UX Concerns Discovered

1. **Task execution view (`TaskExecutionView.tsx`)** is ~2,500 lines and does NOT use the shared Layout. It has its own full-screen overlay. Ensure Phase 4 does not accidentally wrap it inside the new AppShell main area.

2. **Warehouse tablet usage**: The 240px sidebar consumes significant horizontal space on 768-1024px tablets. The compact mode (56px) should be the default on tablet breakpoints. Consider adding a breakpoint-aware default: auto-collapse at `lg` (1024px) and below.

3. **SidebarSection always shows all task subtypes** (Receive, Putaway, Pick, Pack, Delivery) in the Tasks section — 7 items total. This may be overwhelming for operators who only need 1-2 types. Phase 4 could add permission-aware task type visibility.

---

## 13. Tablet / Mobile Usability Concerns

- Mobile sidebar overlay uses `max-w-[85vw]` cap — ensures the backdrop is always visible to tap-close on narrow phones
- The topbar on mobile shows only the page brand name (not breadcrumbs) — breadcrumbs are desktop-first
- `AppShell.Main` content padding on mobile: `px-4 py-5` — sufficient for touch targets

---

## 14. Future Realtime-Layout Compatibility

The `Topbar.End` slot is pre-wired for:
- `TopbarUserMenu` — with `connected` prop (already shows green dot)
- Notifications icon (empty slot — ready for a bell icon + badge)
- Realtime connection status indicator (can be added as a small colored dot or text)

The `WorkflowUxProvider` wrapping `<Outlet>` is preserved inside `AppShell.Main`, so all realtime task execution behavior remains intact.

---

## 15. Remaining Legacy Layout Systems

### Admin (`frontend/`)
All non-dashboard pages still use the old `PageHeader` component from `frontend/src/components/`. No per-page layout changes have been made. All pages continue to function.

### Client portal (`client-frontend/`)
All pages except `InboundOrdersPage` (Phase 2) still use the legacy CSS classes (`.main`, `.card`, `.card__title`, etc.) from `globals.css`. The layout shell (`PortalLayout.tsx`) is modernized, but page content is unchanged.

---

## 16. Recommended Next Steps Before Phase 4

1. **Per-page admin migration** — Replace `PageHeader` with `AppPageHeader` on `InboundListPage`, `OutboundListPage`, `InventoryPage`, `TasksListPage` (highest-traffic pages first).

2. **Breadcrumb wiring** — Use `useMatches` from react-router-dom to generate breadcrumb items dynamically. Wire `Breadcrumb` into `Topbar.Start` or `AppPageHeader`.

3. **Auto-compact sidebar on tablet** — Add `useEffect` in `Layout.tsx` that calls `setSidebarCollapsed(true)` when `window.innerWidth < 1024`.

4. **Tooltip for compact sidebar** — Replace `title` attribute on `SidebarLink` in compact mode with the `Tooltip` primitive from `@ds` for consistent styled tooltips.

5. **Dead CSS audit** — Identify and remove unused `.sidebar*`, `.topbar*`, `.app-shell*` CSS classes from `globals.css` after all client portal pages are migrated.

6. **i18n extraction** — The `sidebarLabel()` inline dictionary in `Layout.tsx` and page-level `dashboardLabel()` functions should be centralized into a `useT()` hook backed by locale JSON files.

7. **Code-split admin bundle** — Admin bundle is 1,067KB (300KB gzipped). Use dynamic `import()` for heavy pages (TaskExecutionView, LocationsPage) to reduce initial load.

---

*Phase 3 complete. Both apps share the same AppShell/Sidebar/Topbar/AppPageHeader architecture. Reference implementation (DashboardOverviewPage) is live. All existing pages and workflows are preserved.*
