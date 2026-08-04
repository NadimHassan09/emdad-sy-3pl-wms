# Design System Unification Report

**Scope:** Staging tree `/var/www/emdad-sy-3pl-wms-staging`  
**SoT:** Client Portal (visual + interaction patterns)  
**Shared layer:** `shared/design-system` (`@ds`)  
**Audit mode:** Read-only — no code changes in this step  
**Baseline for architecture:** `git HEAD` on branch `staging` (last committed intended state)

---

## Executive verdict

**Admin and Client do not yet share one fully unified Design System.**

| Layer | Shared? | Notes |
|-------|---------|--------|
| Tokens / Tailwind preset / `globals.css` | Partially | Foundation exists; legacy forest CSS still present |
| Admin shell | Yes (`@ds` AppShell / Sidebar / Topbar) | Token-driven chrome |
| Client shell | **No** | Parallel `PortalLayout` with hardcoded Tailwind |
| List headers / soft cards / status pills / table footers | **No** | Client `design-v2/*` vs Admin local clones |
| Forms / buttons / modals | Mixed | `@ds` exists; Admin keeps parallel `Button`, `TextField`, local `DataTable` |

**Client Portal is the visual Single Source of Truth.** `@ds` is an incomplete extraction that Admin consumes for chrome more than Client does.

---

## Critical working-tree warning (must fix before any further UI work)

The **current staging working tree has deleted** core design-system and layout files (uncommitted `D` status). Examples:

- `shared/design-system/tokens.css`, `globals.css`, `ui/index.ts`
- `shared/design-system/ui/{AppShell,Sidebar,Topbar,Button,Card,Modal,EmptyState,…}.tsx`
- `frontend/src/components/{Layout,PageHeader,StatusBadge,DataTable,FilterPanel}.tsx`
- `client-frontend/src/components/PortalLayout.tsx`
- `client-frontend/src/design-v2/{Badge,Card,IconButton,ListPageHeader,TableFooterPagination,statusMeta}.tsx`

**Implication:** Disk state is not buildable / not a valid design-system baseline. Restore these files from `HEAD` (or a known-good commit) **before** implementing migration recommendations. The remainder of this report describes the **intended architecture at `HEAD`**, not the broken overlay.

---

## 1. Checklist: same components?

| Surface | Client (SoT) | Admin | Unified? |
|---------|--------------|-------|----------|
| **Sidebar** | Local `<aside className="… bg-slate-950 border-slate-800">` in `PortalLayout.tsx` | `@ds` `Sidebar` / `SidebarLink` via `Layout.tsx` | **No** — parallel implementations; similar look via tokens |
| **Topbar** | Local `h-16 glass` header + search + local `IconButton` | `@ds` `Topbar` + `TopbarNotifications` + `TopbarUserMenu` | **No** — Admin lacks Client global search (⌘K) in committed Layout |
| **Buttons** | Often raw Tailwind `bg-emerald-600 … shadow-lg shadow-emerald-600/20`; also `@ds` `Button` | Local `frontend/src/components/Button.tsx` **and** `@ds` `Button` | **No** — 2–3 button systems |
| **Cards** | `design-v2/Card` (`rounded-xl border-slate-200/60 shadow-soft`) | Mix of `FilterPanel`/`DataTable` shells + `@ds` `Card` | **No** — SoftCard not a single shared primitive at HEAD |
| **Tables** | Hand-built HTML tables inside soft cards + `TableFooterPagination` | Local `DataTable.tsx` (uses `@ds` `TableCardHeader` only) | **No** — Admin does not use `@ds` `DataTable` |
| **Forms / Inputs** | Mix of raw `input-premium` + shared fields | Local `TextField` / `SelectField` / `Combobox` with filter-panel classes | **No** — not `@ds` `Input` / `Field` |
| **Drawers** | Rare / product drawer patterns in HTML SoT; little `@ds` `Drawer` usage | `@ds` `Drawer` exported; scant page usage | **Underused** — modals dominate both apps |
| **Modals** | Various local modals; some `@ds` | Thin wrapper `Modal.tsx` → `@ds` `Modal`; `ConfirmModal` uses local `Button` | **Partial** |
| **Empty states** | `@ds` `EmptyState` on some pages (e.g. Notifications); lists often use cell copy | Mostly string empties in `DataTable` | **Inconsistent** |
| **Loading states** | Ellipsis / text in many list pages | Dashboard uses `@ds`/`local` Skeletons; tables use “Loading…” cells | **Inconsistent** |
| **Typography** | Inter + `letter-spacing: -0.011em` (Client CSS / HTML SoT) | Shared body tokens via `@ds` globals | **Mostly shared foundation** |
| **Colors** | Emerald `#10B981` / `#059669`, slate-950 sidebar | Tokens aligned at HEAD (`brand-600: #059669`, sidebar `#020617`) | **Tokens yes; leftovers no** |
| **Spacing** | `space-y-5`, `p-4 md:p-6 lg:p-8`, `max-w-7xl` | AppShell padding historically tighter / different grammar | **Divergent page recipes** |
| **Shadows** | `shadow-soft`, `shadow-elevated`, CTA `shadow-emerald-600/20` | Partial (`shadow-soft` on Admin tables); forest-era buttons remain | **Incomplete** |
| **Border radius** | `rounded-xl` cards, `rounded-lg` controls, pill badges | Similar intent; filter fields often `rounded-[10px]` | **Near, not identical** |

---

## 2. Duplicated components

### 2.1 Shell (highest impact)

| Duplicate pair | Paths | Evidence |
|----------------|-------|----------|
| Client sidebar vs `@ds` Sidebar | `PortalLayout.tsx` vs `shared/design-system/ui/Sidebar.tsx` | Client hardcodes `bg-slate-950`; Admin uses `--sidebar-*` tokens |
| Client topbar vs `@ds` Topbar | `PortalLayout.tsx` vs `Topbar.tsx` / `TopbarNotifications.tsx` | Client owns search + local notif dropdown; Admin owns DS menus |
| Chrome icon button | `design-v2/IconButton.tsx` vs `@ds` `IconButton.tsx` | Different APIs (FA string + badge vs ReactNode icon + variants) |

### 2.2 Page chrome / list primitives

| Duplicate | Client | Admin | Notes |
|-----------|--------|-------|-------|
| Page header | `design-v2/ListPageHeader.tsx` | `frontend/src/components/PageHeader.tsx` + `@ds` `AppPageHeader` | Near-identical icon tile + title (`w-10 h-10 rounded-xl bg-emerald-50`) — **triple** |
| Status pill | `design-v2/Badge.tsx` | `frontend/src/components/StatusBadge.tsx` | Same `statusMeta` idea; two renderers (`@ds` also has semantic `Badge`) |
| Soft card | `design-v2/Card.tsx` | Inline shells in `FilterPanel` / `DataTable` | Same visual: `border-slate-200/60 shadow-soft` |
| Table footer | `design-v2/TableFooterPagination.tsx` | Footer inside Admin `DataTable` / `ServerPaginationBar` | Different markup; forest hexes on ServerPaginationBar |
| Class helper | `design-v2/cx.ts` | `@ds` `cn` | Parallel utilities |

### 2.3 Actions / forms

| Duplicate | Client | Admin |
|-----------|--------|-------|
| Primary CTA | Raw emerald button classes on list pages | Local `Button` + `@ds` `Button` + `FILTER_APPLY_BUTTON_CLASS` |
| Text inputs | Raw `input-premium` in filter cards | `TextField.tsx` + `filter-panel-styles.ts` (not `@ds` Input) |
| Confirm dialogs | Varied | `ConfirmModal` → local Modal + local Button |

### 2.4 CSS utilities duplicated

Defined in more than one place at HEAD:

- `.glass`, `.hover-lift`, `.input-premium` — Client `index.css`, Admin `styles.css`, and/or `globals.css`
- Legacy `.btn--primary` / `.sidebar__link--active` still use forest `#1a7a44` in `globals.css`

---

## 3. Inconsistencies (by category)

### Colors
- **Canonical brand (tokens):** `--color-brand-500/#10b981`, `--color-brand-600/#059669`, sidebar `#020617`.
- **Forest leftovers (`#1a7a44` / `#146135`)** still in HEAD:
  - `shared/design-system/globals.css` (`.sidebar__link--active`, `.btn--primary`)
  - `LoginScreen.tsx` hero gradient
  - Admin: `ServerPaginationBar.tsx`, `InboundDetailPage.tsx`, `LocationsPage.tsx`, `LocationsDrillDownTable.tsx`, `AuditLogsPage.tsx`, `WarehouseOverviewMetricCard.tsx`

### Spacing / layout grammar
- **Client list recipe:** `animate-enter space-y-5` → `ListPageHeader` → soft filter `Card` → soft table `Card` → `TableFooterPagination`.
- **Admin list recipe:** Often `FilterPanel` (apply/reset enterprise filters) → titled `DataTable` card; inbound historically lacked `ListPageHeader` at HEAD.
- **Shell:** Client full-bleed `flex h-full bg-slate-50`; Admin AppShell historically used padded/guttered shell in earlier iterations (token/shell alignment improved but PortalLayout still not on AppShell).

### Typography
- Shared font stacks via tokens; Client adds Inter + tracking utilities in portal CSS. Admin depends more on globals alone.

### Tables
- Client: `thead bg-slate-50/80`, cell `px-5 py-3.5`, status via `design-v2/Badge`.
- Admin: local DataTable with emerald-tinted header variants and custom pager (not Client footer).

### Empty / loading
- `@ds` `EmptyState` / `Skeleton` / `PageLoadFallback` exist but are **not** the default list-page pattern in either app.
- Client inbound loading = ellipsis text; Admin = “Loading…” table cell.

### Drawers / Modals
- HTML SoT uses product drawers; codepaths mostly use modals.
- `@ds` `Drawer` is effectively unused in page code (grep at HEAD found no meaningful Drawer consumers).

---

## 4. What already lives in `@ds` (inventory)

Exported at HEAD from `shared/design-system/ui/index.ts`:

- **Form:** Button, IconButton, Input, Textarea, Select, Field, Spinner  
- **Display:** Badge (semantic tone), Card (compound), Skeleton, EmptyState  
- **Overlay:** Modal, Drawer, Tooltip, Portal  
- **Shell:** AppShell, Sidebar*, Topbar*, TopbarNotifications, AppPageHeader, Breadcrumb, PageLoadFallback  
- **Data:** DataTable, Pagination, SearchInput, TableToolbar, TableCardHeader, FilterBar*  
- **Other:** Alert, WorkflowStatus, LoginScreen, statusMeta helpers, filter button class constants  

**Missing from `@ds` relative to Client SoT (must promote):**

| Missing primitive | Current home |
|-------------------|--------------|
| `ListPageHeader` | Client `design-v2` (+ Admin `PageHeader` clone) |
| Soft surface card (`SoftCard` / design-v2 Card) | Client only |
| Status pill (`StatusBadge` as first-class export) | Admin wrapper + Client Badge |
| Chrome `IconButton` (FA + badge) | Client `design-v2/IconButton` |
| `TableFooterPagination` | Client only |
| `PillTabs` | Client only |
| Topbar global search | Client `PortalLayout` only |

---

## 5. Migration recommendations (no code in this step)

### P0 — Restore integrity
1. Restore deleted `@ds`, Layout, PortalLayout, and `design-v2` files from `git HEAD` (or known-good commit).
2. Re-verify Admin + Client staging builds before any design work.

### P1 — Promote Client SoT into `@ds` (one implementation each)
1. Promote **`ListPageHeader`** → deprecate Admin `PageHeader` and converge `AppPageHeader` onto the same API.  
2. Promote **SoftCard** (design-v2 Card) → use for filter + table shells.  
3. Promote **status pill** as `@ds` `StatusBadge` → Client `Badge` and Admin `StatusBadge` become re-exports.  
4. Promote **ChromeIconButton** (or extend `@ds` IconButton carefully without breaking form icon buttons).  
5. Promote **TableFooterPagination** → replace divergent Admin pagers where applicable.  
6. Promote **PillTabs**.  
7. Centralize **`.glass` / `.input-premium` / `.animate-enter` / `.hover-lift`** into `globals.css` once.

### P2 — Point Client shell at `@ds`
1. Refactor `PortalLayout` to compose `@ds` `AppShell` + `Sidebar` + `Topbar` (tokens already match slate-950 / emerald active / glass).  
2. Lift Client search into a shared Topbar slot (`TopbarSearch`).  
3. Prefer `@ds` `TopbarNotifications` on Client instead of bespoke dropdown.

### P3 — Point Admin locals at `@ds` / promoted primitives
1. Delete or thin Admin `Button.tsx` → `@ds` Button (keep filter CTA class constants if needed).  
2. Retire forest hexes (`#1a7a44`) everywhere; use emerald/brand tokens.  
3. Align Admin list pages to Client recipe: header → SoftCard filters → SoftCard table → shared footer.  
4. Prefer `@ds` EmptyState / Skeleton / Modal on list and detail pages.  
5. Stop inventing Admin-only visual variants.

### P4 — Forms unification
1. Map Admin `TextField` / `SelectField` onto `@ds` `Field` + `Input` / `Select` with Client `input-premium` focus ring.  
2. Keep Combobox as shared pattern once (Admin or `@ds`), not a third style.

### Suggested order of page templates
1. Inbound list/detail (reference pair)  
2. Outbound / Products  
3. Billing lists  
4. Remaining modules  

---

## 6. Success criteria (for a future UX audit)

Only after the above:

- Client and Admin both import shell + list primitives from **`@ds` only** (Client `design-v2` may remain as thin re-exports).  
- No Admin-only visual component for anything that exists in Client SoT.  
- No forest `#1a7a44` in app UI.  
- Side-by-side: same sidebar, topbar, buttons, cards, tables, badges, spacing, shadows, radius.  
- Then — and only then — run a UX/UI audit of Admin content against the HTML SoT.

---

## 7. Summary table — promote vs delete/repoint

| Item | Action |
|------|--------|
| Client `PortalLayout` chrome | **Promote pattern into `@ds` shell; Client consumes `@ds`** |
| `ListPageHeader` / Admin `PageHeader` / `AppPageHeader` | **One `@ds` header** |
| `design-v2` Card / SoftCard | **Promote SoftCard** |
| Client Badge / Admin StatusBadge / `@ds` Badge | **One status pill + keep semantic Badge if needed** |
| Chrome IconButton | **Promote** |
| TableFooterPagination | **Promote** |
| PillTabs | **Promote** |
| Admin local Button / TextField / DataTable styling | **Repoint / retire divergence** |
| Forest CSS + hex CTAs | **Delete / retokenize** |
| Duplicate `.glass` utilities | **Single home in globals** |

---

*Report generated for staging design-system verification. No application code was modified as part of this audit.*
