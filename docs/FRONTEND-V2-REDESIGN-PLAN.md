# Emdad WMS — Frontend V2 Redesign Plan

**Status:** PLAN ONLY — nothing in this document has been executed.
**Scope:** Staging only (`/var/www/emdad-sy-3pl-wms-staging`, backend `emdad-wms-backend-staging` on port `3001`, domains `staging-admin.emdadsy.com` / `staging-client.emdadsy.com`).
**Written:** 2026-10-06
**Inputs analysed:** `ui-audit/` (reports + 152 screenshots + observation JSON), legacy `frontend/` (admin) and `client-frontend/` (client), `shared/design-system*`, nginx staging vhosts, PM2 staging config, `zerostaticthemes/square-ui` (full clone, `templates/` + `templates-baseui/`), installed skills / rules / MCP config, the Emdad reference mock-up image supplied in the request.

> Naming note: in the request the component source is written "ChatGPTN". This plan reads that as **shadcn/ui** (Radix flavour), which is what Square UI is built on. If something else was meant, correct it before Phase 0.

---

## 0. الملخص التنفيذي (Arabic summary)

**اللي هنعمله:** نبني فرونت إند جديد بالكامل (UI فقط) لبوابتين منفصلتين — Admin و Client — جنب القديم، من غير ما نلمس القديم. الجديد مبني على **shadcn/ui + قوالب Square UI (dashboard-2 كمرجع أساسي)** + **TanStack Table** + **Recharts** + **lucide-react**، بهوية إمداد (الأخضر الغامق + لوجو إمداد + خلفية اللوجستيات) زي الصورة اللي بعتها.

**اللي مش هيتغير:** المسارات (routes)، وظيفة كل صفحة، نوع الداتا اللي بتظهر، الصلاحيات (RBAC)، العربي/الإنجليزي + RTL، الـ dark mode، الـ realtime، والـ API/backend.

**اللي هيتشال:** كل component قديم (sidebar, navbar, tables, cards, filters, buttons, modals, forms, icons) — مفيش import واحد من `@ds` أو من `frontend/src/components` أو `client-frontend/src/components` في الكود الجديد، وده هيتفرض بـ lint مش بالنية.

**المخرجات الأساسية للخطة:**
1. فحص جاهزية الأدوات/الـ skills/الـ rules (§2) — معظمها متسطّب، فيه 6 ثغرات لازم تتقفل في Phase 0.
2. تحليل كامل للفرونت القديم (§3) ولريبو Square UI (§4) مع المخاطر الحقيقية (Next.js مش Vite، Tailwind v4، مفيش RTL، خطوط 10px).
3. معمارية الفرونت الجديد (§5): مجلد واحد `web-v2/` فيه تطبيقين React منفصلين + حزمة UI مشتركة.
4. Design System كامل (§6) + جدول mapping لكل component قديم → مصدره الجديد (§7) + قواعد ألوان الـ status/الـ danger/الـ spacing/الـ responsive اللي بتمنع مشاكل الـ audit.
5. عقد "نفس الداتا ونفس الوظيفة" لكل صفحة (§9) — بنحافظ على الـ status cards كفلاتر، وعلى زراير المرحلة التشغيلية، إلخ.
6. خطة مراحل (§10): **Phase 0** تجهيز بدون UI، **Phase 1** = Login + Dashboard للبوابتين (كاملة وشغالة) وبعدها **نقف ونراجع** قبل أي حاجة تانية.
7. ربط الـ staging بالفرونت الجديد مع رجوع فوري للقديم (§11) عن طريق cookie في nginx — القديم يفضل شغال زي ما هو.

**قرارات محتاجة منك قبل البدء:** §14 (أهمها: ملف اللوجو vector، صورة الـ banner، قبول إن الـ API/logic layer بيتنقل ومش بيتعاد كتابته، وموافقة على nginx reload).

---

## 1. Goals and non-negotiables

### 1.1 Goals
1. Replace the visual layer of both portals with a coherent, professional, accessible design built from **ready-made components** (shadcn/ui, Square UI blocks), re-skinned with Emdad brand identity.
2. Eliminate the defect classes found in the UI audit (colour semantics, contrast, spacing/column sizing, responsiveness, tap targets, hierarchy, icon consistency) **by construction**, not page-by-page patching.
3. Build the new frontend **side by side** with the old one; switch via infrastructure, never by deleting.

### 1.2 Non-negotiables (from the request)
| # | Rule | How it is enforced |
|---|------|--------------------|
| N1 | Same routes, same page function, same data on every page | Per-page **Parity Sheet** (§9) reviewed before a page is called done; route-diff script |
| N2 | No old component survives (sidebar, navbar, tables, cards, KPI, filters, buttons, modals, forms, icons, charts) | ESLint `no-restricted-imports` + boundary script (§5.6) + provenance manifest (§7.3) |
| N3 | Components come from shadcn/ui or Square UI; custom only with written justification; edits to fit our data are allowed | `COMPONENT-MANIFEST.json` (§7.3) |
| N4 | Emdad identity visible (green, logo, logistics artwork) — adapted, not copied raw | Brand tokens (§6.2), shell spec (§6.9), brand review at Gate G1 |
| N5 | Admin and Client are **two separate React applications** | `web-v2/apps/admin`, `web-v2/apps/client`, separate builds/outputs |
| N6 | Old frontends stay untouched and deployable; instant rollback | New directories only; nginx switch (§11) |
| N7 | Build in phases; **first = Login + Dashboard for both**, then stop and review | §10 gates |
| N8 | Colour must match meaning (danger=red, success=green); no text-on-same-colour; spacing/columns/responsive handled by the system | §6.3–6.7 + automated contrast/lint checks (§12) |
| N9 | Staging only; production never touched | `.cursor/rules/staging-only-changes.mdc` + §11 guard-rails |

### 1.3 Preserved platform behaviours (discovered in code — must not regress)
- Bilingual **EN/AR with RTL** (`wms-ui-language`, `LocalizedMessage` tuples, `document.dir`), language-switch overlay.
- **Dark mode** (`admin-ui-theme`) with switch overlay.
- RBAC: admin roles `super_admin | wh_manager | wh_operator | finance`; client roles `client_admin | client_staff`; per-route access guards and role-based home redirects.
- Auth storage: access token in `sessionStorage` or `localStorage` when "Remember for 30 days"; remembered-account chooser; Google sign-in (admin) incl. `google_error` / `google_auth=success` handling.
- Realtime (Socket.IO providers, cache invalidation maps), notifications (topbar dropdown + page), **update detector** (`/version.json` + chunk-load-failure → update modal).
- Billing restriction banner / account-inactive flow (client).
- Server-side pagination (`useChunkedServerPagination`), URL/query-state filters, CSV/Excel import/export, barcode/QR scan modals, printing (waybill, GRN/DN, labels, invoices), Leaflet delivery map, address cascade, phone input.
- Worker execution flows (task execute, cycle-count execute, returns process, internal transfer) incl. scan-wedge input and the vendored `@emdad/wms-task-execution` package.
- Feature flags baked at build time: `__BACKUP_GDRIVE_UI_ENABLED__`, `__OMS_COD_RETURNS_UI_ENABLED__`, `__APP_BUILD_ID__`, `__APP_VERSION__`.

---

## 2. Readiness check — tools, skills, rules, libraries

Verified by inspecting the workspace on 2026-10-06. "Installed" = files present on disk.

### 2.1 Skills (from the request's list)

| Requested | Status | Where | Notes / gap |
|-----------|--------|-------|-------------|
| Anthropic `frontend-design` | **Installed** | `.agents/skills/`, `.claude/skills/`, `.cursor/skills/` | **Not in `skills-lock.json`** (copied manually) |
| `Pythoughts-labs/react-frontend-skills` | **Installed** (19 skills) | `.agents/skills/`, `.cursor/skills/` | In lock. Includes `react`, `tailwind`, `shadcn`, `tanstack-query`, `react-hook-form`, `zod`, `nuqs`, `playwright`, `vitest`, `msw`, `tdd`, `typescript`, `ui-design`, `feature-arch`, `web-design-guidelines`, `vercel-*`. `nextjs` skill is irrelevant (we are Vite) — keep but never apply |
| `marvkr/better-design` | **Installed + MCP connected** | skill in 3 places; MCP `user-better-design` reachable in this session | Bearer key lives in `~/.cursor/mcp.json` **and** `.cursor/mcp.json` (see §2.5 security item) |
| `lcanady/ui-skill` | **Installed** (`ui`) | `.agents/`, `.cursor/`, `.claude/`, `~/.cursor/skills/ui` | Not in lock; `/ui audit` mode available |
| `google-labs-code/stitch-skills` | **Installed** (`design-md`, `extract-design-md`, `shadcn-ui`, `react-vite-dashboard`) | `.claude/skills`, `.agents/skills` | Not in lock |
| `creativetimofficial/ui` | **Installed** (`creative-tim-ui`) | `.agents/`, `.cursor/` | In lock. **Conflict:** its `AGENTS.md` mandates *orange* brand and forbids arbitrary values — we must override brand (green) while keeping its Tailwind-v4 and block-authoring rules (§2.4) |
| `aidesigner-frontend` | Installed | project + `~/.cursor/skills` | MCP `aidesigner` is configured but **not exposed in this session** (needs auth) — optional |

### 2.2 MCP / tooling

| Tool | Status | Action |
|------|--------|--------|
| Better Design MCP | Connected (tool schemas load) | Use in every phase: `get-ui-principle`, `get-ux-principle`, `get-review-rules`, `check-comprehension`, `inspect-spacing`; `find-design-system` is **not** used to swap brand |
| Playwright MCP | Configured in `~/.cursor/mcp.json` (Chromium, vision cap, origins restricted to the two staging domains) but **not listed as a namespace in this session** | Phase 0: verify it loads; fallback = local Playwright (`@playwright/test` already in repo) |
| AIDesigner MCP | Configured, unauthenticated | Optional; skip unless asked |
| `shadcn` CLI / registry | Not yet used | Phase 0 (`npx shadcn@latest`) |
| Node / npm | Node 22.22.2, npm 10.9.7, no pnpm | Use **npm workspaces** (no new package manager) |

### 2.3 Libraries (none installed yet — new project does not exist)
Installed at Phase 0 inside `web-v2/` (list in §5.2). Already present in legacy apps and **kept**: `@tanstack/react-query`, `recharts`, `lucide-react`, `socket.io-client`, `axios`, `libphonenumber-js`, `leaflet`/`react-leaflet`, `jsbarcode`, `qrcode`, `html5-qrcode`, `date-fns`, `zod`.

### 2.4 Rules — conflicts that must be resolved in Phase 0
Existing rules were written for "keep `@ds`, stay on Tailwind v3". They **contradict** this project:

| File | Conflicting statement | Resolution |
|------|----------------------|------------|
| `.cursor/rules/frontend-ui-stack.mdc` | "Tailwind v3 — do not jump to v4"; "do not rip out `@ds`"; "Vite + React 18" | Scope the rule to legacy globs only (`frontend/**`, `client-frontend/**`, `shared/design-system*/**`) |
| `.cursor/rules/react-typescript-ui.mdc` | "Reuse `@ds` primitives" | Same scoping |
| `AGENTS.md` ("Preserve `@ds`") | Preserve `@ds` | Amend: legacy only; add V2 section |
| `creative-tim-ui/AGENTS.md` | Orange brand, no violet | Add a V2 rule: **brand = Emdad green**; keep its "no arbitrary values / text-sm minimum / no inline styles / hydration" rules |
| `frontend-design-skills.mdc` ("Do **not** replace Emdad brand/tokens with a catalog system") | Compatible, but says "inspect existing `@ds` tokens" | Replace with "inspect `web-v2/packages/ui/src/styles/tokens.css`" |

New rule to add: `.cursor/rules/frontend-v2.mdc` (globs `web-v2/**`) containing: stack (Vite 7 + React 19 + TS + Tailwind v4 + shadcn Radix + TanStack Table/Query + Recharts + lucide), the N1–N9 list, logical-property (RTL) rule, semantic-colour rule, min font sizes, "component must exist in manifest", staging-only reminder.

### 2.5 Hygiene items found (not part of redesign, but should be fixed)
1. `.cursor/mcp.json` is **tracked by git** (despite being in `.gitignore`) and contains a live Better Design bearer key. Untrack it (`git rm --cached`) and rotate the key before the repo is shared. *Do not do this silently; confirm with owner.*
2. Working tree has many uncommitted changes (backend `dist/`, `.env`, etc.). Before Phase 0, create a safety tag/branch (`pre-frontend-v2`) so the legacy state is recoverable.
3. `skills-lock.json` omits manually copied skills (`frontend-design`, `ui`, Stitch skills). Re-run installs through the CLI or hand-edit the lock so a fresh checkout reproduces the environment.
4. Machine is small: **2 vCPU, 7.8 GB RAM with ~5.3 GB already used** (PM2 backend, Chrome for PDFs, etc.). Builds must run one app at a time with `NODE_OPTIONS=--max-old-space-size=2048`; never run both Vite builds + Playwright concurrently.

---

## 3. Analysis of the current frontend

### 3.1 Architecture snapshot

| | Admin (`frontend/`) | Client (`client-frontend/`) |
|---|---|---|
| Size | 444 TS/TSX files, ~89k lines (pages ≈ 32k) | 124 files, ~18.7k lines (pages ≈ 10.3k) |
| React / Router | 18.3 / react-router-dom 6 (`createBrowserRouter`, `router.tsx`) | 19.2 / react-router-dom 7 (`<Routes>` in `App.tsx`) |
| Vite | 6 | 8 (rolldown) |
| TS | 5.7 | 6.0 |
| Tailwind | 3.4 + `@ds` preset | 3.4 + `@ds` preset |
| Design layer | `shared/design-system-next` via `@ds` + ~45 local wrapper components | same `@ds` + `design-v2/*` re-exports + ~25 local components |
| Served from | `frontend/dist` → `staging-admin.emdadsy.com` | `client-frontend/dist` → `staging-client.emdadsy.com` |
| Tests | Vitest unit (`*.unit.spec.ts`), Playwright e2e in `frontend/e2e` | none in-app; root `tests/e2e/client` |

Observations that drive the plan:
- Two **different** React/Router/Vite/TS majors → the new apps will be **aligned** (React 19, `react-router` 7, Vite 7, TS 5.9) in one workspace.
- Both already alias `@ds` to `shared/design-system-next` (Tailwind-v3 preset). Adopting Tailwind v4 means **nothing from `@ds` can be reused** — consistent with N2.
- Heavy duplication between portals (billing display, status maps, address selector, barcode modal, import modals, notifications, update detector, i18n) → move shared **non-visual** code into `packages/core` and shared **visual** code into `packages/ui`.

### 3.2 Admin route inventory (must all exist in V2)

Source: `frontend/src/router.tsx` (+ `lib/rbac.ts` NAV catalogue). Redirect-only routes are listed so they are preserved.

| Group | Routes (page component) |
|-------|-------------------------|
| Auth | `/login` (`LoginPage`) |
| Dashboard | `/` (role redirect), `/dashboard`→`/dashboard/overview`, `/dashboard/overview` (`DashboardOverviewPage`) |
| Inbound (WMS) | `/orders/inbound`, `/orders/inbound/new`, `/orders/inbound/:id/edit`, `/orders/inbound/:id`; redirects `/inbound`, `/inbound/create`, `/orders` |
| Outbound (WMS) | `/orders/outbound`, `/orders/outbound/new`, `/orders/outbound/:id/edit`, `/orders/outbound/:id`; redirects `/outbound`, `/outbound/create`, `/orders/directed-outbound`, `/directed-outbound` |
| Inventory | `/inventory`→`/inventory/stock`, `/inventory/stock`, `/inventory/product/:productId`, `/inventory/ledger/line/:ledgerId/:createdAt`, `/inventory/ledger/:referenceType/:referenceId`, `/inventory/adjustments`, `/inventory/adjustments/:id`; redirects `/adjustments`, `/inventory/ledger` |
| Tasks | `/tasks`, `/tasks/:id`, `/tasks/:id/execute`, `/internal` (internal transfer) |
| Cycle count | `/cycle-count`, `/cycle-count/my-tasks`, `/cycle-count/:id`, `/cycle-count/:id/execute` |
| Returns (WMS) | `/returns`, `/returns/:id`, `/returns/:id/process` |
| Master data | `/products`, `/products/:sku`, `/locations`, `/warehouses` |
| OMS | `/oms`→`/oms/dashboard`, `/oms/dashboard`, `/orders/oms`, `/orders/oms/new`, `/orders/oms/:id`, `/orders/oms/:id/waybill`, `/oms/orders/:id`, `/oms/orders/:id/waybill`, `/oms/batches`, `/oms/batches/:id`, `/oms/cod`, `/oms/cod/:id`, `/oms/returns`, `/oms/returns/:id`, `/oms/returns/:id/edit` (COD/Returns gated by `isOmsCodReturnsUiEnabled()`); redirects `/reports/oms/cod`, `/reports/oms/returns` |
| Contracts | `/contracts`→`/contracts/grn`, `/contracts/grn`, `/contracts/dn`, `/contracts/final-contract` |
| Reports (22, nested under `ReportsLayout`) | `warehouse-analysis`, `inventory`, `product-moves`, `stock-aging`, `lot-expiry`, `capacity-utilization`, `return-rate`, `revenue-by-client`, `receivables-aging`, `worker-productivity`, `order-cycle-time`, `inbound-accuracy`, `outbound-fill-rate`, `sla-compliance`, `merchant-orders`, `sales-report`, `delivery-report`, `allocation-report`, `inventory-reserved`, and flag-gated redirects `cod-report`, `returns-report` |
| Clients / Users | `/clients`, `/clients/:id`, `/users`→`/users/warehouse_users`, `/users/warehouse_users[/:id]`, `/users/client_users[/:id]` |
| Billing | `/billing`→`/billing/dashboard`, `/billing/dashboard`, `/billing/plans`, `/billing/plans/new`, `/billing/plans/:clientId`, `/billing/plans/:clientId/edit`, `/billing/templates`, `/billing/invoices`, `/billing/invoices/:id` |
| Platform | `/forms`, `/audit-logs`, `/notifications`, `/profile`, `/shipping`→`/shipping/companies`, `/shipping/companies` |
| Backups / Settings | `/backups` (+ children `schedules`, `retention`, `health`, `google-drive`; `upload`/`restore`/`factory-reset`/`storage-policy` redirect to `/backups`), `/settings/**` redirects to `/backups/**`, `*` → role home |

Largest / riskiest pages (lines): `OmsOrdersListPage` 2 324, `TaskExecutionView` 1 338, `OmsDashboardPage` 1 007, `BackupHistoryPage` 979, `ProductsPage` 948, `OmsBatchDetailPage` 918, `InventoryProductDetailPage` 916, `UsersPage` 889, `InboundCreatePage` 861, `OmsCodReturnsPages` 811.

### 3.3 Client route inventory

Source: `client-frontend/src/App.tsx`, `lib/rbac.ts` (`client_admin`, `client_staff`; some routes admin-only).

| Group | Routes |
|-------|--------|
| Auth/status | `/login`, `/account-inactive`, `*` (NotFound inside layout; outside → `/login`) |
| Dashboard | `/` → `/dashboard`, `/dashboard` |
| Store (OMS) | `/ecommerce-orders`, `/ecommerce-orders/new`, `/ecommerce-orders/:id`, `/ecommerce-orders/returns`, `/ecommerce-orders/returns/new`, `/ecommerce-orders/returns/:id`, `/my-profits` (COD), redirects `/cod-reports`, `/returns`, `/returns/new`, `/returns/:id` |
| Warehouse | `/inbound-orders`, `/inbound-orders/new`, `/inbound-orders/:id`, `/outbound-orders`, `/outbound-orders/new`, `/outbound-orders/:id`, `/outbound-orders/returns`, `/outbound-orders/returns/new`, `/outbound-orders/returns/:id`, `/products`, `/products/new`, `/products/:id`, `/products/:id/edit` |
| Account | `/billing`, `/invoices`, `/invoices/:id`, redirect `/billing/invoices/:id`, `/apis`, `/notifications`, `/profile` |

### 3.4 UI-audit findings → root cause → rule in the new design system

(Source: `ui-audit/admin-report.md`, `client-report.md`; contrast numbers measured by the audit's Playwright sampling.)

| # | Finding (evidence) | Root cause | V2 system rule that removes it |
|---|--------------------|-----------|-------------------------------|
| F1 | Red **Reset** next to green **Apply** on every list; red collides with *Cancelled* / *Revoke* | Filter buttons coloured by habit, not meaning | `Button` variants are semantic: **primary** (brand green), **outline/secondary** (neutral), **ghost**, **destructive** (red, only for irreversible actions). *Clear filters* = ghost. Lint: `variant="destructive"` allowed only inside `DestructiveAction` / confirm flows |
| F2 | Status cards vs table pills disagree (Processing blue vs yellow); rainbow cards outweigh the table | Two parallel colour maps | **One** `statusTone` map (§6.4) consumed by badge, card, chart legend, row highlight |
| F3 | Text ~2.0–2.9:1 on status-card fills ("Waiting for admin", "Out for delivery", "Delivered", "Cancelled"); muted greys ~2.45:1 | Saturated fills + white text; `slate-400` for meta text | Cards use *soft tone background + dark tone text* (≥4.5:1); `muted-foreground` token tuned to ≥4.5:1 on all surfaces; automated contrast gate (§12.3) |
| F4 | Negative delta (↓100%) shown green | Delta colour hard-coded | `<Delta value goodWhen="up|down">` computes tone from direction × polarity |
| F5 | Tap targets <36 px (hamburger, theme toggle, badge, Refresh/Export, Reset/Apply, row actions) | Ad-hoc icon buttons | `Button`/`IconButton` minimum **40 px** hit area (44 px on touch via `pointer-coarse:`); row actions in `DropdownMenu` trigger sized 40 px |
| F6 | Table headers light grey; secondary IDs/timestamps low contrast; inconsistent column widths (wide text columns starve narrow ones; truncated pills "Pending A") | Hand-rolled tables; no column contract | **`DataTable` + column presets** (id, status, date, money, text, actions) with fixed min/max widths, `tabular-nums`, truncation + tooltip, pills never truncate (`whitespace-nowrap`, min-width) (§6.6) |
| F7 | Mobile tables overflow; filters stack and push KPIs below fold | No responsive strategy for tables | Column `priority` meta → hide low-priority columns by breakpoint; below `md` render **row-cards** with the same data; filters collapse into a `Sheet` with an "active filters" chip row (§6.7) |
| F8 | Tab strips overcrowded (Tasks); sub-nav duplicated (OMS tabs + sidebar); OMS Returns missing in sidebar | Navigation defined twice | Single `nav.config.ts` per portal drives sidebar, command palette, breadcrumbs, and section tabs; long tab lists become horizontally scrollable `Tabs` + "More" overflow menu |
| F9 | Sidebar very long (flat + WMS + OMS) | No grouping/collapse model | shadcn `Sidebar` with collapsible groups (WMS / OMS / Admin), persisted open state, icon-rail collapse mode |
| F10 | Duplicate bell (topbar + page), duplicate storage widgets, duplicate H1, no H1, duplicate profile (client) | Per-page ad-hoc chrome | `PageHeader` is the only H1; notifications only in topbar; shell owns profile menu; lint/test: exactly one `h1` per route |
| F11 | Backups: four equal CTAs; **Factory Reset** beside Restore/Create | Flat toolbar | `PageHeader` accepts **one** primary action + overflow menu; destructive actions live in a "Danger zone" `Card` with typed-confirmation `AlertDialog` |
| F12 | Client APIs: four text links per row incl. Revoke | Text-link actions | Row actions → single `DropdownMenu` (view/regenerate/disable) + destructive item separated by `DropdownMenuSeparator` and confirm dialog |
| F13 | Returns page: blocking "select a tenant" alert while rows render | State logic conflict | `EmptyState` / `Alert` variants driven by one `pageState` (loading / needs-scope / empty / error / data); no alert + data simultaneously |
| F14 | Mixed AR/EN text with no direction cues; bilingual product names | No bidi handling | `<Bidi>` wrapper (`dir="auto"`, `unicode-bidi: plaintext`) for user-generated strings; columns align via logical `text-start` |
| F15 | Admin and client login nearly identical | Same layout | Distinct portal chrome: admin = "Operations console" accent; client = "Client portal" copy + illustration, same brand (§6.9) |
| F16 | Notification badge green in sidebar vs red in topbar; 47-badge overlaps bell | Per-place styling | Single `<CountBadge tone>`; unread = brand-accent in topbar, capped "99+", positioned by logical offsets |
| F17 | Sparse pages feel empty (cycle count 1 row, warehouses 1 row) with heavy filter chrome | Filters always expanded | Filter bar collapses to search + "Filters (n)" popover/sheet; `EmptyState` with next action |

---

## 4. Analysis of the reference repo (Square UI)

Cloned for analysis to `/tmp/square-ui-probe` (outside the project; will be vendored read-only in Phase 0).

### 4.1 What it is
- Monorepo of **20 independent Next.js 16 templates** (`templates/` = Radix, `templates-baseui/` = Base UI), each: React 19, **Tailwind v4** (`@tailwindcss/postcss`, `@theme inline`, oklch tokens), shadcn "new-york" style, `lucide-react`, `recharts` 2.15, `@tanstack/react-table` 8.21 (some), `zustand`, `next-themes`.
- `dashboard-2` (the mock-up in the request): `components/dashboard/{sidebar, header, welcome-section, stats-cards, lead-sources-chart, revenue-flow-chart, deals-table, content}.tsx` + 16 shadcn `ui/*` + `store/dashboard-store.ts` + `mock-data/*`.
- UI primitive union across templates: tooltip, sheet, separator, dropdown-menu, button, input, skeleton, **sidebar (726 lines)**, avatar, collapsible, badge, table, checkbox, **chart (357 lines)**, card, select, kbd, progress, popover, dialog, calendar, label, textarea, tabs, switch, slider, scroll-area, drawer, carousel.
- **License** (`LICENSE.md`): free for personal/commercial products, modification allowed; **not** allowed to redistribute or publish the templates/derivatives as a standalone kit/library/repository. ⇒ We use them inside a private product only; `reference/` must never be published; our `packages/ui` is internal.

### 4.2 Decision: Radix flavour, not Base UI
`templates/` (Radix) matches the shadcn skills we installed, shadcn CLI defaults, and `lucide-react` (our current icon set). `templates-baseui/` uses `@base-ui/react` + HugeIcons; adopting it would add a second icon library and diverge from the skills. **Use `templates/`; keep `templates-baseui/` only as a visual cross-check.**

### 4.3 Gaps between Square UI and Emdad's needs (real risks)

| # | Gap | Impact | Mitigation |
|---|-----|--------|-----------|
| G1 | **Next.js**, not Vite (`"use client"`, `next/link`, `next-themes`, `next/font`) | Cannot copy files verbatim | Port: strip directives; `Link`→`react-router` `Link`/`NavLink`; `next-themes`→small `ThemeProvider` (class strategy, key `admin-ui-theme` / client equivalent); fonts via `@fontsource` |
| G2 | **Tailwind v4** vs legacy v3 | Entire styling pipeline differs | New workspace uses v4 + `@tailwindcss/vite`; never mixes with legacy |
| G3 | **No RTL** (`left-3`, `pl-10`, `mr-2`, `-rotate`, sidebar `side="left"`) | Arabic UI broken | Convert to logical utilities (`start-/end-/ps-/pe-/ms-/me-/text-start`); sidebar `side` derived from `dir`; icons that indicate direction get `rtl:rotate-180`; Radix `DirectionProvider`; Recharts axis mirroring helper. Add CI grep for physical-direction classes |
| G4 | Typography as small as `text-[10px]`/`[8px]` in tables, badges, nav | Fails readability/WCAG; contradicts our quality bar | Type scale floor: body/table `text-sm` (14), meta `text-xs` (12) **only** with ≥4.5:1 contrast; ban arbitrary `text-[Npx]` |
| G5 | Tables are mock, **client-side** filter/pagination in a Zustand store (`deals-table.tsx`) | Our data is server-paginated, large | Build one generic `DataTable` on TanStack Table v8 with `manualPagination/Sorting/Filtering`, fed by existing query hooks. Keep the **look** of Square UI's table (toolbar, filter dropdown, chips, footer) |
| G6 | Charts use Recharts 2 + hard-coded palette | We use Recharts 3 | Use shadcn `chart` (current CLI output supports v3); palette from Emdad tokens; verify each chart type we need (area, bar, donut, sparkline, gauge, stacked) |
| G7 | Static dashboards, no loading/error/empty states | Production needs all states | Add `Skeleton` variants, `EmptyState`, `ErrorState`, retry; part of every recipe |
| G8 | Demo copy, github link, "square.lndevui.com" button, dicebear avatars, third-party logos in sidebar/header | Must not ship | Strip; replace with Emdad content |
| G9 | Palette is neutral/violet (`#6e3ff3` gradients) | Off-brand | Replace with Emdad tokens (§6.2); no purple gradients |
| G10 | Sidebar template has "Folders", "AI Assistant", "Synclead 16 members" | Not applicable | Replace by our nav groups, **warehouse/company switcher** card (admin: current warehouse; client: company name) |

### 4.4 Template → Emdad usage map (what we harvest from where)

| Emdad need | Primary template source | Secondary |
|------------|------------------------|-----------|
| App shell, sidebar, topbar, welcome banner, KPI strip | `dashboard-2` | `dashboard-1`, `dashboard-5` |
| Donut/lead-sources → status distribution, revenue/bar chart → orders/tasks trends | `dashboard-2` charts | `dashboard-3`, `dashboard-4`, `marketing-dashboard` |
| Primary list table + toolbar + filters + chips + pagination footer | `dashboard-2` `deals-table` | `leads`, `employees`, `payrolls`, `dashboard-1` `people-table` (TanStack) |
| Stat strip above lists | `leads`, `employees`, `payrolls` | |
| Kanban / task views (Tasks board, cycle-count sessions) | `tasks`, `task-management` | |
| Storage / file-like screens (Backups, documents) | `files` | |
| Timelines (audit logs, order timeline, activity) | `projects-timeline` patterns | `emails` list pattern for notifications |
| Calendar/date selection (planning dates, expected arrival) | `calendar` (`react-day-picker`) | |
| Map-panel layouts (locations, delivery map shell) | `maps` | |
| Login / auth | **not in Square UI** | shadcn **login-** blocks (shadcn Blocks) styled with brand art |
| Forms/wizards, dialogs, drawers | shadcn primitives (`form`, `dialog`, `sheet`, `drawer`) | Creative Tim blocks for reference only |

Anything not in either source → **shadcn registry first**, then shadcn Blocks / Creative Tim blocks (`npx @creative-tim/ui add …`), and only then a documented custom composition built from shadcn primitives.

---

## 5. Target architecture

### 5.1 Repository layout (new, additive)

```
/var/www/emdad-sy-3pl-wms-staging/
├─ frontend/                  # legacy admin (UNTOUCHED, keeps building to frontend/dist)
├─ client-frontend/           # legacy client (UNTOUCHED)
├─ shared/design-system*/     # legacy (UNTOUCHED)
└─ web-v2/                    # NEW — independent npm-workspaces monorepo
   ├─ package.json            # workspaces: ["apps/*","packages/*"]; its own lockfile
   ├─ tsconfig.base.json
   ├─ eslint.config.js        # restricted-imports, rtl, font-size, hex rules
   ├─ apps/
   │  ├─ admin/               # React app #1 → apps/admin/dist
   │  │   ├─ index.html, vite.config.ts, src/{main.tsx, app/, routes/, features/…}
   │  └─ client/              # React app #2 → apps/client/dist
   ├─ packages/
   │  ├─ ui/                  # shadcn primitives + Emdad theme + shell + composites (INTERNAL, never published)
   │  │   ├─ components.json  # shadcn config
   │  │   ├─ src/styles/{tokens.css,theme.css,fonts.css}
   │  │   ├─ src/components/ui/        # shadcn generated (button, table, …)
   │  │   ├─ src/components/shell/     # AppShell, SidebarNav, Topbar, WelcomeBanner, CommandPalette
   │  │   ├─ src/components/data/      # DataTable, columns presets, FilterBar, Pagination, StatusBadge, StatusCards, Delta, KPI
   │  │   ├─ src/components/charts/    # Donut, Bars, Area, Sparkline, Gauge (shadcn chart based)
   │  │   ├─ src/components/forms/     # Form fields (RHF+zod), PhoneInput, AddressSelect, ImageUpload, ScanField
   │  │   ├─ src/components/feedback/  # EmptyState, ErrorState, ConfirmDialog, Toaster
   │  │   └─ COMPONENT-MANIFEST.json
   │  ├─ core/                # NON-visual shared logic (api client, auth, rbac, i18n, realtime, query keys, hooks)
   │  └─ config/              # shared tsconfig/eslint/tailwind helpers
   ├─ reference/              # read-only vendored square-ui (gitignored, never built, never published)
   ├─ docs/
   │  ├─ DESIGN.md            # generated + curated design system doc (design-md / extract skills)
   │  ├─ COMPONENT-MAP.md     # old → new mapping (§7)
   │  ├─ parity/<portal>/<route>.md   # Parity Sheets (§9)
   │  └─ PHASE-REPORTS/
   └─ scripts/                # contrast check, route-diff, manifest check, rtl-grep, screenshot runner
```

Why a *separate* workspace (and not editing `frontend/`): (1) zero risk to legacy builds/lockfiles; (2) one React 19 / Tailwind 4 install shared by both apps; (3) the root `package.json` is the QA suite and must not become a workspace root.

### 5.2 Stack (pin exact versions at Phase 0 from `npm view`)

| Concern | Choice |
|---------|--------|
| Build | Latest stable Vite (client already runs 8; final pin decided in the Phase 0 spike) + `@vitejs/plugin-react`, TypeScript 5.9 strict |
| UI runtime | React 19 |
| Routing | `react-router` 7 (declarative `<Routes>` or data router; keep lazy-route + chunk-failure → update-modal behaviour) |
| Styling | Tailwind CSS **v4** (`@tailwindcss/vite`, `@theme`), `tw-animate-css`, `class-variance-authority`, `clsx`, `tailwind-merge` |
| Components | shadcn/ui (new-york, Radix) generated into `packages/ui`; `@radix-ui/react-direction` |
| Tables | `@tanstack/react-table` v8 (manual server mode) |
| Server state | `@tanstack/react-query` v5 (existing keys/patterns ported) |
| Forms | `react-hook-form` + `zod` (+ `@hookform/resolvers`) |
| URL state for filters | `nuqs` (adapter for react-router) **or** keep existing `useFilters` — decide in Phase 0 spike |
| Charts | `recharts` 3 via shadcn `chart` |
| Icons | `lucide-react` (single set; no emoji/ad-hoc SVG) |
| Command palette | shadcn `command` (cmdk) — replaces the old "Quick jump" |
| Toasts | `sonner` |
| Dates | `date-fns` + `react-day-picker` |
| Fonts | `@fontsource-variable/inter` + `@fontsource/ibm-plex-sans-arabic` (self-hosted), mono for IDs: `@fontsource-variable/geist-mono` (or JetBrains Mono) |
| Carried over | `socket.io-client`, `axios`, `libphonenumber-js`, `leaflet`, `react-leaflet`, `jsbarcode`, `qrcode`, `html5-qrcode` |
| Tests | Vitest + Testing Library (unit), Playwright (e2e + screenshots), `axe-core` (a11y), `msw` (mock API for isolated UI tests) |

### 5.3 What is **ported** vs **rebuilt**
Principle: **UI is rebuilt from zero; business/data logic is moved, not reinvented** (reinventing would risk the "same function" requirement).

| Layer | Treatment |
|-------|-----------|
| Components (`components/**`, `design-v2`, `@ds`), pages' JSX, CSS | **Rebuilt** (N2) |
| API modules (`frontend/src/api/*`, `client-frontend/src/services/*`) | **Ported** into `packages/core/api` (typed), logic unchanged; unify the two axios clients (token storage, 401 handling, base URL) |
| Auth (`AuthContext`, `RequireAuth`, `RequireRouteAccess`, storage, remembered account, Google callback) | **Ported** to `packages/core/auth`; behaviour-identical, unit-tested |
| RBAC (`lib/rbac.ts` both) | **Ported**, then nav *definitions* re-expressed in `nav.config.ts` (data only; icons are lucide keys) |
| i18n (`useWmsTranslation`, tuples, `client-ui-language`) | **Ported** + extracted to `packages/core/i18n`; message tuples stay at call sites to avoid a risky string migration |
| Realtime provider + cache maps | **Ported** |
| Hooks (filters, pagination, debounced, notifications, update detector…) | **Ported**; UI-coupled ones adapted |
| Pure domain helpers (`lib/*`: status maps, display, validators, print builders, address data, locations) | **Ported** with their existing unit specs; status maps feed the new `statusTone` |
| `vendor/wms-task-execution` | **Ported as-is** |
| Print/PDF HTML builders | **Ported**; print stylesheet re-checked |

Each port is a copy + import-path fix + test run — recorded in `docs/PORT-LOG.md` (file, source path, changes).

### 5.4 Routing & access
- Admin and client route tables re-created 1:1 from §3.2/§3.3, including every redirect and flag-gated redirect.
- `scripts/route-diff.mjs` extracts route paths from legacy `router.tsx`/`App.tsx` (AST) and from V2 route configs and **fails** if the sets differ (allow-list for intentionally merged redirects, documented).
- Guards (`RequireAuth`, role-based) wrap the same route groups.

### 5.5 Build & output
- `apps/admin` → `web-v2/apps/admin/dist`; `apps/client` → `web-v2/apps/client/dist` (copied nowhere; nginx points to them directly).
- Same build-time globals as legacy (`__APP_BUILD_ID__`, `__APP_VERSION__`, `__OMS_COD_RETURNS_UI_ENABLED__`, `__BACKUP_GDRIVE_UI_ENABLED__`) and the same `version.json` plugin, so the update detector keeps working.
- Dev servers on **different ports** from legacy (e.g. 5273/5274) and proxy `/api` + `/socket.io` to `127.0.0.1:3001` (staging backend), **not** production.
- Same-origin API: browsers hit `/api` on the staging domain (nginx snippet already routes it to `:3001`) → **no backend/CORS change**.

### 5.6 Guard-rails that make "no old components" real
1. **ESLint `no-restricted-imports`** + `eslint-plugin-boundaries`: nothing under `web-v2/` may import `@ds`, `shared/design-system*`, `frontend/**`, `client-frontend/**`.
2. **`scripts/check-manifest.mjs`**: every file in `packages/ui/src/components/**` must have an entry in `COMPONENT-MANIFEST.json` with `source` ∈ `shadcn:<name>` | `square-ui:<template>/<path>` | `shadcn-block:<id>` | `creative-tim:<id>` | `custom:<justification>`; `custom` count is reported at each gate.
3. **Class linters (ESLint custom or `grep` script)** banning: `text-[Npx]` (arbitrary font sizes), physical-direction utilities (`ml- mr- pl- pr- left- right- text-left text-right rounded-l/r border-l/r`) unless `/* rtl-ok: reason */`, raw hex/rgb colours in TSX, `style={{…}}` colours, `variant="destructive"` outside approved components.
4. **Provenance of icons:** only `lucide-react` imports allowed (`no-restricted-imports` for `react-icons`, `@heroicons`, `@hugeicons`, inline `<svg>` except brand logo).

---

## 6. Design system specification

### 6.1 Principles
1. **Tables are the product** (WMS): density, scanability, sticky headers, filter clarity first; marketing flourishes only on dashboard hero and auth.
2. **Colour has one meaning each**; status colours come from one map.
3. **One primary action per toolbar.** Destructive actions never look primary and never sit next to it.
4. **Accessible by default:** WCAG AA text (4.5:1), UI components/icons 3:1, focus rings always visible, tap targets ≥ 40/44 px.
5. **RTL-first correctness:** every component is built with logical properties and verified in `dir=rtl`.
6. **Brand present but restrained:** green identity in shell, primary actions, charts; neutral content surfaces.

### 6.2 Brand tokens (derived from the supplied mock-up and logo)

Sampled from the reference image / `emdad-logo.png`; final values are tuned to pass contrast and then frozen in `tokens.css` (oklch in CSS; hex shown for reference).

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--brand-950` | `#052A1D` | — | sidebar gradient end, deepest ink |
| `--brand-900` | `#063525` | — | **sidebar base** (mock-up `#063525`/`#0D3827`) |
| `--brand-800` | `#06472F` | — | donut/primary data series, primary button hover |
| `--brand-700` | `#19704E` | — | bars (this year), **primary button** (`+ New`) |
| `--brand-600` | `#299E69` | — | success-leaning accents, charts |
| `--brand-300` | `#A9D983` | — | light series (prev. year), soft fills |
| `--brand-200` | `#BAF5B1` | — | **active nav item** background (mock-up `#BAF5B1`), focus highlight |
| `--brand-100` | `#D8EADC` | — | welcome-banner wash |
| `--brand-50` | `#F0F8F2` | — | subtle hover / selected row |
| `--accent-amber` | `#FBC048` | — | "Referral/Discovery"-type warm data series, warning accents |
| `--background` | `#F6F8F6` (very light green-grey) | `#0B1411` | app canvas (mock-up uses off-white) |
| `--card` | `#FFFFFF` | `#101C17` | surfaces |
| `--border` | `#E3E9E5` | `rgb(255 255 255 / 10%)` | hairlines |
| `--foreground` | `#0F1A15` | `#ECF3EF` | body text |
| `--muted-foreground` | tuned **≥ 4.6:1** on `--card` and `--background` (≈ `#4E5F57`) | tuned for dark | secondary text — **no lighter than this** |
| `--primary` / `--primary-foreground` | `--brand-700` / white | `--brand-600`/ near-black | all primary buttons, links |
| `--ring` | `--brand-600` | `--brand-300` | focus ring (2 px + 2 px offset) |
| `--sidebar*` | gradient `--brand-900 → --brand-950`, text `#E6F2EA`, accent `--brand-200` w/ `--brand-900` text | same | Emdad shell |
| `--destructive` | `#C62828`-class red (≥ 4.5:1 on white) | lighter red | destructive only |
| `--chart-1..6` | brand-800, brand-600, brand-300, amber, teal `#1F8A8A`, slate-blue `#5B7C99` | adjusted | series order fixed so charts look related across pages |

Rules: no purple/violet; no gradients on content surfaces; the only gradient is the sidebar (and optionally the welcome banner wash). Dark mode gets its own tuned tokens (not an inversion) and is part of Gate G1.

### 6.3 Semantic colour system (kills F1–F4, F16)

Four layers, each with a fixed job:

| Layer | Tokens | Meaning |
|-------|--------|---------|
| **Action** | `primary`, `secondary`, `outline`, `ghost`, `destructive` | What a control *does* |
| **State feedback** | `success`, `warning`, `danger`, `info` | Result/alert semantics (Alert, toast, field errors) |
| **Operational status** | `tone-*` (below) | Business status of an entity (order, task, invoice…) |
| **Data series** | `chart-1..6` | Chart categories only |

Hard rules (enforced by lint + review):
- **Green is never used for a destructive action; red is never used for primary or neutral actions.**
- *Reset / Clear filters / Cancel dialog* = `ghost` or `outline`.
- A status tone must never be reused for a different meaning in the same portal.
- Any component that shows number deltas uses `<Delta goodWhen>`.

### 6.4 Operational status tone map (single source: `packages/ui/src/status/tones.ts`)

Each tone defines `{bg, fg, border, dot, ring}` for light & dark, all pairs ≥ 4.5:1 (checked by `scripts/check-contrast.ts` in CI/pre-build).

| Tone | Visual | Typical Emdad statuses (final mapping in Phase 1 from legacy maps: `oms-commercial-status.ts`, `client-*-status.ts`, `billing-display.ts`, `task-*`) |
|------|--------|--------------------------------------------------------------|
| `neutral` | grey | Draft, All statuses, Unassigned, Inactive |
| `pending` | amber | Pending approval, Waiting for confirmation, Waiting for admin, Not started |
| `progress` | blue | Processing, In progress, Picking/Packing, Receiving |
| `ready` | teal | Ready to ship, Ready, Approved |
| `transit` | indigo/sky | Out for delivery, In transit, Dispatched |
| `success` | green (brand-600) | Delivered, Completed, Paid, Active, Received |
| `warning` | orange | Partial, Overdue-soon, Expiring, Discrepancy |
| `danger` | red | Failed delivery, Cancelled, Rejected, Overdue, Suspended, Revoked, Out of stock |
| `returned` | rose/plum (muted, **not** the primary violet) | Returned, Return requested |

(Exact assignment — e.g. whether *Cancelled* is `danger` or `neutral-struck` — is fixed once, in Phase 1, in a table reviewed by the owner, then reused everywhere. This table is a deliverable of P1: `docs/STATUS-TONES.md`.)

Consumers: `<StatusBadge status="…"/>` (dot + label, never truncates), `<StatusCard>` (soft bg, dark text, count large, selected ring), chart legends, row accents (left border via logical `border-s-*`), mobile row-cards.

### 6.5 Typography
- Fonts: **Inter** (Latin, numerals) + **IBM Plex Sans Arabic** (Arabic) in one `font-sans` stack; identifiers/order numbers use mono with `tabular-nums`.
- Scale (px): caption/meta 12, **body & table 14**, control 14, section title 16, page title 20–24 (`text-xl/2xl`, tracking tight), KPI value 28–32. Arabic gets +1 px line-height tolerance (`leading-relaxed` where needed).
- Ban `text-[…]`; minimum 12 px; 12 px text must meet 4.5:1.
- Numbers: `tabular-nums` for all counts, money, dates; currency/units in a muted adjacent span (so "USD" never fails contrast: tuned token).

### 6.6 Spacing, density and the table/column contract (kills F6)
- 4 px base grid; page gutter 16 (mobile) / 24 (≥lg); card padding 16/20/24; vertical rhythm between page sections 24; component gap scale limited to 2/3/4/6.
- **Density modes:** `comfortable` (default, row 48 px) and `compact` (row 36–40 px) — user toggle on data tables (persisted).
- **Column presets** (`columns.id`, `.text`, `.status`, `.date`, `.datetime`, `.money`, `.number`, `.avatarText`, `.actions`) each carry `minSize/size/maxSize`, alignment (`text-start` for text, `text-end` for numeric via logical), truncation rule (`line-clamp-1|2` + tooltip with full value), and responsive `priority` (1 always, 2 ≥md, 3 ≥xl).
- Status/ID cells: `whitespace-nowrap`, never shrink below content (fixes "Pending A").
- Header: sticky, `bg-muted/60`, text `foreground/80` weight 500 (fixes pale headers), uppercase not required (Arabic).
- Row: hover `bg-brand-50`, selected `bg-brand-100`, optional left status accent.
- Footer: rows-per-page select + range text + pagination (first/prev/page buttons/next/last) exactly as Square UI's `deals-table` footer, wired to server pagination.
- Table never scrolls the page horizontally: container has `overflow-x-auto` with edge shadows + sticky first column on `md+` for wide tables.

### 6.7 Responsive system (kills F5, F7)
- Breakpoints: Tailwind defaults (`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`); designed and screenshot-tested at **390 / 768 / 1440** (+ 1728 for dashboards).
- Shell: ≥`lg` full sidebar (collapsible to icon rail); <`lg` off-canvas `Sheet` sidebar; topbar actions collapse to icons + overflow menu.
- Tables: <`md` → **row-card view** (title line = primary column + status, 2–4 key fields, actions menu) using the same column definitions (`priority`, `mobileLabel`).
- Filters: ≥`lg` inline bar (search + 2–3 quick filters + "Filters (n)" popover); <`lg` search + "Filters" button opens `Sheet`; active filters always shown as removable chips.
- Page header: title + one primary CTA; secondary actions in overflow menu below `md`.
- All interactive elements ≥ 40 px (44 px under `pointer-coarse`), spacing ≥ 8 px between adjacent targets.
- Forms: single column <`md`, 2-column grid ≥`lg`; sticky action bar on long forms; wizard steps collapse to progress bar.

### 6.8 Icons (kills "icons inconsistent")
- `lucide-react` only; 16 px in dense UI, 18–20 px in nav/buttons, 24 px empty states; stroke 1.75 (set globally via a wrapper default).
- A canonical **icon map** (`icons.ts`) assigns one icon per domain concept so the same concept never has two glyphs: Inbound=`ArrowDownToLine`, Outbound=`ArrowUpFromLine`, Inventory=`Boxes`, Tasks=`ListChecks`, Cycle count=`ScanLine`, Returns=`Undo2`, Products=`Package`, Locations=`MapPin`, Warehouses=`Warehouse`, OMS=`ShoppingCart`, COD=`Banknote`, Batches=`Layers`, Clients=`Building2`, Users=`Users`, Billing=`Receipt`, Reports=`BarChart3`, Audit=`History`, Backups=`DatabaseBackup`, Shipping=`Truck`, Contracts=`FileSignature`, Forms=`ClipboardList`, Notifications=`Bell`, etc. (final list in `docs/ICON-MAP.md`).
- Direction-implying icons flip in RTL (`rtl:-scale-x-100`).

### 6.9 Emdad shell (from the mock-up image)
- **Sidebar** (≥lg 288 px, rail 72 px): vertical gradient `brand-900 → brand-950`; top = Emdad logo (+ Arabic wordmark) on dark; context card (admin: **Warehouse** switcher; client: **Company** name + role); nav groups with 40 px items, active = `brand-200` pill with `brand-900` text and trailing chevron; group labels uppercase 11–12 px at ≥4.5:1; footer: Help, Settings/Profile; user menu (avatar, name, role, dropdown: profile, language, theme, sign out). Bottom decorative **logistics artwork** (warehouse/trucks, low-contrast green) behind the footer, never behind text that needs contrast.
- **Topbar** (sticky, white/card): `SidebarTrigger`, breadcrumb/page title (the page H1 lives in content, not duplicated here), command-palette trigger (`⌘/Ctrl K`), language toggle, theme toggle, notifications bell (single place), user menu on mobile.
- **Content canvas**: rounded white "sheet" inside the light-green canvas exactly like the mock-up (`rounded-2xl`, subtle border).
- **Welcome banner** (dashboards only): `brand-100` wash + warehouse illustration at the inline-end; greeting + one-line summary of *real* data (e.g., "N open orders, M pending tasks"); primary action(s) on the end side. Hidden on mobile or reduced to a compact header.
- **Auth screens**: split layout — form card (start) + brand panel with logo, warehouse illustration and short value copy (end); admin and client differ in copy/illustration crop and portal name chip (kills F15). Language and theme controls remain.
- Assets needed (see §14): vector logo (SVG) incl. Arabic wordmark, warehouse banner illustration, sidebar artwork.

### 6.10 Motion & feedback
Short (150–200 ms) transitions via `tw-animate-css`; respect `prefers-reduced-motion`; skeletons for first load, optimistic/inline spinners for mutations; the old full-screen theme/language switch overlay is replaced by an instant switch (class + `dir` flip) with a brief fade — functionality preserved, overlay component dropped.

---

## 7. Component mapping (old → new)

### 7.1 Primitive & composite mapping

| Old (legacy) | New component | Source | Emdad adaptation |
|--------------|---------------|--------|------------------|
| `@ds` `Button`, `FaIconButton`, `IconButton`, local `Button.tsx` | `Button`, `Button size="icon"` | shadcn `button` | Variants per §6.3; min hit area 40 px; loading state prop (spinner + `aria-busy`) |
| `TextField`, `Field`, `Input`, `SearchInput`, `Textarea` | `Input`, `Textarea`, `Label`, `Form*`, `InputGroup` | shadcn `input/textarea/label/form` | RHF+zod field wrapper `FormField` (label, hint, error tied via `aria-describedby`); `SearchInput` = `InputGroup` + `Search` icon + `Kbd` |
| `Select`, `SelectField`, `Combobox`, `AnchoredDropdown` | `Select`, `Combobox` (Popover+Command), `DropdownMenu` | shadcn | Async-search combobox for clients/products/locations (server queries) |
| `InternationalPhoneInput`, `RecipientNameInput` | `PhoneInput` (shadcn `input` + country `Select` + `libphonenumber-js`) | shadcn + custom (justified) | Keep validation logic from `shared/lib/recipient-contact.ts` |
| `CascadingAddressSelector` | `AddressSelect` (3–4 chained `Combobox`) | shadcn | Data from existing `syria-address-hierarchy.json` |
| `Modal`, `ConfirmModal`, `AppUpdateModal`, scan/barcode modals | `Dialog`, `AlertDialog`, `Sheet` (mobile), `Drawer` (vaul) | shadcn | `ConfirmDialog` with typed-confirm variant for dangerous actions |
| `Drawer` | `Sheet` / `Drawer` | shadcn | |
| `DataTable`, `ServerPaginationBar`, `TableFooterPagination`, `Pagination`, `TableToolbar`, `TableCardHeader` | `DataTable` (TanStack) + `DataTableToolbar` + `DataTablePagination` + `DataTableColumnHeader` + `DataTableViewOptions` | shadcn `table` + Square UI `dashboard-2/deals-table` look; TanStack | §6.6 contract; server-mode; row-card mobile view; column visibility; density |
| `FilterPanel`, `FilterBar`, `AdvancedFilterSection`, `FilterActions`, `FilterCheckboxField`, `FilterScanField`, `FilterAdvancedToggle`, `filter-panel-styles` | `FilterBar` (search + quick filters + `Popover`/`Sheet` advanced panel + chips) | shadcn `popover/sheet/dropdown-menu` + Square UI filter dropdown + chips | URL-synced via existing filter hooks; "Clear" = ghost; scan button via `ScanField` |
| `StatusBadge`, local status pill code | `StatusBadge` | shadcn `badge` + tone map (§6.4) | one map |
| OMS **status cards** (big coloured buttons), client online-orders cards | `StatusCards` (filter cards) | shadcn `card` styled as Square UI stat tiles | **Keep as filters** (click = filter list, selected ring, counts); soft tone styling; 2-/3-/5-col responsive grid with horizontal scroll on mobile |
| `KPICard`, `KPISparkline`, `ClientMetricCard`, `WarehouseOverviewMetricCard` | `KpiStrip` / `KpiCard` (+ `Sparkline`, `Delta`) | Square UI `dashboard-2/stats-cards` | Individually clickable (links) where legacy cards were links; skeleton; polarity-aware delta |
| `Card`, `ClientSurfaceCard`, `SectionContainer`, `DashboardWidget` | `Card` (+ `CardHeader/Title/Description/Action/Content/Footer`) | shadcn `card` | |
| `PieChart`, `OrderProgressGaugeCard`, `OpenTasksByTypeChartCard`, `OpenOrdersStageBarCard`, `OperationsOverview`, `StorageUtilization`, `OutboundPipeline` charts | `DonutChart`, `BarChart`, `AreaChart`, `Sparkline`, `GaugeChart` | shadcn `chart` + Square UI `lead-sources-chart` / `revenue-flow-chart` | Recharts 3; tokens palette; accessible `<figure>` + table fallback; RTL mirror helper |
| `Layout`, `PortalLayout`, `AppShell`, `Sidebar`, `Topbar`, `TopbarNotifications`, `PageContainer`, `PageHeader`, `AppPageHeader`, `ListPageHeader`, `Breadcrumb` | `AppShell` = shadcn `SidebarProvider` + `AppSidebar` + `SiteHeader`; `PageHeader`, `Breadcrumb` | Square UI `dashboard-2` sidebar/header + shadcn `sidebar`, `breadcrumb` | §6.9; notifications = `Popover` + list; nav from `nav.config.ts` |
| `PillSubNav`, `SectionSubNavCard`, `PillTabs`, `StorePillTabs`, `ClientOmsOrdersStatusNav` | `Tabs` (route-linked `TabsNav`) | shadcn `tabs` | Scroll + overflow menu; **one** source of sub-nav per module |
| `RowActionsMenu`, `CompanyNameCell`, `ProductNameCell` | `RowActions` (DropdownMenu), `EntityCell` (avatar/initials + name + sub) | shadcn `dropdown-menu`, `avatar` | Square UI deals-table "Deal Name" cell pattern |
| `EmptyState`, `Alert`, `PageLoadFallback`, `Skeleton`, `Spinner` | `EmptyState`, `Alert`, `Skeleton`, `Spinner` (`Loader2`), `PageSkeleton` | shadcn `alert/skeleton` + Square UI skeleton usage | |
| `ToastProvider` | `Toaster` | shadcn `sonner` | RTL position flip |
| `Tooltip` | `Tooltip` | shadcn | Mandatory on icon-only buttons (`aria-label` too) |
| `ImageUploadField` | `FileDropzone` | shadcn `input` + custom (justified) | |
| `BarcodeImageModal`, `BarcodeScanModal`, `WedgeScanField`, `FilterScanButton`, `BarcodeScanIcon`, `ConfirmReturnByScanModal` | `BarcodeDialog`, `ScanField`, `ScanDialog` | shadcn `dialog`/`input` + `html5-qrcode`, `jsbarcode` | Logic ported; chrome rebuilt |
| `DeliveryLocationMap` | `LocationMap` | `react-leaflet` in shadcn `card` frame | Tile/theme aware (dark) |
| `WorkflowOrderTimeline`, `WorkflowNextRunnableCard`, `WorkflowStatus`, `ClientOrderTrackingPanel`, `ClientShipmentMovementPanel` | `Timeline`, `Stepper`, `NextStepCard` | Square UI `projects-timeline` patterns + shadcn `card`/`progress` | |
| `OrderDraftLinesTable`, `ClientOrderLinesTable` | `LinesTable` (editable `DataTable` variant) | TanStack + shadcn inputs | Inline qty editing with validation |
| `ClientWizardSteps` | `WizardSteps` | shadcn `progress` + custom (justified) | |
| `LanguageSwitchOverlay`, `UiSwitchOverlay` | removed → `LanguageToggle`, `ThemeToggle` | Square UI `theme-toggle` + shadcn `dropdown-menu` | |
| `BillingRestrictionBanner`, `ClientRoleAccessBanner` | `Alert` banner (sticky under topbar) | shadcn `alert` | tone `warning/danger` |
| `CopyEmailButton` | `CopyButton` | shadcn `button` + `Tooltip` | |

### 7.2 Replacement coverage rule
Every legacy component file (45 admin + 25 client + 45 `@ds`) gets one row in `docs/COMPONENT-MAP.md` (generated from a file listing) with status `mapped | merged | dropped(reason)`; Gate G1 requires 100 % rows decided, later gates require mapped components implemented.

### 7.3 Component provenance manifest
`packages/ui/COMPONENT-MANIFEST.json` entry example:
```json
{ "file": "components/data/data-table.tsx",
  "source": "shadcn:table + square-ui:dashboard-2/components/dashboard/deals-table.tsx + @tanstack/react-table",
  "modifiedFor": ["server-side pagination", "RTL logical props", "row-card mobile mode", "column presets"],
  "custom": false }
```

---

## 8. Page recipes (patterns every page must follow)

| Recipe | Anatomy | Applies to |
|--------|---------|-----------|
| **R-Dashboard** | WelcomeBanner → global filters (collapsed row) → `KpiStrip` → 2-col chart row → lists/cards (needs-attention, quick actions, pipeline, tasks, storage) | Admin Dashboard, OMS Dashboard, Client Dashboard, Billing Dashboard |
| **R-List** | `PageHeader` (title, subtitle, **1 primary**, overflow) → optional `StatusCards` (filters) / `Tabs` → `FilterBar` → `DataTable` (+ bulk-action bar when selecting) → footer pagination | Inbound, Outbound, OMS Orders, Batches, COD, Returns, Inventory, Tasks, Products, Locations, Warehouses, Clients, Users, Contracts, Billing plans/invoices, Audit logs, Cycle count, Client lists |
| **R-Detail** | `PageHeader` (back, entity title + `StatusBadge`, primary action) → summary `Card`s → `Tabs` (Lines / Timeline / Documents / Activity) → side panel for meta | all `…/:id` pages |
| **R-Form / Wizard** | `PageHeader` → sectioned `Card`s (RHF+zod) → sticky action bar (Save primary, Cancel ghost) → inline errors + summary | create/edit pages |
| **R-Report** | `ReportsLayout` (left report list collapsible → `Select` on mobile) → filters → KPI → chart → `DataTable` + export | 22 report pages |
| **R-Execution (floor/mobile)** | Large-target, single-column, sticky progress header, scan-first input, bottom action bar, high-contrast, works one-handed at 390 px | Task execute, Cycle-count execute, Return process, Internal transfer, Quick directed outbound |
| **R-Settings/Danger** | Sectioned cards; "Danger zone" card for destructive actions with typed confirmation | Backups, Shipping companies, Profile |
| **R-Print** | Dedicated print layouts (waybill, GRN/DN, invoice, labels) isolated from app chrome | print routes/modals |
| **R-Auth** | Split layout (§6.9) | Login (both), account-inactive |

Each recipe is built once in Phase 1/2 (R-Dashboard + R-Auth in P1; R-List in P2; the rest as phases reach them) and **reviewed in isolation** (Storybook-lite route `/__kit` inside dev builds only) before being used across pages.

---

## 9. Data-preservation protocol ("same function, same data")

### 9.1 Parity Sheet (one per route, before building it)
Stored at `web-v2/docs/parity/<portal>/<route-slug>.md`, generated semi-automatically (script extracts `t([...])` strings, `useQuery` keys/API calls, columns, filter params, links/navigate targets from the legacy page; a human/agent completes and signs):

```
Route / legacy file / roles allowed / feature flags
Data: each datum shown (field name → API source → format)
Columns: id, label EN/AR, source field, priority, format
Filters: param name, control type, options source, default, URL key
Status cards / tabs: which filter, counts source
Actions: primary, secondary, row actions, bulk actions (+ permission, endpoint, confirm?)
Navigation: links in/out
States: loading, empty (first-run vs filtered), error, needs-scope
Realtime: events that must refresh it
Print/export/import: formats
Responsive notes from audit (screenshots: ui-audit/<portal>/NN-*)
Intentional changes: (list; each approved)  ← default is "none"
```
A page is **done** only when every line has a ✅ and Intentional changes were approved.

### 9.2 Explicit preservation decisions (from the request)
- **OMS Orders / Online orders status cards remain filter cards** (All statuses, Waiting for confirmation, Waiting for admin, Processing, Ready to ship, Out for delivery, Delivered, Failed delivery, Returned, Cancelled). Only their *styling* changes (§6.4) — they are **not** converted to a dropdown.
- **Operational-stage / "action by QR" buttons** (Confirm/Approve/Handover/Delivered/Failed-delivery by QR with "choose an action, then scan") remain a button group (segmented control), not a dropdown; the helper text stays.
- Dashboard cards that are links stay links; Quick Actions keep the same destinations; "Needs attention" keeps its actions (Restore, View Orders, Resolve).
- Cards that act as filters, tabs that switch datasets, role-conditional actions, bulk actions, import/export, scan flows: preserved.
- Where the audit flagged *data conflicts* (e.g., Returns "select a tenant" alert with rows), fix the **presentation logic** only; the underlying rule (admin must select a tenant to list returns) is preserved unless the owner says otherwise.

### 9.3 Automated parity aids
- `route-diff` (routes), `i18n-diff` (every EN/AR string tuple used in legacy page exists in V2 or is listed as intentionally removed), `api-diff` (endpoints called per page: legacy vs V2, from network logs in Playwright runs), `nav-diff` (menu items per role).
- Side-by-side screenshot harness: same account, same data, legacy vs V2 at 390/1440, stored under `web-v2/docs/parity-shots/`.

---

## 10. Phased roadmap

General rules for **every** phase:
1. Read the Parity Sheets → build → run checks (§12) → screenshots (EN/AR, light/dark, 390/768/1440) → Better Design review (`get-review-rules`, `check-comprehension`, `inspect-spacing`) → write `docs/PHASE-REPORTS/PHASE-N.md` → **stop for approval at gates**.
2. Staging only; legacy builds/outputs untouched; backend untouched.
3. Memory discipline: one Vite build at a time.

### Phase 0 — Foundations (no user-visible pages) · est. 1.5–2.5 days
| # | Task | Output |
|---|------|--------|
| 0.1 | Safety: git tag/branch `pre-frontend-v2`; note uncommitted state; (confirm) untrack `.cursor/mcp.json` | recoverable baseline |
| 0.2 | Rules/skills sync (§2.4): add `frontend-v2.mdc`, scope legacy rules, amend `AGENTS.md`, fix `skills-lock.json` | consistent agent guidance |
| 0.3 | Verify Playwright MCP loads (or set up local Playwright runner with staging-only origins) | working screenshot loop |
| 0.4 | Vendor reference: `web-v2/reference/square-ui` (read-only, gitignored) | harvest source |
| 0.5 | Scaffold `web-v2` workspace, both apps boot with "hello shell", Vite proxy → `:3001`, build scripts with memory cap | `npm run dev/build -w apps/admin` OK |
| 0.6 | `packages/ui`: Tailwind v4, tokens, fonts, shadcn init, install primitive set (button, input, textarea, label, select, checkbox, radio-group, switch, badge, card, table, tabs, dropdown-menu, dialog, alert-dialog, sheet, drawer, popover, command, calendar, tooltip, sonner, skeleton, separator, scroll-area, avatar, progress, collapsible, accordion, breadcrumb, pagination, form, alert, chart, sidebar, kbd, toggle-group, slider) | `COMPONENT-MANIFEST.json` baseline |
| 0.7 | Direction/theme/language infrastructure: `DirectionProvider`, theme class strategy, language store (reusing legacy storage keys so choice carries over), logical-property lint, fonts | RTL + dark smoke page `/__kit` |
| 0.8 | `packages/core`: port API client(s), auth, RBAC, i18n, query client, realtime provider, update detector; port + run their existing unit specs | tests green |
| 0.9 | Tooling: ESLint rules (§5.6), `check-contrast`, `check-manifest`, `route-diff`, `parity` generator, screenshot runner | CI scripts |
| 0.10 | `COMPONENT-MAP.md` (all legacy components decided), `DESIGN.md` (via `design-md`/`extract-design-md` skills + curated), `STATUS-TONES.md` (draft), `ICON-MAP.md` | docs |
| 0.11 | Rollout switch prepared (not activated): nginx include + scripts (§11) | dry-run only; **no reload without confirmation** |

**Exit criteria:** both apps build; `/__kit` shows all primitives in light/dark × LTR/RTL; contrast gate passes; lint gates active; ported unit tests green; legacy sites unchanged (verified by smoke).

### Phase 1 — PILOT: Login + Dashboard, both portals, complete and working · est. 4–6 days
Scope (exactly what you asked first):

| Portal | Pages | Includes |
|--------|-------|----------|
| **Admin** | `/login`, `/dashboard/overview` (+ `/`, `/dashboard` redirects, role home redirect, `*`) | Full **AppShell** (sidebar with real nav for all roles, topbar, command palette, notifications, language/theme, user menu, update modal, realtime), all dashboard widgets and data |
| **Client** | `/login`, `/dashboard` (+ `/`, `/account-inactive`, NotFound) | Full client shell (store/warehouse/account groups), dashboard with real data |

Other nav entries in P1 link to routes that **still resolve on the legacy site**? → No: V2 and legacy share the domain; unbuilt routes in V2 render a branded `NotMigratedYet` page with a "Open in classic UI" button (sets `emdad_ui=v1` cookie and navigates to the same path). This keeps staging usable during the migration and doubles as the rollback affordance. (Removed at P9.)

**Admin Login must keep:** email/password, show password, remember-me (30 days / session storage semantics), remembered-account chooser + "use another account", Google sign-in + all `google_error` messages + `google_auth=success` completion, EN/AR switch, error mapping (`loginError`), post-login redirect to role home/`from`.
**Client Login must keep:** same minus Google (per legacy code), account-inactive redirect, billing-restriction behaviours.

**Admin Dashboard data to keep (parity sheet in P1):** global filters (Warehouse / Client / Period), Refresh, Export; KPIs (Open Orders w/ breakdown + sparkline, Pending Tasks, Storage Utilization with CBM, Active Clients w/ suspended, Revenue w/ invoices); Operations Overview chart (tabs Orders/Tasks/Inbound/Outbound × 7D/30D/90D, "View full report"); Needs Attention (suspended client → Restore, picking backlog → View Orders, overdue etc., "View all alerts"); Quick Actions (New Client/Inbound/Outbound, Create Invoice/Contract, More); Outbound Pipeline; Warehouse Tasks progress; Storage donut; Billing widgets (expiring, overdue, recent invoices, suspended accounts), Top Products, Recent Activity — **exactly as legacy components provide, minus the duplicates called out by the audit (second bell, repeated storage widget is merged into one placement but both data points remain accessible)**.
**Client Dashboard data to keep:** Open OMS orders, Current obligation (USD), Sellable stock, COD figures (pending/collected/remitted), order-movement donut + 7-day summary, order summary metrics, live inventory (EN+AR names), returns, invoices obligation, notifications teaser, payout teaser, "New order" and "View cash on delivery", period filters (apply/reset), store-channel filter.

**P1 deliverables:** both portals deployable behind the cookie switch; `STATUS-TONES.md` final; Parity Sheets for the 4 pages; screenshots grid (EN/AR × light/dark × 390/768/1440 → 24 per page); a11y + contrast + RTL reports; Better Design review notes; short video-free walkthrough doc.

#### ▶ Gate G1 — your review
Pass/fail questions: Does the Emdad identity read correctly (green, logo, artwork)? Is the shell/nav acceptable on laptop and phone? Are the dashboards' data/actions complete versus legacy? Arabic/RTL and dark mode acceptable? If **no** → fix before anything else; if **yes** → continue.

### Phase 2 — List recipe pilots (validate the table/filter system on real lists) · 3–4 days
Admin: `/orders/inbound`, `/orders/outbound`, `/inventory/stock`, `/products` · Client: `/ecommerce-orders` (status cards as filters), `/inbound-orders`, `/outbound-orders`, `/products`.
Builds & hardens: `DataTable`, `FilterBar`, `StatusCards`, bulk bar, import/export modals, row actions, empty/error states, row-card mobile view.
**Gate G2.**

### Phase 3 — Create/edit/detail (forms & wizards) · 5–7 days
Admin: inbound/outbound create+edit+detail, product detail, inventory product detail, ledger entry/reference, adjustments (+detail). Client: create inbound/outbound/ecommerce order, create/edit product, product/order/return details, create return.
Builds: `FormField` kit, `LinesTable`, `AddressSelect`, `PhoneInput`, `FileDropzone`, wizard, detail layouts, timelines, print dialogs.
**Gate G3.**

### Phase 4 — OMS suite (admin) · 6–8 days (largest page: 2 324 lines)
OMS dashboard, OMS orders (list with status cards + QR action group, create, detail, waybill), batches (+detail), COD (+detail), OMS returns (+detail, plan edit) — respecting `isOmsCodReturnsUiEnabled()`.
**Gate G4.**

### Phase 5 — Floor / worker flows (mobile-critical) · 6–8 days
Tasks list/detail/execute (`TaskExecutionView` 1 338 lines), internal transfer, cycle count (list, my-tasks, detail, execute), WMS returns (list, detail, process), quick directed outbound. Scan-wedge input, large targets, offline-tolerant UX remains as legacy.
Extra validation on real devices/emulation (390 px, coarse pointer), plus scripted scan simulation.
**Gate G5** (requires an operator walk-through, not only screenshots).

### Phase 6 — Master data & administration · 5–7 days
Warehouses, locations (tree + table), clients (+ detail), users (warehouse + client, detail), contracts (GRN/DN/final), forms, shipping companies, billing (dashboard, plans CRUD, templates, invoices, invoice detail).
**Gate G6.**

### Phase 7 — Reports, audit, notifications, profile, backups · 4–6 days
22 reports on `R-Report` (generator-driven), audit logs, notifications (admin), profile, backups & settings (history, schedules, retention, health, Google Drive), danger-zone redesign.
**Gate G7.**

### Phase 8 — Client remainder · 3–4 days
Client returns (ecommerce + outbound), COD (`/my-profits`), billing, invoices (+detail), APIs, notifications, profile, account-inactive, NotFound. (May run in parallel with Phases 4–7 by portal.)
**Gate G8.**

### Phase 9 — Hardening & cut-over readiness · 3–5 days
Full parity audit (route/i18n/api/nav diffs), a11y sweep (axe on every route), performance budget (§12.5), cross-browser, adapt/port Playwright e2e (`frontend/e2e/*`, `tests/e2e/*`) to V2 selectors, visual-regression baselines, remove `NotMigratedYet`, final `ui-audit` re-run (same scripts → new `ui-audit-v2/` report compared with the old one), decide default-to-V2 on staging.
**Gate G9** → recommendation for production promotion (separate, explicit decision; **out of scope** for this plan).

Totals (indicative, agent-assisted, excluding review latency): ~40–55 working days across phases; Phase 0+1 ≈ **6–8 days** to the first reviewable result.

---

## 11. Rollout, switching, and rollback (staging)

### 11.1 Mechanism: cookie-selected document root (both UIs live simultaneously)
Current: `root /var/www/emdad-sy-3pl-wms-staging/frontend/dist;` (admin) and `…/client-frontend/dist;` (client).
Proposed (in the two staging vhost files **only**):

```nginx
# conf.d snippet (staging only)
map $cookie_emdad_ui $emdad_admin_root {
    default  /var/www/emdad-sy-3pl-wms-staging/web-v2/apps/admin/dist;   # flip this single line to v1 path for instant global rollback
    v1       /var/www/emdad-sy-3pl-wms-staging/frontend/dist;
}
map $cookie_emdad_ui $emdad_client_root {
    default  /var/www/emdad-sy-3pl-wms-staging/web-v2/apps/client/dist;
    v1       /var/www/emdad-sy-3pl-wms-staging/client-frontend/dist;
}
# in server blocks:
root $emdad_admin_root;                       # (client vhost uses $emdad_client_root)
location = /__ui/v1 { add_header Set-Cookie "emdad_ui=v1; Path=/; Max-Age=2592000; Secure; SameSite=Lax"; return 302 /; }
location = /__ui/v2 { add_header Set-Cookie "emdad_ui=v2; Path=/; Max-Age=2592000; Secure; SameSite=Lax"; return 302 /; }
```
- `index.html` remains `no-cache`; `/assets/*` immutable — hashed filenames differ between builds so the two UIs cannot collide in browser/CDN caches.
- Until you approve G1, **default stays `v1`**; testers opt in with `/__ui/v2`. After G1 you may flip the default to V2 (legacy reachable via `/__ui/v1`).
- Backend, `/api`, `/socket.io`, PM2 `emdad-wms-backend-staging` are untouched.

### 11.2 Safety steps
1. `nginx -t` before any reload. **A reload is graceful but nginx is shared with production vhosts**, so per the staging-only rule the reload is a gated step: *ask for explicit confirmation before executing it.*
2. Backup copies of the two staging vhost files (`*.bak-pre-v2`) before editing.
3. Rollback = (a) user: visit `/__ui/v1`; (b) global: flip the `default` line + `nginx -s reload`; (c) nuclear: restore `.bak-pre-v2` files.
4. Legacy `dist/` folders are never rebuilt during V2 work (so rollback target is stable). If legacy needs a hotfix, build it normally.
5. `version.json` update detector: V2 uses its own build id; legacy unchanged; switching UIs doesn't trigger false "update available" because both read their own `/version.json` from the active root.

### 11.3 Build & deploy commands (to be scripted in `web-v2/scripts/`)
`build:admin`, `build:client` (sequential, `NODE_OPTIONS=--max-old-space-size=2048`), `deploy:check` (route smoke via curl for both domains + `/api/health`), `snapshot:dist` (tar previous V2 dist to `.deploy-backup/` for rollback between V2 builds).

---

## 12. Quality assurance strategy

### 12.1 Automated gates (run at every phase)
| Gate | Tool | Fails when |
|------|------|-----------|
| Types/lint | `tsc -b`, ESLint (restricted imports, RTL, font-size, hex, destructive-variant) | any error |
| Unit | Vitest (ported specs + new component tests) | any failure |
| Manifest | `check-manifest` | file without provenance |
| Contrast | `check-contrast` over tone/token pairs, light + dark | < 4.5:1 text, < 3:1 UI |
| Route parity | `route-diff` | route set differs from legacy (non-allow-listed) |
| i18n parity | `i18n-diff` | legacy string missing without approval |
| a11y | `axe-core` via Playwright on each built route (EN/AR, light/dark) | serious/critical violations; also exactly-one-H1 check |
| Tap targets | Playwright evaluation of interactive elements at 390 px | any < 40 px |
| Visual | Playwright screenshots 390/768/1440(/1728) × EN/AR × light/dark vs approved baselines | pixel diff over threshold (after baseline approval) |
| Perf | `vite build` report + Lighthouse (mobile) on Login + Dashboard | budgets in §12.5 |

### 12.2 Design review loop (per page)
Skill/MCP sequence: `frontend-design` (intent) → `ui`/`ui-design` (audit mode) → Better Design: `get-ui-principle`, `get-ux-principle` before styling/behaviour; after build `get-review-rules`, `check-comprehension`, `inspect-spacing`; dashboards additionally `review-dashboard-structure` / `finalize-dashboard-review` with rendered evidence at 390/1440/1728 (public HTTPS preview = the staging domain). Playwright MCP/runner captures screenshots; findings logged in the phase report.

### 12.3 Re-running the original audit
The same capture script that produced `ui-audit/` is parameterised for V2 → `ui-audit-v2/{admin,client}` with the same report format, plus a diff table "finding F1…F17: before → after". Target: **zero high-severity contrast findings, zero tap-target findings, zero duplicate-H1 / missing-H1, destructive/primary colour semantics verified**.

### 12.4 Manual checks
Owner walk-through at each gate; floor-flow session at G5; RTL read-through by an Arabic-speaking reviewer; one real mobile device pass (iOS Safari + Android Chrome).

### 12.5 Budgets (starting points)
- Login: JS ≤ 180 kB gz initial; Dashboard route chunk ≤ 250 kB gz excluding shared vendor; LCP ≤ 2.5 s on throttled mobile; CLS < 0.1; no layout shift when language/theme toggles.
- Route-level code splitting preserved (lazy pages + chunk-failure → update modal).

---

## 13. Risks and mitigations

| # | Risk | Likelihood / impact | Mitigation |
|---|------|---------------------|-----------|
| R1 | **RTL regressions** because Square UI is LTR-only | High / High | Logical-props lint, RTL screenshots in every phase, Radix `DirectionProvider`, sidebar side flip, chart mirror helper |
| R2 | Scope/time: ~100 routes, 40 k+ lines of page JSX | High / High | Phased gates, recipes, generator-assisted parity sheets, ported logic, parallel portal tracks |
| R3 | Functional drift ("looks right, behaves different") | Medium / High | Parity Sheets, api-diff via network capture, ported hooks/tests, e2e adaptation in P9 |
| R4 | Worker/scan flows degrade on mobile | Medium / High | Dedicated recipe R-Execution, G5 operator test, keep vendored execution package untouched |
| R5 | Machine memory (7.8 GB, ~5.3 GB used) → OOM during builds | Medium / Medium | Sequential builds, heap cap, avoid concurrent Playwright, consider building off-box if needed |
| R6 | Tailwind v4 / shadcn CLI churn; Recharts 3 chart typing | Medium / Medium | Pin versions at P0 spike; lockfile; render every chart type in `/__kit` before use |
| R7 | License: Square UI derivative must not be redistributed | Low / High | `reference/` gitignored; `packages/ui` private; no public repo/template publication |
| R8 | Brand assets missing/low-res (logo is 175×110 PNG) | High / Medium | Request SVG; interim: vectorise or use text-lockup; do not upscale raster in the sidebar |
| R9 | nginx reload impacts shared master (production vhosts) | Low / High | `nginx -t`, graceful reload, explicit confirmation, backups; no prod file edits |
| R10 | Mixed legacy/V2 during migration confuses testers | Medium / Low | `NotMigratedYet` page with one-click "Open classic UI", visible "V2 preview" chip, clear cookie switch docs |
| R11 | Contrast tuning of brand greens conflicts with mock-up look | Medium / Low | Keep mock-up hues for large fills; use darker text tones; verify by script, show before/after at G1 |
| R12 | Secrets in repo (`.cursor/mcp.json`) | Medium / Medium | §2.5 hygiene step with owner approval |

---

## 14. Decisions / inputs needed from you (defaults in bold)

| # | Question | Default if you say nothing |
|---|----------|---------------------------|
| D1 | OK to read "ChatGPTN" as **shadcn/ui** (Radix) + Square UI `templates/` (not Base UI)? | **Yes** |
| D2 | Port (not rewrite) the API/auth/RBAC/i18n/realtime/pure-logic layers into `packages/core`, rebuilding only UI? | **Yes** — rewriting logic risks behaviour change |
| D3 | New workspace `web-v2/` (own npm workspaces, React 19 / Tailwind 4 / Vite 7) | **Yes** |
| D4 | **Brand assets:** vector logo (SVG/PDF) with Arabic wordmark; warehouse banner illustration; sidebar artwork; confirm the green values in §6.2 are the official palette | **Need files.** Fallback: crop/regenerate from the supplied mock-up and mark as placeholders |
| D5 | Fonts: Inter + IBM Plex Sans Arabic (self-hosted) — or an Emdad-mandated font? | **Inter + IBM Plex Sans Arabic** |
| D6 | nginx cookie-switch approach and permission to edit the two **staging** vhost files and run `nginx -t && reload` at the gate | **Ask again at the moment of change** |
| D7 | Default UI after G1: keep legacy as default (opt-in V2) or flip to V2 default? | **Legacy default until G1 passes** |
| D8 | Treat `.cursor/mcp.json` secret: untrack + rotate Better Design key? | **Recommend yes; will ask** |
| D9 | Allow tiny changes where the old UI had real defects (e.g., Returns alert+rows conflict, duplicate bell) | **Yes, listed in Parity Sheet "Intentional changes", approved per page** |
| D10 | Priority order after Phase 1 (default order is P2→P9; Admin/Client can run in parallel) | **As in §10** |
| D11 | Dark mode and EN/AR required from day one (current apps have both) | **Yes** |
| D12 | Can I use the staging test accounts already used by the audit (`superadmin@emdad.example`, `client@acme.example`) for screenshot/parity capture? | **Yes (staging only)** |

---

## 15. How the agent will execute (workflow contract)

Per page:
1. Read legacy page + audit section + screenshots → write Parity Sheet.
2. Pick recipe (§8) and components (§7); add missing primitives via shadcn CLI / blocks only.
3. Port needed logic (record in `PORT-LOG.md`).
4. Build page; strings via existing `LocalizedMessage` tuples; no hard-coded colours; icons from icon map.
5. Run gates (§12.1), capture screenshots, run Better Design review, fix.
6. Update `COMPONENT-MANIFEST.json`, `COMPONENT-MAP.md`, phase report.
7. At gates: stop, summarise, wait for approval.

Skills used (by purpose): `frontend-design` (direction), `ui` / `ui-design` (audit/systemic quality), `better-design` + MCP (principles, reviews), `react`, `typescript`, `tailwind` (v4), `shadcn` / `shadcn-ui` (component work), `react-hook-form` + `zod` (forms), `tanstack-query` (data), `nuqs` (URL state, if adopted), `vercel-composition-patterns` + `vercel-react-best-practices` (component APIs/perf; Next-specific parts ignored), `feature-arch` (feature folders), `playwright` + `vitest` + `msw` + `tdd` (tests), `web-design-guidelines` (final review), `extract-design-md`/`design-md` (DESIGN.md), `creative-tim-ui` (block reference only; brand overridden to Emdad green), `react-vite-dashboard` (Vite dashboard patterns). `nextjs` skill is **not** used.

Feature-folder convention inside each app (per `feature-arch`): `src/features/<domain>/{api,components,hooks,pages,schemas,index.ts}`; shared UI only from `@emdad/ui`; shared logic only from `@emdad/core`.

---

## Appendix A — Legacy → V2 file inventory to be generated in Phase 0
- `docs/COMPONENT-MAP.md`: auto-listed from `frontend/src/components/**`, `client-frontend/src/components/**`, `client-frontend/src/design-v2/**`, `shared/design-system-next/ui/**` (≈ 115 files).
- `docs/PORT-LOG.md`: list of ported non-visual modules (≈ 28 admin `api/*`, 17 client `services/*`, ≈ 70 `lib/*`, 22 hooks, auth, realtime).
- `docs/parity/…`: one per route (admin ≈ 60 unique pages, client ≈ 28).

## Appendix B — Admin sidebar (V2) information architecture (same destinations, better grouping)
```
Dashboard
── Operations (WMS) ──  Inbound · Outbound · Inventory · Tasks · Cycle count · Returns
── Catalogue ─────────  Products · Locations · Warehouses
── Commerce (OMS) ────  OMS Dashboard · OMS Orders · Batches · COD · OMS Returns   ← OMS Returns included (audit gap)
── Business ──────────  Clients · Contracts · Billing · Reports · Forms · Shipping Companies
── Administration ────  Users · Audit logs · Notifications · Backups
(role filtering identical to legacy `NAV_CATALOG`; collapsible groups; rail mode)
```
Client: `Dashboard` · **Store** (Online orders, Cash on delivery, Returns) · **Warehouse** (Inbound, Outbound, Outbound returns, Inventory) · **Account** (Billing, Invoices, APIs, Notifications, Profile) — same role gating as `client-frontend/src/lib/rbac.ts`.

## Appendix C — Acceptance checklist for "no old component left"
- [ ] `grep -R "@ds" web-v2` → 0 results
- [ ] No import path escapes `web-v2/` except `reference/` (excluded from build)
- [ ] Manifest has 0 files without provenance; `custom` entries each justified
- [ ] 0 occurrences of banned classes (arbitrary font size, physical direction, raw hex)
- [ ] Route-diff / i18n-diff / api-diff / nav-diff reports attached
- [ ] Contrast gate + axe + tap-target reports attached
- [ ] Re-run audit table (F1–F17) shows every finding resolved

*End of plan. No code, configuration, build or deployment change has been made by producing this document.*

---

## 16. Status update — after Phase 0 + Phase 1 (approved scope)

- Scope executed: Phase 0 + Phase 1 (login + dashboard for both portals, admin OMS Orders list, one `ConfirmDialog`). Stopped at **Gate G1** for your decision; see `web-v2/docs/reports/PHASE-1-REPORT.md`.
- **Independence requirement (new, hard)**: `web-v2/` must not depend on `frontend/`, `client-frontend/` or `shared/design-system*`. Enforced by `npm run check:independence`; route-diff uses a frozen snapshot (`web-v2/docs/legacy-routes.snapshot.json`).
- Reduced tooling (as approved): only independence, contrast, route-diff and RTL-lint checks for this stage.
- Pinned versions: Vite 7.3.7, React 19.2.8, react-router 7.18.4, Tailwind 4.3.3, TanStack Table 8.21.3 / Query 5.104.1, TypeScript 5.9.3, ESLint 9.39.5.
- Colours follow the eyedropped mock-up (mint canvas `#dcebdf`, sheet `#f2f8f3`, sidebar `#053424`, active `#bbf5b1`); working reference is `web-v2/DESIGN.md` + `.cursor/rules/frontend-v2.mdc`.
- Rollout: nginx cookie switch prepared in `web-v2/deploy/nginx/` (not applied; legacy default until G1 passes).

