# Master UI Audit

**Merged from:**  
`PRODUCT_DESIGN_AUDIT.md` · `UX_AUDIT.md` · `WAREHOUSE_AUDIT.md` · `CLIENT_PORTAL_AUDIT.md` · `QA_UI_AUDIT.md` · `FRONTEND_ARCHITECTURE_AUDIT.md` · `DESIGN_SYSTEM_REPORT.md`

**Scope:** Staging Admin + Client Portal UI  
**Baseline:** Committed `HEAD` (+ live staging QA where noted)  
**Duplicates removed:** Overlapping findings collapsed into one issue with combined sources  

---

## How to read this document

| Priority | Meaning |
|----------|---------|
| **Critical** | Blocks trust, floor speed, merchant morning decisions, or a buildable UI SoT — fix first |
| **High** | Major friction or inconsistency every session; fix in next UI milestone |
| **Medium** | Clear debt; hurts polish, a11y, or maintainability |
| **Low** | Localized / intermittent; schedule when capacity allows |
| **Nice to Have** | Quality uplift once Critical–Medium are stable |

Each issue includes: **Problem · Reason · Affected Pages · Impact · Recommendation · Priority**

---

## Summary counts

| Priority | Count |
|----------|------:|
| Critical | 14 |
| High | 18 |
| Medium | 16 |
| Low | 10 |
| Nice to Have | 6 |
| **Total (deduped)** | **64** |

---

# Critical

### C-01 — Working tree missing core shell & design-system files
- **Problem:** Staging working tree has uncommitted deletions of `@ds` barrel/tokens/shell, Admin `Layout`, Client `PortalLayout`, and core `design-v2` primitives. Disk ≠ HEAD.
- **Reason:** Further UI work on a broken tree will create false baselines and unbuildable apps.
- **Affected Pages:** All Admin + Client routes (source integrity).
- **Impact:** Cannot safely implement or verify UI fixes from disk; architecture SoT is unstable.
- **Recommendation:** Restore deleted UI/DS files from `HEAD` (or known-good commit) before any migration work; treat restore as release gate.
- **Priority:** Critical  
- **Sources:** DESIGN_SYSTEM_REPORT, FRONTEND_ARCHITECTURE_AUDIT

### C-02 — Three parallel UI stacks (`@ds` / Admin local / design-v2)
- **Problem:** Product UI is implemented three ways: path-aliased `@ds`, Admin local components (`Button`, `DataTable`, `FilterPanel`, `PageHeader`), and Client `design-v2`.
- **Reason:** Incomplete design-system migration; Client visual SoT never promoted; Admin never retired clones.
- **Affected Pages:** All list/detail/chrome surfaces in Admin and Client.
- **Impact:** Visual drift, duplicate bugs, every new page picks a different recipe.
- **Recommendation:** Choose one ownership model: promote Client list primitives into `@ds`, retire Admin locals, make both shells consume `@ds` only.
- **Priority:** Critical  
- **Sources:** FRONTEND_ARCHITECTURE_AUDIT, DESIGN_SYSTEM_REPORT, PRODUCT_DESIGN_AUDIT

### C-03 — Client depends on Admin via `@wms` across React 18/19
- **Problem:** Client aliases `@wms/components` and `@wms/hooks` into Admin `frontend/src` while running React 19 / Vite 8 / Router 7 vs Admin React 18 / Vite 6 / Router 6.
- **Reason:** Shared form/status/pagination needs were bridged by reaching into the other app instead of `@ds`.
- **Affected Pages:** Client create modals, StatusBadge consumers, paginated lists (orders, products, invoices, COD, returns).
- **Impact:** Fragile builds, duplicate React risk, inverted dependency (portal → internal app).
- **Recommendation:** Move shared fields/hooks/status into `@ds` (or a real shared package); remove `@wms` aliases; align React majors.
- **Priority:** Critical  
- **Sources:** FRONTEND_ARCHITECTURE_AUDIT

### C-04 — Confirm order does not open floor work
- **Problem:** After Confirm / Confirm & start workflow, user stays on the order page with only toast + timeline discovery.
- **Reason:** Orders hub and Tasks hub are split; no primary handoff CTA.
- **Affected Pages:** Admin Inbound detail, Outbound detail; cascades to Receiving, Putaway, Pick, Pack, Dispatch.
- **Impact:** First-time and daily users lose 1–3+ clicks every order; Confirm feels like a dead end.
- **Recommendation:** After Confirm, navigate to (or prominently CTA) the next runnable task, preferably Start-ready.
- **Priority:** Critical  
- **Sources:** UX_AUDIT, WAREHOUSE_AUDIT

### C-05 — Assign → Start tax on every warehouse stage
- **Problem:** Execution UI only mounts when `in_progress`; every stage requires worker combobox → Assign → Start.
- **Reason:** Task lifecycle is modeled as separate jobs, not a continuous order flow.
- **Affected Pages:** Task detail/execution for receiving, QC, putaway, pick, pack, dispatch; Tasks list.
- **Impact:** ~3–4 clicks × stages (inbound ~8 gate clicks; outbound pick→pack→dispatch ~12) before line work.
- **Recommendation:** One-click Start when worker is self/already assigned; auto-continue next task on same order without re-assign ritual.
- **Priority:** Critical  
- **Sources:** WAREHOUSE_AUDIT, UX_AUDIT

### C-06 — Floor barcode is camera-modal, not gun-driven
- **Problem:** Scan opens a camera UI; typed filters need Apply; receive/pick/putaway lack scan-to-advance / Enter-to-next-line / bulk receive / suggested bin.
- **Reason:** Execution panels optimized for mouse/camera, not wedge scanners.
- **Affected Pages:** Receiving/Putaway/Pick/Pack/Dispatch panels; inventory/adjustments/transfers/cycle-count scan paths.
- **Impact:** Operators leave gun flow; seconds lost per line; high fatigue.
- **Recommendation:** Always-focused wedge field; scan commits action (receive +1, set dest, add to pack); Enter advances line; suggested-bin one-tap.
- **Priority:** Critical  
- **Sources:** WAREHOUSE_AUDIT

### C-07 — Client dead interactive chrome (Filters / … / checkboxes)
- **Problem:** Live UI: Filters button does nothing; row ellipsis opens no menu; checkboxes check with no bulk actions.
- **Reason:** Decorative enterprise table patterns shipped without behavior.
- **Affected Pages:** Client Inbound orders, Outbound orders (same pattern).
- **Impact:** Broken trust; wasted clicks; looks like a defective product.
- **Recommendation:** Wire real filter drawer/actions, or remove Filters/checkboxes/ellipsis until real.
- **Priority:** Critical  
- **Sources:** QA_UI_AUDIT, CLIENT_PORTAL_AUDIT, PRODUCT_DESIGN_AUDIT

### C-08 — Client product detail URL redirects to list
- **Problem:** `/products/:id` navigates to `/products`; dashboard inventory row drill-down dies.
- **Reason:** Route redirects detail to list; Available/Reserved context cannot open.
- **Affected Pages:** Client Products, Dashboard live inventory, any product deep link.
- **Impact:** Merchant cannot answer “where is this SKU?” in one hop.
- **Recommendation:** Implement product detail route (or modal) and remove redirect; preserve Available/Reserved.
- **Priority:** Critical  
- **Sources:** CLIENT_PORTAL_AUDIT, QA_UI_AUDIT

### C-09 — Blank “Loading…” with no skeletons
- **Problem:** Under latency, pages show full-viewport “Loading…”; skeleton/`animate-pulse` count = 0; chrome disappears.
- **Reason:** Route-level suspense/fallback replaces shell instead of region skeletons.
- **Affected Pages:** Admin lists (e.g. Inbound), Client Dashboard; likely other routed views.
- **Impact:** Layout jump, lost context, feels broken on slow networks.
- **Recommendation:** Keep shell; skeleton table/KPI regions; use `@ds` Skeleton consistently.
- **Priority:** Critical  
- **Sources:** QA_UI_AUDIT, PRODUCT_DESIGN_AUDIT, FRONTEND_ARCHITECTURE_AUDIT

### C-10 — Client morning dashboard doesn’t answer orders/stock/money
- **Problem:** Leads with Total products/orders/completed; status/money KPIs not click-through; “Orders needing attention” is latest-by-period; “Returned” mixes cancels/failures; COD below fold and mislabeled.
- **Reason:** Dashboard built as marketing/metrics collage, not exception triage.
- **Affected Pages:** Client Dashboard; downstream Online orders, Products, My profits/COD.
- **Impact:** Merchants cannot decide in 10 seconds; false chases.
- **Recommendation:** Above-the-fold: stuck orders, sellable stock, COD ready/pending — each number links to filtered list; fix Returned and attention semantics.
- **Priority:** Critical  
- **Sources:** CLIENT_PORTAL_AUDIT, PRODUCT_DESIGN_AUDIT

### C-11 — Opaque Tasks list identity + broken search promise
- **Problem:** Task type shown raw (`receiving`); Reference is truncated UUID; search claims order/task/worker id but only sends `referenceId` (task UUID paste fails).
- **Reason:** List optimized for system IDs, not floor recognition.
- **Affected Pages:** Admin Tasks list and type sub-navs (Receive/Putaway/Pick/Pack/Delivery).
- **Impact:** Operators cannot find “my” order work; wasted Apply cycles.
- **Recommendation:** Show human order #; label task types; search by order number and task id; “my next runnable” queue.
- **Priority:** Critical  
- **Sources:** UX_AUDIT, WAREHOUSE_AUDIT

### C-12 — Naming collisions that break navigation (Delivery/Dispatch, Returns×2, Customers/Clients)
- **Problem:** Same concepts rename across nav: Delivery vs Dispatch; Returns vs OMS Returns; Customers vs Clients vs Company vs Customer; Receive vs Receiving; My profits vs COD.
- **Reason:** Domain jargon and parallel modules without glossary or unified labels.
- **Affected Pages:** Admin Tasks sub-nav, OMS nav, Clients, Billing; Client Store nav (My profits).
- **Impact:** Wrong destination, wrong mental model, slow first sessions.
- **Recommendation:** One user-facing label per concept everywhere (nav, timeline, CTA, toast); disambiguate the two Returns with plain language.
- **Priority:** Critical  
- **Sources:** UX_AUDIT, CLIENT_PORTAL_AUDIT, PRODUCT_DESIGN_AUDIT

### C-13 — RTL Arabic still mixed with English chrome
- **Problem:** With AR/`dir=rtl`, layout flips but Admin nav keeps English Contracts/Billing/OMS; Client status filters leave English leftovers; dates stay English.
- **Reason:** Incomplete i18n catalogs; language toggle buried in user menu.
- **Affected Pages:** Admin shell + dashboard; Client outbound/lists in AR.
- **Impact:** Half-localized product; Arabic users distrust completeness.
- **Recommendation:** Complete nav/status/date localization; make language control discoverable; fail CI on missing keys for nav.
- **Priority:** Critical  
- **Sources:** QA_UI_AUDIT, PRODUCT_DESIGN_AUDIT

### C-14 — Account lifecycle vs billing plan suspend confusion
- **Problem:** Clients “Manage account status” (lifecycle) and Billing plan suspend/resume are two freeze models with overlapping language.
- **Reason:** Separate domains surfaced with similar “stop this client” verbs.
- **Affected Pages:** Admin Clients, CustomerLifecycleModal, Billing Plans, plan detail.
- **Impact:** Wrong freeze action; billing vs access mistakes.
- **Recommendation:** Distinct copy and UI: Account access vs Subscription; cross-link with explicit consequences.
- **Priority:** Critical  
- **Sources:** UX_AUDIT, PRODUCT_DESIGN_AUDIT

---

# High

### H-01 — Parallel application shells (AppShell vs PortalLayout)
- **Problem:** Admin uses `@ds` AppShell; Client hand-rolls slate-950 sidebar + glass topbar.
- **Reason:** Shell never unified after Client SoT decision.
- **Affected Pages:** Every authenticated page in both portals.
- **Impact:** Brand/chrome drift; duplicate a11y (Client missing skip-link).
- **Recommendation:** Client PortalLayout → `@ds` AppShell/Sidebar/Topbar with portal theme slots.
- **Priority:** High  
- **Sources:** FRONTEND_ARCHITECTURE_AUDIT, PRODUCT_DESIGN_AUDIT, DESIGN_SYSTEM_REPORT

### H-02 — Triple/quad Button, header, status, table/pagination
- **Problem:** Multiple implementations of Button, page headers, status pills, tables/pagers; `@ds` DataTable/Card/Badge/Input largely unused.
- **Reason:** Shelfware DS + surviving Admin library + design-v2.
- **Affected Pages:** All Admin/Client lists, details, modals.
- **Impact:** Inconsistent CTAs/status; high maintenance cost.
- **Recommendation:** Deprecate Admin local Button/DataTable/PageHeader/StatusBadge in favor of one `@ds` API; migrate Client design-v2 into `@ds`.
- **Priority:** High  
- **Sources:** FRONTEND_ARCHITECTURE_AUDIT, DESIGN_SYSTEM_REPORT, PRODUCT_DESIGN_AUDIT

### H-03 — Forest green leftovers beside emerald tokens
- **Problem:** `#1a7a44` / `#146135` / teal charts still on LoginScreen, ServerPaginationBar, globals `.btn--primary`/sidebar active, some detail CTAs.
- **Reason:** Incomplete brand migration.
- **Affected Pages:** Admin login, Returns pagination, legacy CSS consumers, billing charts, inbound detail legacy buttons.
- **Impact:** Split brand identity; QA sees “two products.”
- **Recommendation:** Purge forest hexes; one brand token; delete legacy CSS classes.
- **Priority:** High  
- **Sources:** PRODUCT_DESIGN_AUDIT, FRONTEND_ARCHITECTURE_AUDIT, DESIGN_SYSTEM_REPORT

### H-04 — Multi-header list stacks / missing page primary
- **Problem:** Section sub-nav + filter title + table title (± page header); some lists bury create CTA in table actions; no single H1 focal point.
- **Reason:** Card-on-card list recipe without hierarchy rules.
- **Affected Pages:** Admin Inbound, Outbound, Products, Billing Plans/Invoices; Client list cards.
- **Impact:** Unclear “what page is this / what do I click.”
- **Recommendation:** One page title + one primary CTA; flatten filter to strip; single table surface.
- **Priority:** High  
- **Sources:** PRODUCT_DESIGN_AUDIT, UX_AUDIT

### H-05 — Packing finalize + Delivery restart maze
- **Problem:** Pack work in modal; Finalize then Complete packing; then Delivery Assign→Start; scan doesn’t commit; Delivery≠Dispatch naming.
- **Reason:** Package model + task gates without gun path.
- **Affected Pages:** PackExecutionPanel, PackageDetailsModal, DispatchExecutionPanel, Tasks Delivery tab.
- **Impact:** High click tax after pick; shipping delays.
- **Recommendation:** Scan-to-add; single finish for one carton; auto-open next dispatch; unify Delivery/Dispatch label.
- **Priority:** High  
- **Sources:** WAREHOUSE_AUDIT, UX_AUDIT

### H-06 — Putaway / pick missing floor shortcuts
- **Problem:** No suggested bin; dest search every line; pick requires typing qty; drop-off mandatory ritual; Next bin display-only.
- **Reason:** Execution UX incomplete for warehouse speed.
- **Affected Pages:** PutawayExecutionPanel, PickExecutionPanel, Outbound create (Packing checkbox unexplained).
- **Impact:** Slow putaway/pick; failed completes after qty done.
- **Recommendation:** Suggested bin; pick-required one-shot; scan confirms Next bin; explain Packing checkbox.
- **Priority:** High  
- **Sources:** WAREHOUSE_AUDIT, UX_AUDIT

### H-07 — Filter Apply tax + filter-blame empties + rose Reset
- **Problem:** Draft filters need Apply; empties say “no matches”; Reset styled as danger/rose; no applied chips.
- **Reason:** Enterprise filter pattern without applied-state UX.
- **Affected Pages:** Most Admin lists; Tasks; Inventory; Client lists with Apply-like friction; FilterPanel consumers.
- **Impact:** False “no data”; accidental “destructive” Reset perception.
- **Recommendation:** Enter applies; chips for active filters; quiet Reset; empty = first-run CTA vs filtered-empty.
- **Priority:** High  
- **Sources:** UX_AUDIT, PRODUCT_DESIGN_AUDIT, WAREHOUSE_AUDIT

### H-08 — Client money split three ways with naming chaos
- **Problem:** Billing (fees) + Invoices + My profits/COD; nav elevates fees; COD named profits/COD/cash differently.
- **Reason:** Subscription and remittance mixed under “money” without hierarchy.
- **Affected Pages:** Client Billing, Invoices, My profits, Dashboard COD cards, nav.
- **Impact:** Merchants open wrong tab for cash vs fees.
- **Recommendation:** One Money section: COD primary, Fees secondary; unify labels to Cash on delivery.
- **Priority:** High  
- **Sources:** CLIENT_PORTAL_AUDIT

### H-09 — Three Client order hubs + OMS jargon
- **Problem:** Online orders + Inbound + Outbound compete; detail still says OMS; filters use warehouse statuses; subtitle claims COD/returns.
- **Reason:** WMS + OMS surfaces exposed equally to merchants.
- **Affected Pages:** Client Online/Ecommerce orders, Inbound, Outbound, Dashboard, Returns detail (outbound link).
- **Impact:** Wrong list for morning “where are my orders?”
- **Recommendation:** Customer orders as primary hub; demote warehouse lists; merchant status language; link returns to online order.
- **Priority:** High  
- **Sources:** CLIENT_PORTAL_AUDIT, UX_AUDIT

### H-10 — Inventory not sellable-at-a-glance on Client
- **Problem:** Nav says Products; list shows totalOnHand + lifecycle Status; Available/Reserved only in modal; no damaged view.
- **Reason:** Catalog UI reused as inventory UI.
- **Affected Pages:** Client Products, Dashboard inventory preview.
- **Impact:** Cannot decide what can still sell.
- **Recommendation:** Inventory list with Available/Reserved/problem stock; rename nav; keep catalog separate if needed.
- **Priority:** High  
- **Sources:** CLIENT_PORTAL_AUDIT

### H-11 — Admin dashboard not action-first
- **Problem:** Vanity catalog/customer KPIs first; storage gauge links to billing plans; expiry table wrapped in one Link; recent activity raw statuses / missing empties.
- **Reason:** Dashboard as report collage.
- **Affected Pages:** Admin DashboardOverviewPage, Billing dashboard widgets.
- **Impact:** Ops managers don’t see “what next.”
- **Recommendation:** Open work / alerts first; click-through to filtered lists; StatusBadge; proper empties.
- **Priority:** High  
- **Sources:** PRODUCT_DESIGN_AUDIT, UX_AUDIT

### H-12 — Internal transfer unfit for rapid bin moves
- **Problem:** Modal marathon per move; scan fills search ≠ select; no bin scan; no transfer task queue; history shows truncated location UUIDs.
- **Reason:** Manager form, not floor tool.
- **Affected Pages:** InternalTransferPage; Tasks (no transfer type).
- **Impact:** Slow corrections; operators use wrong tools.
- **Recommendation:** Scan from→to→qty→Enter loop; consecutive moves without full reset; readable location codes.
- **Priority:** High  
- **Sources:** WAREHOUSE_AUDIT

### H-13 — Cycle count slow path
- **Problem:** Camera→qty→Save button; Confirm on finish→detail; list→detail→execute hop; expected visible on detail before count.
- **Reason:** Execute UX not gun-loop; manager path leaks expected.
- **Affected Pages:** CycleCountList/Detail/Execute/MyTasks.
- **Impact:** Slow counts; compromised blind counts.
- **Recommendation:** Scan→qty→Enter→next; finish in place; optional blind mode.
- **Priority:** High  
- **Sources:** WAREHOUSE_AUDIT

### H-14 — Accessibility: unlabeled controls & Client missing skip-link
- **Problem:** Unnamed icon buttons on Client lists/profile; dashboard dates unlabeled; Admin login sr-only labels; Client no skip-to-content.
- **Reason:** Icon chrome without aria-label; placeholder-as-label patterns.
- **Affected Pages:** Client inbound/outbound/products/profile/dashboard; Admin login.
- **Impact:** Keyboard/AT users blocked; WCAG failures.
- **Recommendation:** Require aria-label on IconButton; visible labels; add Client SkipNav.
- **Priority:** High  
- **Sources:** QA_UI_AUDIT, PRODUCT_DESIGN_AUDIT

### H-15 — Notification badge color mismatch + weak deep links
- **Problem:** Same unread “3” is emerald in sidebar and red on topbar bell; deep links skip ecommerce/returns/COD; Client unread filter page-scoped.
- **Reason:** Dual badge implementations; incomplete href map.
- **Affected Pages:** Client PortalLayout, Notifications, Dashboard activity.
- **Impact:** Conflicting severity; alerts don’t open work.
- **Recommendation:** One badge tone; complete deep links; global unread filter.
- **Priority:** High  
- **Sources:** QA_UI_AUDIT, CLIENT_PORTAL_AUDIT

### H-16 — Global search is page-jump, shows ⌘K
- **Problem:** Placeholder promises orders/products/invoices; results are route jumps; ⌘K shown on Linux staging.
- **Reason:** Quick-nav disguised as search.
- **Affected Pages:** Client (and Admin if search present) topbar.
- **Impact:** False expectations; OS shortcut mismatch.
- **Recommendation:** Label “Quick jump” or implement entity search; show Ctrl/⌘ by platform.
- **Priority:** High  
- **Sources:** CLIENT_PORTAL_AUDIT, PRODUCT_DESIGN_AUDIT, QA_UI_AUDIT

### H-17 — Disabled Next without validation message (Admin inbound create)
- **Problem:** New inbound wizard Next disabled with no field errors/helper.
- **Reason:** Validation via disabled CTA only.
- **Affected Pages:** Admin Inbound create modal.
- **Impact:** Looks broken; users don’t know what’s missing.
- **Recommendation:** Enable Next with inline errors, or show “Required: …” near disabled state.
- **Priority:** High  
- **Sources:** QA_UI_AUDIT

### H-18 — No role-based onboarding
- **Problem:** Login “Welcome back”; operators land in Tasks with no story; empties blame filters.
- **Reason:** No first-run or role primer.
- **Affected Pages:** Login, Inbound/Tasks/Returns/OMS/Products empties, operator home.
- **Impact:** Long time-to-first-success.
- **Recommendation:** Role home cards; first-run empty CTAs; short “how work appears” for operators.
- **Priority:** High  
- **Sources:** UX_AUDIT

---

# Medium

### M-01 — `@ds` not a real package
- **Problem:** Design system is a Vite path alias without package.json/semver/contract tests.
- **Reason:** Extraction stopped at folder share.
- **Affected Pages:** All `@ds` imports.
- **Impact:** No versioning; easy breakage across apps.
- **Recommendation:** Publish internal `@emdad/ds` package with build + consumer tests.
- **Priority:** Medium  
- **Sources:** FRONTEND_ARCHITECTURE_AUDIT

### M-02 — CSS utility triplication + dead scaffold CSS
- **Problem:** `.glass`/`.input-premium`/`.hover-lift` duplicated in Admin + Client CSS; Client `style.css` scaffold orphan; legacy badge/btn CSS remains.
- **Reason:** Globals + local overrides never consolidated.
- **Affected Pages:** Global chrome/forms both apps.
- **Impact:** Drift and dead code.
- **Recommendation:** Single globals SoT; delete scaffold/legacy CSS.
- **Priority:** Medium  
- **Sources:** FRONTEND_ARCHITECTURE_AUDIT, DESIGN_SYSTEM_REPORT

### M-03 — Card-on-card over-elevation
- **Problem:** Sub-nav card + filter card + table card; elevation not reserved for interactivity.
- **Reason:** Soft-card default for every grouping.
- **Affected Pages:** Admin warehouse lists; Client lists; Profile card-in-card.
- **Impact:** Visual noise; weak hierarchy.
- **Recommendation:** Flat filter strip + one data surface; elevation only for interactive priority.
- **Priority:** Medium  
- **Sources:** PRODUCT_DESIGN_AUDIT

### M-04 — ALL-CAPS / 10px type / Inter-only Client brand type
- **Problem:** Micro uppercase labels everywhere; 10px pills; Client forces Inter.
- **Reason:** Decorative meta type overused; no type system discipline.
- **Affected Pages:** Dashboards, sidebars, tables, Products badges.
- **Impact:** Harder scan; weak brand.
- **Recommendation:** Sentence case; ≥12px ops chrome; limited type scale.
- **Priority:** Medium  
- **Sources:** PRODUCT_DESIGN_AUDIT

### M-05 — Sub-nav languages (3+)
- **Problem:** SectionSubNavCard, PillSubNav, PillTabs/StorePillTabs, notification chips — different active styles.
- **Reason:** Parallel nav components per app/feature.
- **Affected Pages:** Admin section routes; Client store tabs; Notifications.
- **Impact:** Inconsistent “you are here.”
- **Recommendation:** One sub-nav primitive in `@ds`.
- **Priority:** Medium  
- **Sources:** PRODUCT_DESIGN_AUDIT, FRONTEND_ARCHITECTURE_AUDIT

### M-06 — Forms: TextField vs DS Input vs raw inputs
- **Problem:** Three form control systems; full-width fields regardless of data length.
- **Reason:** Incomplete form primitive adoption.
- **Affected Pages:** Admin filters/forms; Client lists/modals.
- **Impact:** Inconsistent a11y and density.
- **Recommendation:** Standardize on `@ds` Field/Input/Select; width by content.
- **Priority:** Medium  
- **Sources:** FRONTEND_ARCHITECTURE_AUDIT, PRODUCT_DESIGN_AUDIT

### M-07 — i18n fragmentation
- **Problem:** Per-page dictionaries; `wms-ui-language` vs `client-ui-language`; mixed hardcoded English.
- **Reason:** No shared catalog.
- **Affected Pages:** Both portals, especially dashboards and status filters.
- **Impact:** Incomplete AR; inconsistent EN.
- **Recommendation:** Shared message catalog; one language key; ban hardcoded chrome strings.
- **Priority:** Medium  
- **Sources:** FRONTEND_ARCHITECTURE_AUDIT, PRODUCT_DESIGN_AUDIT, QA_UI_AUDIT

### M-08 — Returns triage weak (WMS + Client)
- **Problem:** Flat lists; sparse detail; auto-start receiving surprise; disposition jargon; Client no status filter/summary.
- **Reason:** Process UI not exception queue.
- **Affected Pages:** Admin Returns list/detail/process; Client Returns; OMS Returns.
- **Impact:** Slow returns handling; wrong module chosen.
- **Recommendation:** Open/stuck summary; plain dispositions; clear WMS vs OMS Returns; link to customer order.
- **Priority:** Medium  
- **Sources:** UX_AUDIT, CLIENT_PORTAL_AUDIT

### M-09 — Invoices lack unpaid/overdue headline
- **Problem:** Flat invoice table; no totals for due/overdue above fold.
- **Reason:** List without decision KPIs.
- **Affected Pages:** Client Invoices; related Admin billing invoices.
- **Impact:** Slow “do I owe money?”
- **Recommendation:** Unpaid/overdue summary chips linking to filtered rows.
- **Priority:** Medium  
- **Sources:** CLIENT_PORTAL_AUDIT

### M-10 — Focus rings inconsistent; ⌘K Mac chrome
- **Problem:** Many controls `outline: none` with uneven box-shadow rings; Mac shortcut affordance.
- **Reason:** Tailwind focus utilities unevenly applied.
- **Affected Pages:** Client shell/lists; both topbars.
- **Impact:** Keyboard users lose place.
- **Recommendation:** Tokenized focus ring on all interactives; platform-aware shortcut hint.
- **Priority:** Medium  
- **Sources:** QA_UI_AUDIT

### M-11 — Content width / ultrawide sparsity
- **Problem:** Admin often unbounded; Client Profile `max-w-3xl` vs lists `max-w-7xl`.
- **Reason:** PageContainer underused; inconsistent layouts.
- **Affected Pages:** Admin lists/forms; Client Profile vs Billing.
- **Impact:** Sparse scanning on wide monitors.
- **Recommendation:** Shared max-width recipes per page type.
- **Priority:** Medium  
- **Sources:** PRODUCT_DESIGN_AUDIT

### M-12 — Dual vendor task-execution + feature flags complexity
- **Problem:** packages + frontend/vendor copies; VITE_TASK_ONLY and UI compile flags fork surfaces.
- **Reason:** Incremental extraction without cleanup.
- **Affected Pages:** Task execution; OMS COD/Returns gated UI; backups GDrive.
- **Impact:** Hard to reason which UI is live.
- **Recommendation:** Single package; document flags; remove dead gated pages or enable consistently.
- **Priority:** Medium  
- **Sources:** FRONTEND_ARCHITECTURE_AUDIT

### M-13 — QC gate / quarantine putaway discoverability
- **Problem:** After receive, next is often QC; quarantine putaway only in type dropdown; blocked banners point to timeline weakly.
- **Reason:** Workflow complexity without guided recovery.
- **Affected Pages:** Receiving complete next-steps, Putaway tasks, inbound timeline.
- **Impact:** “Where do I put it?” confusion.
- **Recommendation:** Explicit pipeline copy; quarantine in sub-nav; deep-link from blocked banner.
- **Priority:** Medium  
- **Sources:** UX_AUDIT, WAREHOUSE_AUDIT

### M-14 — Quick outbound vs normal outbound dual model
- **Problem:** Quick outbound bypasses pick/pack mental model without clear when-to-use.
- **Reason:** Shortcut path without education.
- **Affected Pages:** QuickDirectedOutbound, Outbound list sub-nav.
- **Impact:** Wrong path chosen; stock/timing surprises.
- **Recommendation:** Plain comparison in UI (“Use when…”).
- **Priority:** Medium  
- **Sources:** UX_AUDIT

### M-15 — Mobile dashboard donut / Renew affordance inconsistency
- **Problem:** Client mobile Order movement donut dominates; Admin Renew buttons inconsistent urgency styling.
- **Reason:** Desktop layouts not tuned for small screens.
- **Affected Pages:** Client Dashboard mobile; Admin Overview billing cards mobile.
- **Impact:** Hard scan on phone.
- **Recommendation:** Compact mobile chart; consistent Renew hierarchy.
- **Priority:** Medium  
- **Sources:** QA_UI_AUDIT

### M-16 — Manager demo login fails on staging (permission QA blocked)
- **Problem:** `manager@emdad.example` cannot enter staging UI in QA pass.
- **Reason:** Seed/credentials/environment mismatch.
- **Affected Pages:** Permission-sensitive Admin routes (cannot verify).
- **Impact:** Incomplete RBAC UI validation.
- **Recommendation:** Fix staging demo roles; add permission smoke suite.
- **Priority:** Medium  
- **Sources:** QA_UI_AUDIT

---

# Low

### L-01 — Dead Client components (`ClientSurfaceCard`, `ClientSectionHeader`, `ClientMetricCard`)
- **Problem:** Unused or near-unused alternate primitives.
- **Reason:** Abandoned experiments.
- **Affected Pages:** None (dead code).
- **Impact:** Confusion for contributors.
- **Recommendation:** Delete or wire deliberately.
- **Priority:** Low  
- **Sources:** FRONTEND_ARCHITECTURE_AUDIT

### L-02 — Profile social hero vs ops portal
- **Problem:** Dark banner + overlapping photo on Profile fights ops language.
- **Reason:** Consumer-profile pattern.
- **Affected Pages:** Client Profile.
- **Impact:** Visual inconsistency.
- **Recommendation:** Align to sober settings layout.
- **Priority:** Low  
- **Sources:** PRODUCT_DESIGN_AUDIT

### L-03 — Client Billing sprawl
- **Problem:** Long stack of plan/usage/charts/chips without single-task focus.
- **Reason:** Dashboard-of-cards pattern.
- **Affected Pages:** Client Billing.
- **Impact:** Slow fee understanding (secondary to COD).
- **Recommendation:** One job per section; collapse advanced charts.
- **Priority:** Low  
- **Sources:** PRODUCT_DESIGN_AUDIT, CLIENT_PORTAL_AUDIT

### L-04 — Language control buried in user menu
- **Problem:** EN/AR only via user menu Language control.
- **Reason:** Chrome prioritization.
- **Affected Pages:** Admin (and Client when present) shell.
- **Impact:** RTL hard to discover.
- **Recommendation:** Visible language toggle in topbar.
- **Priority:** Low  
- **Sources:** QA_UI_AUDIT

### L-05 — Dual profile identity on Client
- **Problem:** Sidebar footer avatar + topbar user chip both present.
- **Reason:** Chrome copy from reference without consolidation.
- **Affected Pages:** Client PortalLayout.
- **Impact:** Minor clutter.
- **Recommendation:** One identity anchor.
- **Priority:** Low  
- **Sources:** PRODUCT_DESIGN_AUDIT, QA_UI_AUDIT

### L-06 — Console 400/401 without always-visible recovery
- **Problem:** Network errors in console during browsing without matching in-page recovery everywhere.
- **Reason:** Partial error UI coverage.
- **Affected Pages:** Various Admin/Client API calls.
- **Impact:** Silent partial failures.
- **Recommendation:** Global error toast/banner with retry for failed queries.
- **Priority:** Low  
- **Sources:** QA_UI_AUDIT

### L-07 — AnchoredDropdown / loginError / section-sub-nav clones
- **Problem:** Near-duplicate utilities across apps.
- **Reason:** Copy-paste sharing.
- **Affected Pages:** Menus, login, section nav both apps.
- **Impact:** Drift risk.
- **Recommendation:** Move to `@ds`/shared lib.
- **Priority:** Low  
- **Sources:** FRONTEND_ARCHITECTURE_AUDIT

### L-08 — Admin sidebar sections forced open
- **Problem:** WMS/OMS `defaultOpen={… || true}` never collapses.
- **Reason:** Bug/oversight in collapse defaults.
- **Affected Pages:** Admin Layout sidebar.
- **Impact:** Longer nav; more Hick’s Law load.
- **Recommendation:** Honor collapse state.
- **Priority:** Low  
- **Sources:** PRODUCT_DESIGN_AUDIT

### L-09 — Universal `animate-enter` sameness
- **Problem:** Most pages use the same enter animation.
- **Reason:** Migration polish habit.
- **Affected Pages:** Migrated Admin/Client pages.
- **Impact:** Motion without hierarchy.
- **Recommendation:** Reserve motion for meaningful transitions.
- **Priority:** Low  
- **Sources:** PRODUCT_DESIGN_AUDIT

### L-10 — Placeholder-only search fields on Client lists
- **Problem:** Search inputs lack visible labels (placeholder only).
- **Reason:** Compact filter bars.
- **Affected Pages:** Client Online/Inbound/Outbound/Products searches.
- **Impact:** Mild a11y/scan issue.
- **Recommendation:** Visible or aria labels.
- **Priority:** Low  
- **Sources:** QA_UI_AUDIT

---

# Nice to Have

### N-01 — Distinct product typography beyond Inter
- **Problem:** Client locks Inter; default SaaS look.
- **Reason:** No brand type decision.
- **Affected Pages:** Client portal global.
- **Impact:** Weak brand differentiation.
- **Recommendation:** Choose a purposeful UI font pair consistent with brand.
- **Priority:** Nice to Have  
- **Sources:** PRODUCT_DESIGN_AUDIT

### N-02 — Promote `@ds` Drawer/Tooltip/Breadcrumb usage
- **Problem:** Exported primitives underused; modals dominate.
- **Reason:** Habit + incomplete adoption.
- **Affected Pages:** Potential detail/filter/help surfaces.
- **Impact:** Missed progressive disclosure patterns.
- **Recommendation:** Adopt where drawers fit better than modals.
- **Priority:** Nice to Have  
- **Sources:** DESIGN_SYSTEM_REPORT, FRONTEND_ARCHITECTURE_AUDIT

### N-03 — Richer empty illustrations / first-run samples
- **Problem:** Empties are text-only.
- **Reason:** Speed of delivery.
- **Affected Pages:** Lists with true-empty states.
- **Impact:** Soft onboarding quality.
- **Recommendation:** EmptyState with illustration + primary CTA.
- **Priority:** Nice to Have  
- **Sources:** UX_AUDIT, PRODUCT_DESIGN_AUDIT

### N-04 — Chart color system aligned to brand
- **Problem:** Rainbow/teal chart palettes diverge from emerald semantic map.
- **Reason:** Ad-hoc chart colors.
- **Affected Pages:** Admin Billing dashboard; Client Order movement.
- **Impact:** Visual inconsistency.
- **Recommendation:** Tokenized chart palette.
- **Priority:** Nice to Have  
- **Sources:** PRODUCT_DESIGN_AUDIT

### N-05 — Reduced-motion / high-contrast QA
- **Problem:** Not tested in QA pass.
- **Reason:** Coverage gap.
- **Affected Pages:** Global.
- **Impact:** Unknown a11y for vestibular/contrast needs.
- **Recommendation:** Add to QA checklist.
- **Priority:** Nice to Have  
- **Sources:** QA_UI_AUDIT

### N-06 — Print / camera modal polish pass
- **Problem:** Pack print and camera modals not visually verified end-to-end in QA.
- **Reason:** Scope limit.
- **Affected Pages:** Pack/Dispatch print; BarcodeScanModal consumers.
- **Impact:** Unknown edge glitches.
- **Recommendation:** Dedicated device QA on scanners/printers.
- **Priority:** Nice to Have  
- **Sources:** QA_UI_AUDIT, WAREHOUSE_AUDIT

---

## Suggested fix order (execution view)

1. **Restore working tree DS/shells** (C-01)  
2. **Kill dead Client chrome** (C-07) + **product detail route** (C-08)  
3. **Confirm→task handoff** (C-04) + **Assign/Start simplification** (C-05)  
4. **Gun-first execution shortcuts** (C-06, H-05, H-06)  
5. **Client morning dashboard + money/orders IA** (C-10, H-08, H-09, H-10)  
6. **Unify design system ownership** (C-02, C-03, H-01, H-02, H-03)  
7. **Loading skeletons + RTL i18n** (C-09, C-13)  
8. **Tasks identity/search + naming glossary** (C-11, C-12)  
9. Then Medium → Low → Nice to Have  

---

## Source map

| Report | Primary contribution |
|--------|----------------------|
| PRODUCT_DESIGN_AUDIT | Hierarchy, cards, density, color, consistency |
| UX_AUDIT | First-time workflow friction, labels, onboarding |
| WAREHOUSE_AUDIT | Floor speed, clicks, scanner shortcuts |
| CLIENT_PORTAL_AUDIT | Merchant morning decisions |
| QA_UI_AUDIT | Live broken controls, loading, RTL, a11y |
| FRONTEND_ARCHITECTURE_AUDIT | Stacks, `@wms`, duplicates, debt |
| DESIGN_SYSTEM_REPORT | Unification gaps, working-tree warning |

---

*End of master UI audit. Duplicates collapsed; priorities are product/ops impact judgments across all source reports.*
