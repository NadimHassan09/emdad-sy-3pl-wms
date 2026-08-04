# Frontend Architecture Audit

**Role:** Staff Frontend Architect  
**Scope:** Admin (`frontend/`), Client Portal (`client-frontend/`), shared design system (`shared/design-system/`)  
**Baseline:** Committed `HEAD` on staging (intended architecture)  
**Critical overlay:** Working tree has mass deletions of core `@ds` barrel/shell, both app layouts, and most `design-v2` — **disk ≠ HEAD; tree is not a coherent build source until restored**

---

## Verdict

There is **no single frontend architecture**. There are **three overlapping UI stacks**:

1. **`@ds`** — path-aliased source folder (not a package), partial chrome + shelfware primitives  
2. **Admin local components** — de facto component library (`Button`, `DataTable`, `FilterPanel`, `PageHeader`, …)  
3. **Client `design-v2`** — list/status visual SoT for the portal, parallel to `@ds`

Client additionally **imports Admin internals via `@wms/*`** while running **React 19 / Vite 8 / Router 7** against Admin’s **React 18 / Vite 6 / Router 6**. That is structural coupling debt, not a shared design system.

---

## 1. Package topology

| Unit | Path | Stack | Packaging |
|------|------|-------|-----------|
| Admin app | `frontend/` | React **18.3**, Vite **6**, RR **6** | Private app `emdad-wms-frontend` |
| Client app | `client-frontend/` | React **19.2**, Vite **8**, RR **7** | Private app `client-frontend` |
| Design system | `shared/design-system/` | Tokens + UI barrel | **No `package.json`** — Vite/TS path only |
| design-v2 | `client-frontend/src/design-v2/` | Soft-card list primitives | App-local, not shared |
| Task schemas | `packages/wms-task-execution` + `frontend/src/vendor/wms-task-execution/` | Zod/registry | **Dual copies** |

### Import graph (HEAD)

```
Admin  ──@ds──►  shared/design-system/ui/index.ts
Client ──@ds──►  shared/design-system/ui/index.ts
Client ──@wms/components──►  frontend/src/components/*
Client ──@wms/hooks────────►  frontend/src/hooks/*
Both   ──preset────────────►  shared/design-system/tailwind.preset.cjs
Both   ──@import───────────►  shared/design-system/globals.css (+ tokens.css)
```

**Problems**

| Sev | Issue |
|-----|--------|
| **P0** | React major mismatch + Client bundling Admin components (`@wms`) despite `dedupe` — fragile dual-React boundary |
| **P0** | Working tree deletes `@ds` `index.ts`, AppShell/Sidebar/Topbar/Button/Modal/Card, `Layout.tsx`, `PortalLayout.tsx`, core `design-v2` — architecture unrecoverable from disk alone |
| **P1** | `@ds` is an alias, not a versioned package — no semver, no isolated build, no consumer contract tests |
| **P1** | No monorepo workspace orchestration for UI (root package is QA/Playwright-oriented) |
| **P2** | Task-execution package vendored inside Admin **and** exists under `packages/` |

---

## 2. Duplicated components

### Critical triples / quads

| Concept | Implementations | Sev |
|---------|-----------------|-----|
| **App shell** | `@ds` AppShell/Sidebar/Topbar via Admin `Layout.tsx` · Client hand-rolled `PortalLayout.tsx` | **P0** |
| **Button** | `@ds` Button · Admin `components/Button.tsx` · Client raw emerald Tailwind CTAs · filter/modal class constants | **P0** |
| **Page header** | `@ds` `AppPageHeader` · Admin `PageHeader` · Client `design-v2/ListPageHeader` · `ClientPageIntro` · dead `ClientSectionHeader` | **P0** |
| **Status** | `@ds` Badge (unused) · Admin `StatusBadge` · Client `design-v2/Badge` · `globals.css` `.badge-*` | **P0** |
| **Table / pagination** | `@ds` DataTable + Pagination (unused) · Admin local `DataTable` (+ inline pager) · Client `TableFooterPagination` · `ServerPaginationBar` | **P0** |
| **Card / surface** | `@ds` Card (unused) · `design-v2/Card` · dead `ClientSurfaceCard` · Admin FilterPanel/DataTable soft shells | **P0** |

### Pairs / near-clones

| Concept | A | B | Sev |
|---------|---|---|-----|
| Icon button | `@ds` IconButton | `design-v2/IconButton` | **P1** |
| Filters | Admin `FilterPanel` + field suite | `@ds` FilterBar* (unused) · Client per-page filter Cards | **P1** |
| Text/Select | Admin `TextField` / `SelectField` | `@ds` Input / Select / Field (unused) · Client `input-premium` | **P1** |
| Modal | `@ds` Modal | Admin thin `Modal.tsx` re-export · `ConfirmModal` → local Button | **P1** |
| Sub-nav | Admin `SectionSubNavCard` + `PillSubNav` | Client `SectionSubNavCard` + `PillTabs` / `StorePillTabs` | **P1** |
| Class merge | `@ds` `cn` | `design-v2/cx` | **P2** |
| statusMeta | `shared/.../statusMeta` | `design-v2/statusMeta` re-export | **P2** |
| AnchoredDropdown | Admin (richer) | Client (thinner clone) | **P1** |
| loginError | `frontend/src/lib/loginError.ts` | `client-frontend/src/utils/loginError.ts` | **P2** |
| section-sub-nav / rbac | Admin `lib/*` | Client parallel `lib/*` | **P1** |

### Explicit dual-stack smell

- `InboundDetailPage` imports local Button as **`LegacyButton`** alongside `@ds` Button — documents two button systems in one page (**P0**).

### Cross-app leakage (`@wms`) — Client → Admin

Client imports Admin:

- `TextField`, `SelectField`, `Combobox`
- `StatusBadge`
- `FILTER_PRIMARY_BUTTON_CLASS` / `filter-panel-styles`
- `useChunkedServerPagination`

So Client “shared UI” is **Admin’s private folder**, not `@ds`.

---

## 3. Design system

### What `@ds` claims

Barrel (`shared/design-system/ui/index.ts`) exports a full product kit: form controls, Badge, Card, Skeleton, EmptyState, overlays, AppShell family, DataTable, Pagination, FilterBar, SearchInput, LoginScreen, Alert, WorkflowStatus, etc.

### What apps actually use

| Used meaningfully | Shelfware (exported, essentially unused by apps) |
|-------------------|--------------------------------------------------|
| AppShell stack (Admin only), Alert, Modal (+ Admin wrapper), LanguageSwitchOverlay, PageLoadFallback, FILTER_* classes, statusMeta (via StatusBadge), LoginScreen (Admin), Textarea (sparse), Skeleton/EmptyState (sparse), AppPageHeader (few Admin pages), TableCardHeader (via local DataTable) | **DataTable, Pagination, FilterBar\*, SearchInput, TableToolbar, Input, Field, Select, IconButton, Card, Badge (semantic), Drawer, Tooltip, Portal, Breadcrumb, PageContainer, SectionContainer** |

### Token / CSS health

| Issue | Sev |
|-------|-----|
| Intended SoT: `tokens.css` → `globals.css` → apps | — |
| Parallel utilities (`.glass`, `.hover-lift`, `.input-premium`) duplicated in Admin `styles.css` and Client `index.css` | **P1** |
| Legacy forest greens in `globals.css` (`.sidebar__link--active`, `.btn--primary` `#1a7a44`) coexist with emerald tokens | **P1** |
| Legacy `.badge-*` CSS coexists with React badge components | **P1** |
| Client scaffold `style.css` (Vite purple defaults) orphaned relative to portal | **P2** |
| Comment “do not inline hex” while apps and legacy CSS still ship raw hex | **P1** |

### Adoption gap

`@ds` is a **partial chrome + Modal/Alert foundation**, not the product UI layer. Visual SoT for Client lists is **`design-v2`**; operational SoT for Admin lists is **local components**. The design system is **aspirational inventory**, not enforced architecture.

---

## 4. Shared components vs app-local

### Should be shared (currently fragmented)

Soft Card · Status pill · List page header · Table + pagination · Filter recipe · Form fields · IconButton · Section sub-nav · AnchoredDropdown · Empty/loading primitives · Login chrome

### Wrongly located

| Location | Problem | Sev |
|----------|---------|-----|
| Admin `components/*` used as Client library via `@wms` | Inverts dependency (portal depends on internal app) | **P0** |
| `design-v2` stays Client-only | Blocks Admin alignment; forks SoT | **P0** |
| Admin keeps full clones while `@ds` already has DataTable/Button/Card | Parallel libraries | **P0** |

### Appropriately app-local

Task execution panels, billing/OMS domain modals, reports workspace, backup admin, barcode scanners, Client billing restriction banners, workflow timeline cards.

---

## 5. Reusable UI gaps

| Pattern | How it’s reinvented | Sev |
|---------|---------------------|-----|
| **List page recipe** | Admin: FilterPanel → DataTable (± PageHeader). Client: ListPageHeader → filter Card → table Card → TableFooterPagination | **P0** |
| **Empty / loading** | `@ds` EmptyState/Skeleton underused; “Loading…” text cells; ellipsis empties; ad-hoc pulse | **P1** |
| **Filters** | Enterprise Apply/Reset panel vs one-off `input-premium` rows | **P1** |
| **Status** | Four systems (see duplicates) | **P0** |
| **i18n** | Per-page EN/AR dictionaries; `wms-ui-language` vs `client-ui-language`; shells use `useUiLanguage`, pages often don’t | **P1** |
| **Primary / confirm actions** | DS Button vs local Button vs class-string CTAs vs LegacyButton | **P1** |

---

## 6. Technical debt

| Item | Detail | Sev |
|------|--------|-----|
| **Mass working-tree deletion** | Core `@ds` barrel, tokens/globals/preset, Layout, PortalLayout, design-v2 primitives deleted on disk | **P0** |
| **Stack skew** | React 18/19, Vite 6/8, Router 6/7 | **P0** |
| **`@wms` coupling** | Client build content globs / aliases into Admin source | **P0** |
| **Forest hex leftovers** | `ServerPaginationBar`, `LoginScreen`, globals btn/sidebar, some detail pages | **P1** |
| **CSS triplication** | globals + Admin styles + Client index (+ dead style.css) | **P1** |
| **Feature/build flags** | `VITE_TASK_ONLY_FLOWS`, mocks, `__BACKUP_GDRIVE_UI_ENABLED__`, `__OMS_COD_RETURNS_UI_ENABLED__` — compile-time UI forks | **P2** |
| **Re-export spaghetti** | Modal→DS; FILTER_PRIMARY_* deprecated aliases; design-v2 statusMeta re-export; adjustment → modal button styles | **P2** |
| **Dead components** | `ClientSurfaceCard`, `ClientSectionHeader`, `ClientMetricCard` (no/low importers) | **P2** |
| **Vendor duplication** | `packages/wms-task-execution` vs `frontend/src/vendor/...` | **P2** |

---

## 7. Inconsistent patterns

| Area | Split | Sev |
|------|-------|-----|
| Routing shells | Admin `Layout` + `@ds` AppShell vs Client custom `PortalLayout` | **P0** |
| List/data UX | FilterPanel+DataTable vs design-v2 cards+hand tables | **P0** |
| Status rendering | StatusBadge / design-v2 Badge / unused DS Badge / CSS badges; Client details import Admin StatusBadge | **P0** |
| Forms | Local TextField/SelectField vs DS Input/Select vs raw inputs | **P1** |
| Login | DS `LoginScreen` (Admin) vs bespoke Client login | **P1** |
| Language storage keys | `wms-ui-language` vs `client-ui-language` | **P1** |
| Sub-nav language | Emerald solid pills vs gray PillTabs vs SectionSubNavCard | **P1** |
| Pagination | Four UIs (DS unused, Admin table footer, Client footer, ServerPaginationBar) | **P0** |

---

## 8. Legacy components

| Artifact | Path / usage | Sev |
|----------|--------------|-----|
| Admin local `Button` | Dominant Admin CTA system; aliased `LegacyButton` on inbound detail | **P0** |
| Admin local `DataTable` | Blocks `@ds` DataTable adoption | **P0** |
| `ServerPaginationBar` | Forest-green pager still on Returns | **P1** |
| `LoginScreen` forest hero/CTA | `@ds` LoginScreen still ships `#1a7a44` era visuals | **P1** |
| `.badge-*` / `.btn--primary` CSS | `globals.css`; still referenced in places (e.g. Client detail shell patterns) | **P1** |
| `ClientSurfaceCard` | Dead alternate soft card | **P2** |
| Flag-gated OMS COD/Returns UI | Pages remain behind build flags | **P2** |
| Vite scaffold `client-frontend/src/style.css` | Orphan purple theme leftovers | **P2** |

---

## Architecture diagram (as-is)

```mermaid
flowchart TB
  subgraph apps [Applications]
    Admin[Admin frontend<br/>React 18]
    Client[Client frontend<br/>React 19]
  end

  subgraph claimed [Claimed shared]
    DS["@ds path alias<br/>shared/design-system"]
  end

  subgraph actual [Actual UI SoTs]
    AdminLib[Admin local components<br/>Button DataTable FilterPanel PageHeader]
    DV2[Client design-v2<br/>Card Badge ListPageHeader]
  end

  Admin -->|partial chrome Alert Modal| DS
  Client -->|partial Modal Alert| DS
  Admin --> AdminLib
  Client --> DV2
  Client -->|@wms TextField StatusBadge hooks| AdminLib
  DS -.->|unused DataTable Card Badge Input FilterBar| shelf[Shelfware primitives]
```

---

## Severity roll-up

### P0
1. Working-tree destruction of `@ds` + layouts + design-v2  
2. Three UI stacks (`@ds` / Admin local / design-v2)  
3. Client `@wms` → Admin + React major skew  
4. Triple/quad Button, header, status, table/pagination  
5. Parallel shells (AppShell vs PortalLayout)  
6. `@ds` DataTable/Card/Badge/Input/FilterBar unused while clones dominate  

### P1
Forest/legacy CSS · CSS utility duplication · form/filter dual systems · i18n key fragmentation · SectionSubNav/AnchoredDropdown clones · LoginScreen forest · incomplete EmptyState/Skeleton adoption  

### P2  
Dead Client surface/header/metric components · re-export aliases · VITE/feature flags · vendor package dual copy · scaffold CSS  

---

## Bottom line

The frontend is a **migration trapped mid-flight**: `@ds` was introduced as the shared layer, Client evolved **`design-v2`** as the visual SoT, Admin never retired its **local library**, and Client bridged gaps by **reaching into Admin**. Until one ownership model wins (and the working tree is restored to a buildable `@ds` + shell baseline), every new page will keep choosing among three incompatible recipes.

---

*End of frontend architecture audit. Problem inventory only — no remediation plan.*
