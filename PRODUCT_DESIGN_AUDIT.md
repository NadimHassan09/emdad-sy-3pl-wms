# Product Design Audit — EMDAD WMS

**Role:** Principal Enterprise Product Designer  
**Framework:** `UX_CHECKLIST.md`  
**Scope:** Admin Portal + Client Portal (staging)  
**Baseline:** Committed `HEAD` on `staging` (working tree currently missing core shell/DS files; audit reflects last committed UI)  
**Bar:** Stripe Dashboard · Linear · Vercel · Notion · Microsoft Dynamics · SAP Fiori · Oracle Fusion  
**Mode:** Problems only — no remediation

---

## Executive verdict

The product does not yet clear an enterprise SaaS bar. It reads as **two portals with parallel chrome**, **multiple competing recipes for the same jobs** (headers, lists, badges, buttons, sub-nav), and **unresolved brand color drift** (emerald tokens beside forest greens and teal charts). List pages often bury the page purpose under filter cards; dashboards lead with vanity or marketing weight instead of operational attention; several controls look interactive but do nothing.

Highest-severity themes: **multi-header stacks**, **dual design systems**, **forest/emerald split**, **decorative table chrome**, **filters without applied-state**, **dashboards that don’t answer “what next?”**.

---

## 1. Visual hierarchy

| ID | Problem | Evidence |
|----|---------|----------|
| **H1** | Many Admin list views lack a single page-level primary. Purpose and create CTA sit inside filter or table chrome, not as one clear focal point. | `InboundListPage`, `ProductsPage`: no page `h1` / `PageHeader`; first chrome is `FilterPanel` title (“Order filters” / “Product filters”), then `DataTable` title; CTA in table actions. |
| **H1** | Outbound and billing lists stack equal-weight titles (page header + filter title + table title ± section sub-nav). | `OutboundListPage`: `ListPageHeader` + `FilterPanel` + `DataTable title` + `SectionSubNavCard`. `BillingPlansPage` / `BillingInvoicesPage`: `PageHeader` + filter card + table title; Plans also inserts `VolumeAllocationPanel` before the list task. |
| **H1** | Billing Plans header presents two create paths of similar presence. | “Create plan template” beside brand “+ Create plan”. |
| **H1 / D1** | Admin dashboard leads with catalog/customer vanity before open work. | `DashboardOverviewPage`: “Items in catalog” / “Total customers” before open-order attention. |
| **H1 / D1** | Client dashboard elevates a marketing-weight COD finance card (double border, gradient, glow, full-width CTA) above sober operational scanning. | `DashboardPage` COD hero. |
| **H2** | Hierarchy often relies on color (rainbow KPI wells, emerald glow CTAs, rose Reset) rather than type scale/weight alone. | Client KPI icon wells (sky/amber/violet); order-list CTA `shadow-lg shadow-emerald-600/20`; Admin `FILTER_RESET_BUTTON_CLASS` rose fill. |
| **TY3 / H2** | Micro ALL-CAPS section labels (`text-[10px] … tracking-widest`) compete with real titles across dashboards and sidebars. | Admin `SectionHeading`; Client sidebar section labels; Billing dashboard KPI labels. |

---

## 2. Layout

| ID | Problem | Evidence |
|----|---------|----------|
| **SP3** | Admin main content is not consistently bounded; ultrawide layouts leave sparse tables/forms. | `AppShell.Main` without shared use of `PageContainer` / `--content-max-w` on audited list pages. |
| **C1** | Default list layout is card-on-card: section sub-nav card → filter card → table card. | Admin `Layout` + `SectionSubNavCard` + `FilterPanel` + `DataTable`. Client inbound/outbound: filter `Card` then table `Card`. |
| **L / shell** | Admin and Client do not share one application chrome model. | Admin: `@ds` `AppShell` / `Sidebar` / `Topbar` via `Layout.tsx`. Client: bespoke `PortalLayout` (hard-coded slate-950 + glass topbar). |
| **Profile vs ops** | Client Profile uses a social-style hero (dark banner + overlapping photo) that fights the operational portal layout language. | `ProfilePage`. |
| **Billing sprawl** | Client Billing is a long vertical stack of plan hero, usage, charts, limits, invoice preview, and feature chips without a single-task layout. | `BillingPage`. |

---

## 3. Spacing

| ID | Problem | Evidence |
|----|---------|----------|
| **SP1** | Spacing rhythm is inconsistent across portals and even within Client. | List pages often `space-y-5`; Notifications uses `space-y-4`; dashboard tables use looser `py-5` / `px-6` while ops tables use tighter `py-3`. |
| **SP1** | One-off radii and control heights break the token scale. | Admin `TextField` / filter fields: `h-11 rounded-[10px]` vs DS button/token radius. |
| **SP2** | Filter titles carry decorative icon + generic description, adding vertical chrome before the actual controls. | `FilterPanel` emerald circle icon + “Refine the list…” on every list. |
| **SP3** | Client Profile constrains to `max-w-3xl` while Billing/lists use full `max-w-7xl` main — portal feels like two products side by side. | `ProfilePage` vs `PortalLayout` main / `BillingPage`. |

---

## 4. Typography

| ID | Problem | Evidence |
|----|---------|----------|
| **TY1** | Title recipes drift: `text-2xl` welcome, `text-xl` list headers, Notifications `h2` intro, micro `10px` overlines — more sizes than a tight UI scale. | Client `DashboardPage` vs `ListPageHeader` vs `ClientPageIntro`. |
| **TY2** | Ops-critical badges and pills drop to `text-[10px]`, below comfortable table readability. | Admin `ProductsPage` stock/status pills; dashboard KPI labels. |
| **TY3** | ALL-CAPS used for table headers, field labels in detail, filter/meta chrome — not reserved for rare overlines. | Local Admin `DataTable` thead uppercase; `InboundDetailPage` `Field` labels `uppercase tracking-wide`. |
| **TY / brand** | Client forces Inter on `#client-portal-root` — default SaaS stack with no product-distinct type system. | `client-frontend` `index.css`. |
| **i18n / hierarchy** | Mixed hardcoded English section titles beside `t(...)` cards on Admin dashboard. | “Open orders”, “Expiry alerts”, “Recent activity” vs translated KPI titles. |
| **Client lists** | Status option labels largely untranslated in Arabic contexts (only “All statuses” mapped on audited order lists). | `InboundOrdersPage` / `OutboundOrdersPage`. |

---

## 5. Cards

| ID | Problem | Evidence |
|----|---------|----------|
| **C1** | Over-carding: nearly every list ships 2–3 elevated soft cards before data. | Admin: `SectionSubNavCard` + `FilterPanel` + table card. Client: filter Card + table Card. |
| **C1** | Detail views misuse filter/content panel chrome as the entity surface. | `InboundDetailPage` wraps order details in `FilterPanel variant="content"` (“Order details”). |
| **C1** | Client Profile nests slate field tiles inside a Card (card-in-card). | `ProfilePage`. |
| **C2** | Elevation does not reliably mean interactivity — hover-lift and soft shadows appear on static and interactive surfaces alike. | Client Billing StatCards / hover lift; Admin soft shadow on filter, table, and sub-nav equally. |
| **Consistency** | Three Client card recipes coexist. | `design-v2/Card`, `@ds` Card slots (unused/partial), `ClientSurfaceCard` CSS-var surface. |

---

## 6. Tables

| ID | Problem | Evidence |
|----|---------|----------|
| **T3** | Admin lists use local `DataTable` without sticky headers; DS table documents sticky behavior that lists don’t get. | `frontend/.../DataTable.tsx` vs `shared/design-system` DataTable. |
| **T4** | Loading/empty are thin: centered “Loading…”, string-only empty cells, Billing dashboard “No data yet.” — layout jumps and no first-run vs filtered-empty distinction. | Admin lists; Client inbound/outbound “…” empty; `BillingDashboardPage`. |
| **T2** | Client inbound/outbound show checkbox columns and row ellipsis **without** bulk actions or real menus (ellipsis only `stopPropagation`). | `InboundOrdersPage`, `OutboundOrdersPage`. |
| **T2** | Client Invoices: row click **and** View + Print icon buttons — redundant action density. | `InvoicesPage`. |
| **T1 / density** | Invoices table carries nine columns including always-`SYP` Currency — low signal per column. | `InvoicesPage`. |
| **Consistency** | Same Client dashboard uses two thead languages. | Inventory `bg-emerald-50/40` vs Latest orders `bg-slate-50/80` on `DashboardPage`. |
| **Consistency** | Ecommerce list drops checkbox/actions columns that inbound/outbound fake — inconsistent list anatomy. | `EcommerceOrdersPage` vs order list pages. |
| **Pagination** | Client `TableFooterPagination` has no page-size control; Admin local footer reinvented vs DS `Pagination`; legacy `ServerPaginationBar` still ships forest greens. | design-v2 footer; Returns / `ServerPaginationBar`. |

---

## 7. Consistency

| ID | Problem | Evidence |
|----|---------|----------|
| **Shell** | Two application shells for one brand. | Admin `@ds` AppShell family vs Client `PortalLayout`. |
| **Headers** | Multiple near-clone page headers. | Admin `PageHeader`, `@ds` `AppPageHeader`, Client `ListPageHeader`, hand-rolled Billing/Dashboard headers, Notifications `ClientPageIntro`. |
| **Buttons** | Multiple primary CTA systems. | Local Admin `Button` (`primary` emerald-600 + `brand` `#10B981` / `!rounded-xl`); `@ds` `Button` token brand; Client ad-hoc emerald buttons with glow; Products CTA without glow. |
| **Badges** | Status is not one system. | `StatusBadge` / `statusMeta` bypassed on Products, Billing plans (legacy `.badge-*`), dashboard recent rows (raw status strings), Client hand-rolled inventory pills. |
| **Sub-nav** | At least three sub-nav languages. | Admin `SectionSubNavCard` / `PillSubNav` (emerald); Client `PillTabs` / `StorePillTabs` (gray track); Notifications filter chips (`rounded-full` + solid brand). |
| **Lists** | Admin FilterPanel+DataTable vs Client hand tables + Card + TableFooterPagination — same domain, different product grammar. | Inbound/Outbound both portals. |
| **Notifications** | Client Notifications uses a different design vocabulary entirely (`brand-*` CSS vars, `@ds` EmptyState/Button, custom pagination). | `NotificationsPage` vs design-v2 list pages. |
| **Skip nav** | Admin has `AppShell.SkipNav`; Client has none. | `PortalLayout`. |
| **Working tree risk** | Staging working tree currently deletes core Layout/DS files while dist may still serve older builds — design SoT is unstable for review. | `git status` deletions of Layout, `@ds` index/shell, most design-v2. |

---

## 8. Navigation

| ID | Problem | Evidence |
|----|---------|----------|
| **N1** | Admin sidebar mixes jargon with plain labels. | “WMS”, “OMS”, “OMS Orders”, “COD”, “OMS Returns” beside “Inbound” / “Outbound”. |
| **N2** | Active state on Client sidebar is weak (emerald wash + ~1×1px dot). | `PortalLayout` `NavButton`. |
| **N2** | Admin section sub-nav card creates a second “you are here” competing with sidebar active emerald. | `SectionSubNavCard` above Outlet. |
| **N3 / N4** | Collapsible WMS/OMS sections forced open (`defaultOpen={… \|\| true}`), so grouping never reduces choice. | `Layout.tsx` `SidebarNavContent`. |
| **N5** | Competing create entries on Billing Plans; list create CTAs often not the only loud control (Reset rose, Apply green, header secondaries). | `BillingPlansPage`; `FilterPanel` actions. |
| **Identity** | Client shows profile/identity twice (sidebar footer avatar + topbar user chip). | `PortalLayout`. |
| **Label mismatch** | Profile shortcut copy implies “notification preferences” but navigates to the notifications list. | `ProfilePage`. |

---

## 9. Forms

| ID | Problem | Evidence |
|----|---------|----------|
| **F1** | Login uses `sr-only` labels with placeholders as the visible labels. | `LoginScreen`. |
| **F2** | Filter/text fields are almost always full grid-cell width (`w-full h-11`) regardless of date, SKU, or short codes. | Admin `TextField` + `FilterPanelGrid`. |
| **F3 / ER** | Errors often toast- or trailing-paragraph style, not field-adjacent; detail/load failures are bare rose `<p>`. | `InboundDetailPage`; `BillingInvoicesPage` trailing rose error; inconsistent with list `Alert` usage. |
| **F5** | Filter Reset is styled as danger/rose fill — reads as destructive, not “clear constraints.” | `filter-button-styles` / `FILTER_RESET_BUTTON_CLASS`. |
| **F5** | Inbound detail Confirm uses forest primary while Cancel/Delete reuse rose reset styling — primary and destructive both scream. | `InboundDetailPage` + `LegacyButton` forest hex. |
| **FL1** | Client inbound/outbound expose a dead “Filters” button beside a live status `<select>`. | Order list pages. |
| **FL2** | Admin draft/apply filters lack applied chips, result count in filter header, or clear “filters active” affordance beyond table footer text. | `FilterPanel` consumers. |
| **FL1** | Sort-by / sort-direction live as peer fields inside the invoice filter card — sort ≠ filter. | `BillingInvoicesPage`. |
| **Controls** | Client lists rely on native inputs/selects while Admin uses labeled TextField patterns — form grammar split. | Client order lists. |
| **Disclosure a11y** | Filter overflow toggled via `<a href="#" role="button">` “Show more”. | `FilterPanelGrid`. |

---

## 10. Information density

| ID | Problem | Evidence |
|----|---------|----------|
| **DD1** | Decorative checkboxes and dead ellipses add chrome without capability — density without utility. | Client inbound/outbound tables. |
| **DD1** | Client dashboard status strip packs six cells (counts + percentages) in one divided row — cramped, competing. | `DashboardPage` status strip. |
| **DD1** | Activity feed stacks kind chip + Badge + title + body + date per row. | Client dashboard activity. |
| **Billing** | Feature lists as emerald check-pill clouds; limits rows with empty % for “Unlimited”. | `BillingPage`. |
| **Products** | Stock bar uses `stock/10 * 100` — arbitrary scale that reads as real capacity. | Client `ProductsPage`. |
| **Opposite problem** | Sparse filter band: Products search alone wrapped in a full Card. | Client `ProductsPage`. |
| **Copy lie** | “Orders needing attention” labels latest-by-list, not attention-sorted work. | Client `DashboardPage`. |

---

## 11. Dashboards

| ID | Problem | Evidence |
|----|---------|----------|
| **D1** | Admin overview answers catalog size before “what needs attention.” | `DashboardOverviewPage`. |
| **D2** | Storage utilization gauge links to `/billing/plans` — wrong destination for capacity mental model. | `OrderProgressGaugeCard` → billing plans. |
| **D2** | Expiry alerts wrap an entire table in one `<Link>` — nested interactive surface, awkward scan. | Admin dashboard expiry block. |
| **D2 / D3** | Billing dashboard: seven KPI tiles in `xl:grid-cols-4` (ragged last row); “Monthly revenue” and “Revenue trend” duplicate the same series (one reversed). | `BillingDashboardPage`. |
| **D3** | Charts lack restrained brand context: bars `bg-teal-700`; pie uses raw hex rainbow `CHART_COLORS`. | `BillingDashboardPage`. |
| **E1** | Recent activity maps open orders without empty-state branch (copy exists unused); status as raw underscore strings. | Admin dashboard recent lists. |
| **Client** | Chart card header crowded with month preset + two dates + channel. | `DashboardPage` “Order summary”. |
| **Loading** | Client dashboard loading = em dashes; Notifications has skeletons — internal inconsistency. | `DashboardPage` vs `NotificationsPage`. |

---

## 12. Color usage

| ID | Problem | Evidence |
|----|---------|----------|
| **CO1** | Multiple “primary greens” coexist. | Tokens `#059669` / `#10b981`; Tailwind `emerald-*`; forest `#1a7a44` / `#187440` / `#146135` / `#156635`; billing `teal-700`; login `#187440`. |
| **CO1** | Legacy CSS still paints forest for `.sidebar__link--active` and `.btn--primary`. | `shared/design-system/globals.css`. |
| **CO2** | Status/semantic color bypassed for ad-hoc pills and legacy badge classes. | Products, BillingLabel `.badge-*`, dashboard raw statuses. |
| **Client KPIs** | Sky / amber / violet wells for primary metrics — multi-hue dashboard kit without a scarce accent map. | `DashboardPage`, Billing StatCards. |
| **Tokens** | Token file duplicates surface/text definitions; `--surface-app-bg` and `--surface-page` both `#F9FAFB`; comments forbid raw hex while app code inlines hex. | `tokens.css` + page components. |
| **Login** | Hero gradient and submit remain forest-era (`#072019`→`#1a7a44`, submit `#187440`). | `LoginScreen`. |

---

## 13. Buttons

| ID | Problem | Evidence |
|----|---------|----------|
| **Gate** | Primary button look is not singular across Admin alone. | Local `Button` `primary` vs `brand` vs `@ds` `Button` token brand; Outbound mixes DS + filter hex classes. |
| **F5** | Reset styled as danger; Apply as raw emerald hex — two loud peers in filter footers. | `FilterPanel`. |
| **Client** | Create CTAs glow on order lists but not on Products — same job, different weight. | Inbound/Outbound vs `ProductsPage`. |
| **Decorative** | Login shows a non-functional bolt control (`tabIndex={-1}`, `aria-hidden`) and fake carousel dots that look interactive. | `LoginScreen`. |
| **Icon buttons** | Client `IconButton` does not require `aria-label`; Admin DS `IconButton` does — accessibility/chrome gap. | `design-v2/IconButton`. |
| **Pagination** | Forest-filled “Next” on `ServerPaginationBar` vs neutral slate Prev/Next on DataTable footers. | Returns vs modern lists. |

---

## 14. Icons

| ID | Problem | Evidence |
|----|---------|----------|
| **Brand** | Client brand mark is a generic FA warehouse tile + wordmark — weak product lockup at chrome level. | `PortalLayout` sidebar brand. |
| **Pattern** | Circular colored icon wells are the default KPI pattern (decorative, multi-hue). | Client dashboard / Billing. |
| **Filter** | Decorative emerald circle icon beside every Admin filter title — ornament without information. | `FilterPanel`. |
| **Header** | Emerald icon tiles on page headers repeat as a habit, not as meaning. | `PageHeader` / `ListPageHeader` / `AppPageHeader`. |
| **FA dependency** | Font Awesome strings as primary icon identity across Client chrome and actions — not a disciplined icon system. | `PortalLayout`, list action menus. |

---

## 15. Visual rhythm

| ID | Problem | Evidence |
|----|---------|----------|
| **Motion** | Near-universal `animate-enter` on pages creates sameness rather than intentional entrance hierarchy. | Admin + Client migrated pages. |
| **Elevation** | Soft-card + shadow-soft + hover-lift + emerald glow CTAs stack into a busy surface language. | Client lists/dashboard; Admin filter/table cards. |
| **Thead tint** | Emerald-tinted headers (`bg-emerald-50/80 text-emerald-800`) on Admin local tables vs slate on some Client tables — oscillating “table identity.” | Local `DataTable` vs Client theads. |
| **Login vs app** | Auth screen is a different visual era (forest gradient, decorative chrome) from the emerald glass app shell. | `LoginScreen` vs AppShell/PortalLayout. |
| **Section rhythm** | Uppercase 10px labels + soft cards + pill sub-nav + filter card + table card = predictable but heavy ladder on every Admin warehouse route. | Layout + list recipe. |

---

## Checklist gate failures (summary)

Mapped to `UX_CHECKLIST.md` — items that **fail** at enterprise bar on audited surfaces:

| Area | Failing checks |
|------|----------------|
| Navigation | N1, N2 (weak/dual), N4 (always-open), N5 |
| Forms | F1 (login), F2, F5 (reset/destructive weight), partial F3 |
| Tables | T2 (decorative actions), T3, T4 |
| Search | S1 (Admin topbar lacks search), S3 (Client “search” is route jump mislabeled as entity search; ⌘K Mac-only affordance) |
| Filters | FL1 (dead Filters control; sort-in-filter), FL2 |
| Dashboard | D1, D2, D3 |
| Cards | C1, C2 |
| Hierarchy | H1, H2 |
| Spacing | SP1, SP3 |
| Typography | TY1, TY2, TY3 |
| Color | CO1, CO2 |
| Empty/loading | E1, E2 (weak CTAs / no first-run distinction) |
| Consistency | Cross-portal shell, header, button, badge, sub-nav, list recipe |

---

## Severity ranking (problems only)

1. **Two portals, two shells, multiple primitives for the same jobs** — product cohesion failure.  
2. **Multi-header list stacks + missing page primary on key Admin lists** — wayfinding and H1 failure.  
3. **Forest / emerald / teal / rainbow KPI color split** — brand and semantic color failure.  
4. **Decorative interactive chrome** (checkboxes, ellipsis, Filters button, login bolt) — trust failure.  
5. **Dashboards not action-first; wrong or vanity-led hierarchy** — operational failure.  
6. **Filters without applied-state; Reset as danger** — constraint awareness failure.  
7. **Tables without sticky headers, weak empty/loading, pagination brand split** — data-UI failure.  
8. **Search absent (Admin) or mis-scoped (Client quick-jump as search)** — findability failure.

---

*End of audit. No implementation recommendations included by request.*
