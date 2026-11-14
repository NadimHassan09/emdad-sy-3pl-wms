# 04a — Admin portal page catalogue

One section per page. **Every page is tested with its standard battery (defined in `04-e2e-testing.md` §Batteries) on 4 devices + the page-specific cases below.**
Screenshots: `docs/testing/screenshots/staging-admin-frontend-screenshots/<device>/<seq>_<route>.png` (index: `index.json`). `Vnnn` refers to `16-observed-issues-during-capture.md`.

Pages captured: **88** · Pending states/modals: **21** · Redirect-only routes: **31**

| Seq | Route | Kind | Battery | Roles allowed | Cases |
|---|---|---|---|---|---|
| 001 | `/dashboard/overview` | dashboard | DASH-01…DASH-08 | SA, WM, WO, FIN, VW, IC | 8 |
| 002 | `/products` | list | LB-01…LB-24 | SA, WM, WO, VW, IC | 6 |
| 003 | `/locations` | list | LB-01…LB-24 | SA, WM, WO, VW, IC | 3 |
| 004 | `/warehouses` | list | LB-01…LB-24 | SA, WM, WO, VW, IC | 5 |
| 005 | `/inventory/stock` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 4 |
| 006 | `/inventory/ledger` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 3 |
| 007 | `/inventory/adjustments` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 4 |
| 008 | `/orders/inbound` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 5 |
| 009 | `/orders/inbound/new` | form | FB-01…FB-25 | SA, WM, WO, FIN, VW, IC | 7 |
| 010 | `/orders/outbound` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 4 |
| 011 | `/orders/outbound/new` | form | FB-01…FB-25 | SA, WM, WO, FIN, VW, IC | 4 |
| 012 | `/orders/oms` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 9 |
| 013 | `/orders/oms/new` | form | FB-01…FB-25 | SA, WM, WO, FIN, VW, IC | 8 |
| 014 | `/oms/dashboard` | dashboard | DASH-01…DASH-08 | SA, WM, WO, FIN, VW, IC | 3 |
| 015 | `/oms/batches` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 2 |
| 016 | `/oms/cod` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 4 |
| 017 | `/oms/returns` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 4 |
| 018 | `/contracts/grn` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 2 |
| 019 | `/contracts/dn` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 1 |
| 020 | `/contracts/final-contract` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 2 |
| 021 | `/tasks` | list | LB-01…LB-24 | SA, WM, WO, VW, IC | 2 |
| 022 | `/cycle-count` | list | LB-01…LB-24 | SA, WM, WO, VW, IC | 1 |
| 023 | `/cycle-count/my-tasks` | list | LB-01…LB-24 | SA, WM, WO, VW, IC | 2 |
| 024 | `/returns` | list | LB-01…LB-24 | SA, WM, WO, VW, IC | 2 |
| 025 | `/internal` | list | LB-01…LB-24 | SA, WM, WO, VW, IC | 3 |
| 026 | `/reports/warehouse-analysis` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 027 | `/reports/inventory` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 028 | `/reports/product-moves` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 029 | `/reports/stock-aging` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 030 | `/reports/lot-expiry` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 031 | `/reports/capacity-utilization` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 032 | `/reports/return-rate` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 033 | `/reports/revenue-by-client` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 034 | `/reports/receivables-aging` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 035 | `/reports/worker-productivity` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 036 | `/reports/order-cycle-time` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 037 | `/reports/inbound-accuracy` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 038 | `/reports/outbound-fill-rate` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 039 | `/reports/sla-compliance` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 040 | `/reports/merchant-orders` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 041 | `/reports/sales-report` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 042 | `/reports/delivery-report` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 043 | `/reports/allocation-report` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 044 | `/reports/inventory-reserved` | report | RB-01…RB-14 | SA, WM, WO, FIN, VW, IC | 2 |
| 045 | `/clients` | list | LB-01…LB-24 | SA, WM | 3 |
| 046 | `/forms` | list | LB-01…LB-24 | SA, WM | 3 |
| 047 | `/finance/overview` | dashboard | DASH-01…DASH-08 | SA, WM, FIN, VW | 3 |
| 048 | `/finance/accounts` | list | LB-01…LB-24 | SA, WM, FIN, VW | 4 |
| 049 | `/finance/transactions` | list | LB-01…LB-24 | SA, WM, FIN, VW | 4 |
| 050 | `/finance/cod` | list | LB-01…LB-24 | SA, WM, FIN, VW | 2 |
| 051 | `/finance/payouts` | list | LB-01…LB-24 | SA, WM, FIN, VW | 2 |
| 052 | `/finance/carrier-costs` | list | LB-01…LB-24 | SA, WM, FIN, VW | 3 |
| 053 | `/finance/float` | settings | SB-01…SB-10 | SA, WM, FIN, VW | 3 |
| 054 | `/finance/policies` | settings | SB-01…SB-10 | SA, WM, FIN, VW | 5 |
| 055 | `/users/custom-roles` | form | FB-01…FB-25 | SA | 4 |
| 056 | `/billing/dashboard` | dashboard | DASH-01…DASH-08 | SA, WM, FIN, VW | 3 |
| 057 | `/billing/plans` | list | LB-01…LB-24 | SA, WM, FIN, VW | 3 |
| 058 | `/billing/plans/new` | form | FB-01…FB-25 | SA, WM, FIN, VW | 4 |
| 059 | `/billing/templates` | list | LB-01…LB-24 | SA, WM, FIN, VW | 2 |
| 060 | `/billing/invoices` | list | LB-01…LB-24 | SA, WM, FIN, VW | 4 |
| 061 | `/billing/invoices/on-demand` | form | FB-01…FB-25 | SA, WM, FIN, VW | 6 |
| 062 | `/billing/charge-rules` | form | FB-01…FB-25 | SA, WM, FIN, VW | 2 |
| 063 | `/users/warehouse_users` | list | LB-01…LB-24 | SA, WM | 4 |
| 064 | `/users/client_users` | list | LB-01…LB-24 | SA, WM | 2 |
| 065 | `/audit-logs` | list | LB-01…LB-24 | SA, WM, FIN, VW | 4 |
| 066 | `/notifications` | list | LB-01…LB-24 | SA, WM, WO, FIN, VW, IC | 4 |
| 067 | `/profile` | form | FB-01…FB-25 | SA, WM, WO, FIN, VW, IC | 3 |
| 068 | `/backups` | dashboard | DASH-01…DASH-08 | SA, WM | 5 |
| 069 | `/backups/schedules` | list | LB-01…LB-24 | SA, WM | 1 |
| 070 | `/backups/retention` | settings | SB-01…SB-10 | SA, WM | 2 |
| 071 | `/backups/health` | dashboard | DASH-01…DASH-08 | SA, WM | 2 |
| 072 | `/backups/google-drive` | redirect | RD-01…RD-02 | SA, WM | 1 |
| 073 | `/backups/google-oauth-settings` | redirect | RD-01…RD-02 | SA | 1 |
| 074 | `/shipping/companies` | settings | SB-01…SB-10 | SA, WM | 8 |
| 075 | `/shipping/fee-rates` | list | LB-01…LB-24 | SA, WM | 4 |
| 076 | `/products/:sku` | detail | DB-01…DB-12 | SA, WM, WO, VW, IC | 3 |
| 077 | `/orders/inbound/:id` | detail | DB-01…DB-12 | SA, WM, WO, FIN, VW, IC | 3 |
| 078 | `/orders/outbound/:id` | detail | DB-01…DB-12 | SA, WM, WO, FIN, VW, IC | 3 |
| 079 | `/orders/oms/:id` | detail | DB-01…DB-12 | SA, WM, WO, FIN, VW, IC | 6 |
| 080 | `/orders/oms/:id/waybill` | detail | DB-01…DB-12 | SA, WM, WO, FIN, VW, IC | 4 |
| 081 | `/oms/batches/:id` | detail | DB-01…DB-12 | SA, WM, WO, FIN, VW, IC | 4 |
| 082 | `/oms/returns/:id` | detail | DB-01…DB-12 | SA, WM, WO, FIN, VW, IC | 2 |
| 083 | `/clients/:id` | detail | DB-01…DB-12 | SA, WM | 2 |
| 084 | `/billing/invoices/:id` | detail | DB-01…DB-12 | SA, WM, FIN, VW | 4 |
| 085 | `/inventory/adjustments/:id` | detail | DB-01…DB-12 | SA, WM, WO, FIN, VW, IC | 2 |
| 086 | `/tasks/:id` | detail | DB-01…DB-12 | SA, WM, WO, VW, IC | 2 |
| 087 | `/locations/:warehouseId` | list | LB-01…LB-24 | SA, WM, WO, VW, IC | 4 |
| 088 | `/users/warehouse_users/:id` | detail | DB-01…DB-12 | SA, WM | 2 |

---

## PA001 — `/dashboard/overview` — Operations Overview (dashboard)

- **Kind:** dashboard → standard battery **DASH-01…DASH-08**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `001_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Greeting; Refresh; Export; filters (3 selects: warehouse/client/period 7D·30D·90D); cards Needs Attention (Resolve), Quick Actions (Orders, Tasks, Inbound, Outbound), Outbound Pipeline, Warehouse Tasks, Storage Utilization, Billing & Clients (links to plans), Recent Activity, Top Products by Movement; Restore (widget)
- **Observed issues:** V-001

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA001.1 | Every KPI equals the API/DB value (outbound pipeline per status, task counts, storage %, billing summary) | Numbers match `GET /dashboard/*` and SQL counts; no NaN/undefined | P0 |
| PA001.2 | 7D/30D/90D switch re-queries and updates all widgets | Network call per switch; values change consistently; selected pill highlighted | P1 |
| PA001.3 | Needs-Attention "Resolve" opens the right target and the item disappears once resolved | Deep link goes to filtered list; item count decrements after fix | P1 |
| PA001.4 | Quick Actions open pre-filled create pages | Inbound/Outbound new pages load; Orders/Tasks open lists | P1 |
| PA001.5 | Realtime refresh: create an order in another session | Dashboard counters update without reload (realtime module) | P1 |
| PA001.6 | Per-role content: wh_operator, finance, viewer see only widgets allowed | Hidden widgets absent, not just empty | P1 |
| PA001.7 | Export button | File downloads with the displayed numbers | P1 |
| PA001.8 | Skeleton/loading and error state (API 500) | Friendly message, no raw JSON; retry button works | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA002 — `/products` — Products list

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `002_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Export Excel/CSV; New product; status cards (All 51/Active/Suspended/Archived); Search (product, client, SKU, barcode); Filter by client (searchable dropdown); Scan barcode; row actions; pagination
- **Observed issues:** V-002

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA002.1 | Create → edit → archive → restore a product (QA- prefix) | Status card counts move; ledger untouched | P0 |
| PA002.2 | Scan barcode control (camera + manual entry) | Opens scanner modal / accepts manual barcode and jumps to product | P1 |
| PA002.3 | Filter by client then search by SKU (AND semantics) | Intersection only | P1 |
| PA002.4 | Client dropdown search box resets after selection | No leftover text (UX-02) | P1 |
| PA002.5 | Product image column: missing image placeholder | Placeholder, no broken-image icon | P1 |
| PA002.6 | Export respects filters and includes Arabic names | Row count = filtered total | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA003 — `/locations` — Warehouse Locations (overview)

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `003_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Manage Warehouses; Reset; Apply filters; Advanced Filtering; search (code, name, city); status select; per-warehouse "Manage locations"; pagination
- **Observed issues:** V-003

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA003.1 | Manage locations opens `/locations/:warehouseId` | Correct warehouse | P0 |
| PA003.2 | Location counts column = locations in warehouse | Equals hierarchy count (see PA087) | P1 |
| PA003.3 | Reset button colour/semantics | Not red (V-003) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA004 — `/warehouses` — Warehouses

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `004_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** + New warehouse (modal); Reset filters; Apply filters; Advanced Filtering; row actions Locations / Edit / Deactivate; pagination
- **Observed issues:** V-004

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA004.1 | Create warehouse (code unique, name, city, country) → appears → add first location immediately | Matches client request B5: auto-open locations | P0 |
| PA004.2 | Edit warehouse; Deactivate with stock inside | Blocked or warns when stock/locations exist | P1 |
| PA004.3 | Duplicate code | Field-level error | P1 |
| PA004.4 | Country shows full name not "Syr"/"EG"/"SA" codes | Consistent format (V-004) | P1 |
| PA004.5 | Status badge casing | Same casing as other pages | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA005 — `/inventory/stock` — Inventory — stock

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `005_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Tabs Stock/Ledger/Adjustments; Export Excel/CSV; status cards (All/In stock/Low/Out); filters; Show barcode; pagination
- **Observed issues:** V-005

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA005.1 | Available stock = on-hand − reserved − allocated for sampled products | Matches `GET /inventory/availability` | P0 |
| PA005.2 | Low-stock threshold card uses product min threshold | Counts equal filter results | P1 |
| PA005.3 | Show barcode toggles column / opens modal | Barcode printable | P1 |
| PA005.4 | Long Arabic product names wrap sensibly on mobile | No 5-line cells (V-005) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA006 — `/inventory/ledger` — Inventory ledger

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `006_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Export; Reset/Apply filters; Advanced Filtering; movement type; date; pagination; row → ledger entry / reference pages
- **Observed issues:** V-006

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA006.1 | Append-only: no edit/delete affordance | None visible; API PUT/DELETE rejected | P0 |
| PA006.2 | Row click opens `/inventory/ledger/line/:id/:createdAt` and reference page | Correct entry; back keeps filters | P1 |
| PA006.3 | Ledger sum per product equals stock balance | Equal (SYS-INV) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA007 — `/inventory/adjustments` — Stock adjustments

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `007_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** + New adjustment; filters; row actions; pagination; search = adjustment UUID
- **Observed issues:** V-007

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA007.1 | Create adjustment (increase/decrease) with reason, approve, check ledger + stock | Ledger row created once; stock changed once | P0 |
| PA007.2 | Decrease below zero | Rejected (stock never negative) | P1 |
| PA007.3 | Adjustment id is a human code, not raw UUID | Display code (V-007) | P1 |
| PA007.4 | Roles: only allowed roles see New adjustment | viewer cannot create | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA008 — `/orders/inbound` — Inbound orders

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `008_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Import; Export; + New inbound; status cards (All/Draft/Pending approval/Confirmed/In progress/Partially received/Completed/Cancelled); search; client + status selects; row checkbox; row actions; pagination
- **Observed issues:** V-008

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA008.1 | Status card counts equal list totals; sum = All | Equal | P0 |
| PA008.2 | Import template → import valid/invalid file | Row errors shown; valid rows created | P1 |
| PA008.3 | Order number never wraps (nowrap) | Single line on mobile (V-008) | P1 |
| PA008.4 | Expected arrival far-future date (2999) is rejected at create | Validation message | P1 |
| PA008.5 | Open row → detail; Cancel from row menu with confirm | Status Cancelled; no stock effect | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA009 — `/orders/inbound/new` — New inbound order

- **Kind:** form → standard battery **FB-01…FB-25**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `009_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** General information (client select, expected date, notes); Products lines (search product, qty, remove, + Add line); Receiving dock; Putaway plan; Execution mode (Execute by Admin / Execute by Workers); Cancel; Save plan
- **Observed issues:** V-009

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA009.1 | Create with 1 line, Execute by Admin → detail shows plan | Order INB-… draft/pending per rules | P0 |
| PA009.2 | Execute by Workers → tasks generated after approval | Receiving tasks visible in /tasks | P1 |
| PA009.3 | Line qty 0/negative/decimal/1e9 | Validation | P1 |
| PA009.4 | Same product twice | Merged or rejected consistently | P1 |
| PA009.5 | Client change clears product lines | Products belong to chosen client only | P1 |
| PA009.6 | Putaway plan only allows Storage-type locations of the chosen warehouse | Dropdown filtered | P1 |
| PA009.7 | Save plan twice quickly | One order | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA010 — `/orders/outbound` — Outbound orders

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `010_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Bulk Shipping Processing; Import; Export; + New outbound; status cards (All/Draft/Pending/Confirmed/Allocated/Picking/Packing/Shipped/Cancelled); checkboxes (eligible only); search; filters; pagination
- **Observed issues:** V-010

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA010.1 | Bulk Shipping Processing enabled only with eligible selection; opens modal | Disabled state explains why (V-010) | P0 |
| PA010.2 | Select-all selects eligible rows only | Counter = eligible count | P1 |
| PA010.3 | 3,608 rows: pagination + chunk paging performance | List < 2 s, no N+1 (PERF) | P1 |
| PA010.4 | Row height on tablet/mobile | Compact rows (V-010) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA011 — `/orders/outbound/new` — New outbound order

- **Kind:** form → standard battery **FB-01…FB-25**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `011_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** General information; Products lines; Packing & dispatch (packing required checkbox, packing location, dispatch dock); Execute by Admin/Workers; Cancel; Save plan
- **Observed issues:** —

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA011.1 | Create with stock → allocation preview | Reservation created only on confirm | P0 |
| PA011.2 | Insufficient stock | Clear message with available qty | P1 |
| PA011.3 | Packing not required → packing location hidden | Conditional field | P1 |
| PA011.4 | Shipping method Shipping Company vs own delivery | Fields switch | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA012 — `/orders/oms` — OMS orders

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `012_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Import; Export CSV; Create OMS Order; Scan QR (Confirm/Approve/Ready to ship/Handover/Delivered/Failed delivery by QR); status cards (All 4,320 / Waiting for confirmation / Waiting for admin / Processing / Ready to ship / Out for delivery / Delivered / "Field Delivery" / Return pending receipt / Return received / Cancelled); filters + Advanced Filtering; group-by; checkboxes; row actions; copy buttons; contents column; pagination
- **Observed issues:** V-011

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA012.1 | Each status card filters correctly and totals = 4,320 | Equal | P0 |
| PA012.2 | Card label "Field Delivery" is "Failed Delivery" | Correct wording (V-011) | P1 |
| PA012.3 | Scan QR accumulates many orders then bulk-transitions | Only valid transitions applied; invalid listed | P1 |
| PA012.4 | Group-by city/client/product/carrier/status (page-scoped) | Groups correct; documented limitation | P1 |
| PA012.5 | Copy buttons: address, name, phone, order number | Each copies exactly that value (client B19) | P1 |
| PA012.6 | Contents column shows items | Product × qty | P1 |
| PA012.7 | Import messy file (phones, Arabic letters, dates) | Tolerant parsing; row errors listed (B16/B22) | P1 |
| PA012.8 | Export CSV/Excel with analytics block | Branded Excel (owner #19) | P1 |
| PA012.9 | Row actions per status (confirm, approve, ship, cancel, edit) | Matrix in `05` | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA013 — `/orders/oms/new` — New OMS order (admin)

- **Kind:** form → standard battery **FB-01…FB-25**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `013_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Client select (starts empty, not Acme); recipient name; phone with country code 🇸🇾+963 and +/−; governorate/city/town selects (type-or-select); street address; map; payment type COD/prepaid; COD amount; required ship date; notes; products lines; Cancel; Submit for approval
- **Observed issues:** V-012

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA013.1 | Client select starts empty and does not auto-reset to "Acme Import" on mobile (B18) | Stays on chosen client | P0 |
| PA013.2 | Governorate → city → town dependent dropdowns; unknown neighbourhood typed by hand | Tolerant matching "Did you mean" (B11) | P1 |
| PA013.3 | Raqqa/Deir ez-Zor/Hasakah/Suwayda orders | Accepted; routed to non-Babel carriers or Manual (B10) | P1 |
| PA013.4 | Phone +963 / 09 / 00963 / Arabic digits | Normalised | P1 |
| PA013.5 | COD amount vs prepaid | COD field only when COD | P1 |
| PA013.6 | Map pin | Lat/long saved; tile seams not visible (V-012) | P1 |
| PA013.7 | Shipping fee group coverage missing for destination | Warning before confirm (owner #24) | P1 |
| PA013.8 | Double asterisk in "Street / Detailed Address **" | Single required marker (V-012) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA014 — `/oms/dashboard` — OMS dashboard

- **Kind:** dashboard → standard battery **DASH-01…DASH-08**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `014_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Refresh dashboard; date filter; selects (2); Orders by status; Order summary; Orders trend; Recent orders table (links); Live activity
- **Observed issues:** —

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA014.1 | Totals equal `/orders/oms` counts for the same range | Equal | P0 |
| PA014.2 | Live activity updates via websocket | New event appears < 3 s | P1 |
| PA014.3 | Recent order link opens detail | Correct id | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA015 — `/oms/batches` — OMS batches

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `015_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** KPI chips (All 14 / Active / With issues / Completed); Search; Open; pagination
- **Observed issues:** —

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA015.1 | Create batch from OMS list selection; batch appears here | Batch number BATCH-nnnn | P0 |
| PA015.2 | Issues chip = batches with ≥1 failing order | Definition documented (A-11) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA016 — `/oms/cod` — OMS COD

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `016_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Status chips (All 806 / Pending / Available / Paid out / Returned) — values "—"; Client select; Export Excel/CSV/PDF; Pending/Available/Paid out/Returned by QR; "Set (n selected)"; filters; pagination
- **Observed issues:** V-013

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA016.1 | Status chips show counts, not "—" | Counts equal list (V-013) | P0 |
| PA016.2 | Mark Available/Paid out for selection | Only valid transitions; finance rows created | P1 |
| PA016.3 | Export PDF | Opens/downloads PDF with filtered rows | P1 |
| PA016.4 | COD amount currency | Per policy (A-03) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA017 — `/oms/returns` — OMS returns

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `017_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Export; Confirm by Scan (QR); Create Return; Express Return; status chips (All 477 / Pending / Received / Rejected / Cancelled) — "—"; date from/to; filters; Rollback; Confirm; pagination
- **Observed issues:** V-013

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA017.1 | Create return for delivered order (qty ≤ delivered) | OR-… created | P0 |
| PA017.2 | Express return | Skips plan stages per rule (A-12) | P1 |
| PA017.3 | Rollback / Confirm per row | State machine respected | P1 |
| PA017.4 | Chips show counts | See V-013 | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA018 — `/contracts/grn` — Goods receipt notes

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `018_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reset/Apply filters; search; row Open PDF (EN/AR); Create PDF; pagination
- **Observed issues:** V-014

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA018.1 | Create PDF for completed inbound; open EN + AR | Both render, numbers match order | P0 |
| PA018.2 | Status Partial/Pending/Not generated meaning | Documented (A-13) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA019 — `/contracts/dn` — Delivery notes

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `019_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Same as GRN for outbound
- **Observed issues:** V-014

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA019.1 | Create/open DN PDFs EN+AR | Match shipped quantities | P0 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA020 — `/contracts/final-contract` — Final contracts

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `020_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** + Create final contract; filters; Open PDF; Create PDF; actions
- **Observed issues:** —

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA020.1 | Create final contract for client; edit; PDF EN+AR | Issue date and client company shown | P0 |
| PA020.2 | Duplicate/overlap | Rule (A-14) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA021 — `/tasks` — Warehouse tasks

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `021_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Filters (order number / task id, type, status); pagination; row → task detail
- **Observed issues:** —

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA021.1 | Tasks created after Execute-by-Workers approval | Pick/Pack/Receive/Putaway rows | P0 |
| PA021.2 | Assigned worker / start / end / duration columns | Duration = end − start | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA022 — `/cycle-count` — Cycle count

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `022_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Tabs Count sessions/Product schedule; filters; table
- **Observed issues:** V-015

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA022.1 | Create session, assign, count, approve variance | Ledger adjustments only on approval | P0 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA023 — `/cycle-count/my-tasks` — My cycle counts

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `023_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Dashboard link; Manage warehouse users link
- **Observed issues:** V-015

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA023.1 | Admin without worker profile sees instruction text | No developer wording ("/auth/me includes workerId") (V-015) | P0 |
| PA023.2 | Worker sees own tasks only | Tenant/user scope | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA024 — `/returns` — WMS returns

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `024_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** + New return; status chips (All/Draft/Confirmed/Receiving/Inspecting/Completed/Cancelled); filters
- **Observed issues:** V-016

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA024.1 | Banner "Select a tenant company…" yet no selector → how does a super admin pick the tenant? | Selector present or list loads all (defect candidate V-016) | P0 |
| PA024.2 | Create return from outbound | Return lines ≤ shipped qty | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA025 — `/internal` — Internal transfer

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `025_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Create Internal Transfer; table When/Client/Product/Lot/Qty/From→To/Ref
- **Observed issues:** V-017

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA025.1 | Transfer qty between two locations | Two ledger rows (out/in) same ref | P0 |
| PA025.2 | Same source/destination | Rejected | P1 |
| PA025.3 | FROM→TO shows location codes | Not "— → —" (V-017) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA026 — `/reports/warehouse-analysis` — Report — Warehouse Analysis

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `026_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: List/Graph/Pivot; Bar/Line/Pie; date; client
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA026.1 | Warehouse Analysis: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA026.2 | Warehouse Analysis: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA027 — `/reports/inventory` — Report — Inventory

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `027_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: List/Graph/Pivot; columns SKU, Product, Client, Location, Lot, Expiry, On hand, Reserved, Available, Status
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA027.1 | Inventory: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA027.2 | Inventory: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA028 — `/reports/product-moves` — Report — Product Moves

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `028_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: columns Date, Product, SKU, Client, Movement, Status, Qty, Reference, Operator, Lot, From, To
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA028.1 | Product Moves: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA028.2 | Product Moves: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA029 — `/reports/stock-aging` — Report — Stock Aging

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `029_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Days idle, Aging bucket, Stagnant
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA029.1 | Stock Aging: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA029.2 | Stock Aging: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA030 — `/reports/lot-expiry` — Report — Lot Expiry

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `030_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Days until, Expiry bucket
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA030.1 | Lot Expiry: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA030.2 | Lot Expiry: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA031 — `/reports/capacity-utilization` — Report — Capacity Utilization

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `031_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Used/Reserved CBM, Utilization %
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA031.1 | Capacity Utilization: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA031.2 | Capacity Utilization: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA032 — `/reports/return-rate` — Report — Return Rate

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `032_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: chart views
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA032.1 | Return Rate: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA032.2 | Return Rate: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA033 — `/reports/revenue-by-client` — Report — Revenue by Client

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `033_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: chart views, currency
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA033.1 | Revenue by Client: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA033.2 | Revenue by Client: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA034 — `/reports/receivables-aging` — Report — Receivables Aging

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `034_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Invoice #, Days past due, Aging bucket
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA034.1 | Receivables Aging: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA034.2 | Receivables Aging: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA035 — `/reports/worker-productivity` — Report — Worker Productivity

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `035_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Worker, Completed, Avg cycle (h), Pick/pack
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA035.1 | Worker Productivity: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA035.2 | Worker Productivity: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA036 — `/reports/order-cycle-time` — Report — Order Cycle Time

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `036_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Cycle (h), Start, End
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA036.1 | Order Cycle Time: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA036.2 | Order Cycle Time: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA037 — `/reports/inbound-accuracy` — Report — Inbound Accuracy

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `037_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Discrepancies, Accuracy %
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA037.1 | Inbound Accuracy: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA037.2 | Inbound Accuracy: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA038 — `/reports/outbound-fill-rate` — Report — Outbound Fill Rate

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `038_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Requested, Picked, Fill rate, Short ship
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA038.1 | Outbound Fill Rate: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA038.2 | Outbound Fill Rate: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA039 — `/reports/sla-compliance` — Report — SLA Compliance

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `039_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: chart views
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA039.1 | SLA Compliance: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA039.2 | SLA Compliance: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA040 — `/reports/merchant-orders` — Report — Merchant Orders

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `040_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Recipient, City, Payment, Allocation, Lines
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA040.1 | Merchant Orders: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA040.2 | Merchant Orders: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA041 — `/reports/sales-report` — Report — Sales Report

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `041_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Subtotal, Shipping, Total, Currency, Payment, Delivered
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA041.1 | Sales Report: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA041.2 | Sales Report: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA042 — `/reports/delivery-report` — Report — Delivery Report

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `042_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Carrier, Tracking, City, Out for delivery, Delivered
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA042.1 | Delivery Report: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA042.2 | Delivery Report: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA043 — `/reports/allocation-report` — Report — Allocation Report

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `043_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Reservations, Allocated
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA043.1 | Allocation Report: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA043.2 | Allocation Report: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA044 — `/reports/inventory-reserved` — Report — Inventory Reserved

- **Kind:** report → standard battery **RB-01…RB-14**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `044_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: Order #, SKU, Location, Lot, Qty, Status
- **Observed issues:** V-018

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA044.1 | Inventory Reserved: Generate with default filters equals SQL for the same filter | Totals/rows identical to source query | P0 |
| PA044.2 | Inventory Reserved: Export CSV/Excel matches on-screen rows and filters | Same row count; UTF-8 Arabic ok | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA045 — `/clients` — Clients

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `045_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** + New company; search; row actions; pagination; Billing column
- **Observed issues:** V-019

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA045.1 | Create company → billing plan prompt | Validation of required fields (name, email, phone, country) | P0 |
| PA045.2 | Suspend client → client login refused | Client portal returns account-inactive page | P1 |
| PA045.3 | Row opens detail | Detail has edit shortcuts (V-019) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA046 — `/forms` — Contact forms

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `046_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Reset/Apply filters; search; Delete; pagination
- **Observed issues:** V-020

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA046.1 | Public form submission (`POST /forms/submit`) appears here | Fields saved; HTML escaped | P0 |
| PA046.2 | Delete with confirm | Row removed, audit row | P1 |
| PA046.3 | Long Arabic message truncation (RTL ellipsis) | Ellipsis on correct side (V-020) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA047 — `/finance/overview` — Finance — overview

- **Kind:** dashboard → standard battery **DASH-01…DASH-08**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `047_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Tabs: Overview/Client Accounts/Transactions/COD Management/Payouts/Carrier Costs/Float & Recon/Policies/Legacy Billing; Refresh; Recent Client Accounts; Recent Payout Requests; totals
- **Observed issues:** V-021

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA047.1 | Totals = sum of account balances / pending COD | Equal; currency label correct (A-03) | P0 |
| PA047.2 | Legacy Billing tab wording | Understandable to users (V-021) | P1 |
| PA047.3 | Finance title icon present | Icon rendered (V-021) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA048 — `/finance/accounts` — Client current accounts

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `048_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** + Manual Adjustment; search by client; table (Current/Available balance, Pending COD, Payout locked, Status); Adjust; Statement
- **Observed issues:** V-021

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA048.1 | Manual adjustment credit then debit with reason | Append-only: two transactions, balance correct | P0 |
| PA048.2 | Statement opens/exports | Opening + movements = closing | P1 |
| PA048.3 | Available = Current − Pending COD − Payout locked | Formula holds (SYS-FIN) | P1 |
| PA048.4 | "$" prefix on SYP-origin amounts | Currency label correct (V-021) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA049 — `/finance/transactions` — Financial transactions

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `049_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Export Excel/CSV; filters (search, client, type, category, from, to); table TXN #, Date, Client, Type, Category, Amount, Reference, Description
- **Observed issues:** V-022

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA049.1 | No edit/delete | Append-only | P0 |
| PA049.2 | Filters combine | AND | P1 |
| PA049.3 | Raw category/reference keys displayed | Human labels (V-022) | P1 |
| PA049.4 | Export equals filtered rows | Equal | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA050 — `/finance/cod` — COD financial management

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `050_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Search; status select; Confirm Collect; Confirm Remit; table Order, Client, COD amount, Status, Carrier collection, Carrier remittance, Client account
- **Observed issues:** V-021

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA050.1 | Confirm Collect then Confirm Remit on test order (Sena/Madino-Acme only, owner approved) | Client available balance increases per COD policy | P0 |
| PA050.2 | Remit twice | Idempotent, second rejected | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA051 — `/finance/payouts` — Payout management

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `051_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Status select; table Payout #, Date, Client, Amount, Status, Bank details, Reference, Actions
- **Observed issues:** V-021

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA051.1 | Client requests payout (client portal) → appears → approve/reject/disburse | Ledger debit on disburse only; minimum payout 10 USD enforced | P0 |
| PA051.2 | Bank details masked | Not shown fully in logs | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA052 — `/finance/carrier-costs` — Carrier internal costs

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `052_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Search AWB/order/tracking; provider select; payment status select; Mark Paid; table 337 rows; "Confidential" banner
- **Observed issues:** V-023

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA052.1 | Carrier cost column shows quote vs actual and "Pending Quote" meaning | Defined (A-04) | P0 |
| PA052.2 | Mark Paid changes status once | Idempotent | P1 |
| PA052.3 | Never reachable by client roles | RBAC 403 | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA053 — `/finance/float` — Float & carrier reconciliation (B12)

- **Kind:** settings → standard battery **SB-01…SB-10**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `053_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Provider code (free text), Float alert limit (5000), Refresh float; reconciliation textarea (AWB, amount, currency); Run reconciliation; disabled banner when module off
- **Observed issues:** V-024

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA053.1 | Module disabled by default → banner; enable in Policies → float shows in-transit cost | Equals Σ carrier cost of shipments not final | P0 |
| PA053.2 | Reconciliation: paste statement with match/mismatch/missing/duplicate AWB | Four categories reported | P1 |
| PA053.3 | Provider free text → dropdown | Only valid providers (V-024) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA054 — `/finance/policies` — Financial policies & settings

- **Kind:** settings → standard battery **SB-01…SB-10**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `054_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Cutover Active/Deactivate; COD availability policy (3 radio cards); Shipping fee recognition timing (At Dispatch / On Delivery); Minimum payout (auto-save on blur); B12 toggles (float, reconciliation, client shield); B15 liquidity (None/Float/Prep fee) + prep fee % + enable
- **Observed issues:** V-024

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA054.1 | Each policy persists after reload and writes an audit row | Yes | P0 |
| PA054.2 | Change COD policy affects only future events | Posted history unchanged (page banner) | P1 |
| PA054.3 | Deactivate Cutover asks confirmation | Confirm dialog (danger) | P1 |
| PA054.4 | Prep fee mode debits client when COD outstanding | Matches % × order value (A-05) | P1 |
| PA054.5 | Client shield ON hides gaps from client portal | Verify in client portal | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA055 — `/users/custom-roles` — Custom roles (O-11)

- **Kind:** form → standard battery **FB-01…FB-25**
- **Roles allowed (rbac.ts):** super_admin  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `055_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Name, Description; 12 permission chips (oms/inbound/outbound/finance/inventory/users × read/write) toggling Denied/Allowed; Create custom role; roles list
- **Observed issues:** V-024

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA055.1 | Create role with some permissions → assign to a user → login → only allowed routes/actions | RBAC follows role | P0 |
| PA055.2 | Edit/delete role in use | Warn / block | P1 |
| PA055.3 | Duplicate name | Error | P1 |
| PA055.4 | Modules missing (billing, reports, shipping, returns, cycle count, settings) | Intentional? (A-06) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA056 — `/billing/dashboard` — Billing dashboard

- **Kind:** dashboard → standard battery **DASH-01…DASH-08**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `056_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Tabs Dashboard/Plans/Invoices; widgets Expiring in 30/14/7/3 days; Billing cycles expiring soon (Renew); Overdue clients; Recent invoices; Suspended accounts
- **Observed issues:** V-025

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA056.1 | Legacy cycle widgets vs on-demand model | Hidden or explained (A-07) | P0 |
| PA056.2 | Renew action | Works or removed | P1 |
| PA056.3 | Overdue clients list equals unpaid invoices past due | Equal | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA057 — `/billing/plans` — Billing plans

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `057_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Create plan template; + Create plan; search client; filters; table Client, Remaining days, Reserved volume, Price, Billing cycle, Current cycle, Status, Auto renewal; actions
- **Observed issues:** V-025

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA057.1 | Plan per client; edit; detail | Charge rules link | P0 |
| PA057.2 | Remaining days for retired cycles | Meaningful | P1 |
| PA057.3 | Disable auto-renewal restricts client | Per text | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA058 — `/billing/plans/new` — Create billing plan

- **Kind:** form → standard battery **FB-01…FB-25**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `058_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Client (clients without plan), Plan mode (Custom/Template), Reserved volume m³*, Fixed plan price USD*, Inbound order price, Outbound order price, Billing cycle days*, Auto-renewal checkbox; Cancel (red); Create plan
- **Observed issues:** V-025

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA058.1 | Create custom plan; template plan | Plan appears; values stored in USD | P0 |
| PA058.2 | Numeric fields prefilled "0" — type directly | Select-all on focus (UX-04) | P1 |
| PA058.3 | Negative price / 0 cycle / huge volume | Validation | P1 |
| PA058.4 | Client without plan only | Dropdown excludes clients with plan | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA059 — `/billing/templates` — Plan templates

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `059_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** + Create template; search; Reset (red)/Apply; empty state "No plan templates yet."
- **Observed issues:** V-025

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA059.1 | Create/edit/disable template; use in plan | Template price flows to plan | P0 |
| PA059.2 | Empty state | Has call-to-action | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA060 — `/billing/invoices` — Invoices

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `060_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Export Excel/CSV; Charge rules; New on-demand invoice; search; Advanced filtering; table Invoice number, Client, Period, Amount ("205 USD"), Issue, Due, Status; row menu; "Click a row to view"
- **Observed issues:** V-026

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA060.1 | Status filter: Draft/Unpaid/Paid/Cancelled | Correct | P0 |
| PA060.2 | Amount format consistent with finance ("$") | Same formatting (V-026) | P1 |
| PA060.3 | Row actions: finalise, mark paid, settle from balance, cancel | Each writes finance rows once (see 05) | P1 |
| PA060.4 | Export | Equals filtered rows | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA061 — `/billing/invoices/on-demand` — New on-demand invoice

- **Kind:** form → standard battery **FB-01…FB-25**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `061_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Client select; From/To dates; checkboxes (Inbound, Outbound, Online (OMS), Shipping fees, Storage); link "charge rules"; Preview; Calculate storage; Check incentive
- **Observed issues:** V-026

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA061.1 | Preview for client/period: orders table (inbound/outbound/OMS) with editable fulfillment, EMDAD shipping fee, carrier cost | Spec `INVOICE_REDESIGN_SPEC.md` acceptance 1–8 | P0 |
| PA061.2 | Calculate storage: CBM × $10/m³; missing dimensions warning | Spec `BILLING_AUTOMATION_SPEC.md` §1 | P1 |
| PA061.3 | Check incentive: 499 no / 500 yes / 501 yes → −20 % of fulfillment | Spec §2 | P1 |
| PA061.4 | Orders already on another invoice are skipped | Not double billed | P1 |
| PA061.5 | OMS outbound counted once | Owner #7 | P1 |
| PA061.6 | Buttons disabled until client chosen — hint text | Tooltip/label (V-026) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA062 — `/billing/charge-rules` — Charge rules

- **Kind:** form → standard battery **FB-01…FB-25**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `062_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Client select; per-client optional charge toggles; save
- **Observed issues:** V-026

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA062.1 | Disable "storage" for a client → on-demand preview excludes storage | Excluded | P0 |
| PA062.2 | Rules persist and audit | Yes | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA063 — `/users/warehouse_users` — Warehouse users

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `063_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Tabs Warehouse users/Client users/Custom roles; + New user; search; table Name, Phone, Role, Status, Worker profile, Last login, Activity; row actions
- **Observed issues:** V-027

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA063.1 | Create user each role (wh_manager, wh_operator, finance(accountant), viewer, inventory_controller) | Role-based nav differs | P0 |
| PA063.2 | Deactivate user → session ends, login refused | Even via Google sign-in | P1 |
| PA063.3 | Password reset by admin | Never displays password | P1 |
| PA063.4 | Worker profile creation | Appears in task assignment select | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA064 — `/users/client_users` — Client users

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `064_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** + New user; search; Company column; Worker profile column (irrelevant)
- **Observed issues:** V-027

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA064.1 | Create client_admin / client_staff; link company | Login to client portal works with correct scope | P0 |
| PA064.2 | Worker profile column removed for clients | Hidden (V-027) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA065 — `/audit-logs` — Audit logs

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `065_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Export CSV; search; Advanced Filtering; table Timestamp, Actor, Role, Company, Action, Resource, Summary, Status, Details(View); retention line
- **Observed issues:** V-028

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA065.1 | Perform 10 audited actions → rows appear with correct actor/resource/before-after | Yes | P0 |
| PA065.2 | "AUTH REFRESH REPLAY IDEMPOTENT" noise | Filtered/aggregated or explained (V-028) | P1 |
| PA065.3 | Export limits (500 rows / 90 d) | Message when truncated | P1 |
| PA065.4 | View → diff JSON | No secrets in before/after (SEC) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA066 — `/notifications` — Notifications

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `066_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** All/Unread/Read tabs; Mark all read; list; pagination; bell badge (51)
- **Observed issues:** V-028

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA066.1 | Mark one read / all read | Badge decrements | P0 |
| PA066.2 | Billing-cycle notifications for retired cycles | Not generated (A-07) | P1 |
| PA066.3 | Click notification opens target | Deep link | P1 |
| PA066.4 | Realtime new notification | Badge increments | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA067 — `/profile` — Profile

- **Kind:** form → standard battery **FB-01…FB-25**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `067_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Photo Change/Remove; Personal details (full name) Save; Change password (current/new/confirm) Update; cards Notifications/Backups; (Google link hidden)
- **Observed issues:** V-029

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA067.1 | Change name; change password (policy ≥ 8 chars, wrong current, mismatch) | Messages; old password stops working | P0 |
| PA067.2 | Photo upload type/size | jpeg/png ≤ limit; bad file rejected | P1 |
| PA067.3 | "Auth group" wording | Understandable (V-029) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA068 — `/backups` — Backups overview

- **Kind:** dashboard → standard battery **DASH-01…DASH-08**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `068_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Tabs Overview/Scheduled/Retention/Health; Restore; Factory Reset; Upload; Create Backup; health card; KPI cards; filters; table; Manual backup cooldown (minutes) Save; Activity; Storage overview donut
- **Observed issues:** V-030

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA068.1 | Create backup (cooldown honoured) | Completed; file size >0; listed | P0 |
| PA068.2 | Download with token (public route `GET /backups/:id/download?token=`) | Token expiry/one-use enforced (SEC) | P1 |
| PA068.3 | Restore on staging copy only with owner approval | N/A unless approved | P1 |
| PA068.4 | Factory Reset guard | Typed phrase + role + cooldown; never executed in tests | P1 |
| PA068.5 | Header buttons overlap tabs on tablet/mobile | No overlap (V-030) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA069 — `/backups/schedules` — Backup schedules

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `069_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Create schedule; table Frequency, Time, Retention days, Storage policy, Enabled, Last run, Next run; Edit; Disable
- **Observed issues:** V-030

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA069.1 | Create daily schedule; next run correct; disable | Cron registered/unregistered | P0 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA070 — `/backups/retention` — Backup retention

- **Kind:** settings → standard battery **SB-01…SB-10**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `070_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Policy cards Daily 7 / Weekly 4 / Monthly 12 / Pre-snapshot 7; cleanup preview; Run local retention cleanup (danger)
- **Observed issues:** V-030

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA070.1 | Preview numbers = what cleanup would delete | Equal | P0 |
| PA070.2 | Run cleanup (on QA backups only) | Confirm; deletes exactly preview candidates | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA071 — `/backups/health` — Backup health

- **Kind:** dashboard → standard battery **DASH-01…DASH-08**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `071_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Health status; last success/failure; count; storage; next scheduled; metrics; Evaluate alerts now; events table
- **Observed issues:** V-030

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA071.1 | Health status vs critical event contradiction | Consistent (V-030) | P0 |
| PA071.2 | Evaluate alerts now | Creates/clears events | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA072 — `/backups/google-drive` — Backup — Google Drive (hidden UI)

- **Kind:** redirect → standard battery **RD-01…RD-02**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `072_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Renders backups overview (UI hidden by owner until OAuth publish)
- **Observed issues:** V-030

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA072.1 | Direct URL | No Drive controls visible; no error | P0 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA073 — `/backups/google-oauth-settings` — Google OAuth settings (hidden UI)

- **Kind:** redirect → standard battery **RD-01…RD-02**
- **Roles allowed (rbac.ts):** super_admin  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `073_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Renders backups overview (hidden)
- **Observed issues:** V-030

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA073.1 | Direct URL | Hidden by default; documented in GOOGLE_AUTH_UI_HIDDEN.md | P0 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA074 — `/shipping/companies` — Shipping companies & exchange rates

- **Kind:** settings → standard battery **SB-01…SB-10**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `074_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Sections: Exchange rates (manual rate, hours, stale limit, min change %, built-in vs custom HTTPS JSON API, Test source), Pickup address (contact, phone, city, district, street, lat/long, Save), per-carrier cards (Babel, Delivery Joud, Sila, Fatih, Sena): Test connection, Disconnect, Register webhook, Configure Webhook Secret
- **Observed issues:** V-031

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA074.1 | Manual rate save → active rate/cache changes; invalid (0, negative, text) | Rejected | P0 |
| PA074.2 | Custom API: http rejected, https test OK | As documented (I-12) | P1 |
| PA074.3 | Pickup address save → used on waybills/carrier create | Reflected | P1 |
| PA074.4 | Test connection per carrier (read-only) | Pass/fail message; no data created | P1 |
| PA074.5 | Register webhook (Sila) idempotent | Registered id shown | P1 |
| PA074.6 | Secrets never displayed (masked) | Masked after save | P1 |
| PA074.7 | Page has no H1 title; breadcrumb label wrong | Title present (V-031) | P1 |
| PA074.8 | Manual rate 120 vs active 130.01 | UI states which one is used (A-08) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA075 — `/shipping/fee-rates` — Shipping fee rates

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `075_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Client select; summary cards (rate groups, governorates covered, cities); Rate groups table (edit ✎, pause/play); Add rate group; Test a delivery price; Global weight & currency settings
- **Observed issues:** V-031

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA075.1 | Create group (governorates/cities), weight policy; most specific location wins | Test price tool returns correct group | P0 |
| PA075.2 | Empty groups (no destinations) active | Warning or block (A-09) | P1 |
| PA075.3 | Uncovered governorates warning | Listed before confirm | P1 |
| PA075.4 | Icon-only action buttons have tooltips | Yes (a11y) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA076 — `/products/:sku` — Product detail

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `076_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Back; product card (name, SKU, status, client); information grid (client, SKU, barcode, UoM, tracking, on-hand/reserved, min stock threshold, stock health, dimensions, weight); summary
- **Observed issues:** V-032

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA076.1 | Edit/archive from detail | Controls exist for allowed roles (V-032) | P0 |
| PA076.2 | Dimensions missing → warns that storage fee cannot be computed | Visible hint (A-10) | P1 |
| PA076.3 | Unknown SKU | 404 page | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA077 — `/orders/inbound/:id` — Inbound order detail

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `077_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Back; status; Print instructions; Order details; Line items (expected/received); Warehouse plan; GRN card (PDF EN/AR)
- **Observed issues:** V-033

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA077.1 | Receive/putaway/complete actions per status (draft…completed) | Matrix in 05 | P0 |
| PA077.2 | Link to OMS order that consumed this inbound (B3 traceability) | Reverse link present (A-15) | P1 |
| PA077.3 | GRN PDF EN/AR open | Numbers = lines | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA078 — `/orders/outbound/:id` — Outbound order detail

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `078_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Back; status; Print instructions; Order details; Linked OMS; Shipping details (carrier shipment created banner + Mark Shipping Details as Complete); destination; lines; actions
- **Observed issues:** V-033

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA078.1 | Complete stages: approve → allocate → pick → pack → ship (admin execution) | Stock ledger −qty once | P0 |
| PA078.2 | Mark Shipping Details complete only after carrier shipment | Button logic | P1 |
| PA078.3 | Shipping company code shown as name | Human name (V-033) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA079 — `/orders/oms/:id` — OMS order detail

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `079_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Back; title; status chip; header actions (Waybill, Cancel Shipment, Cancel order, Edit shipping fee, Open outbound); Recipient & shipping (Copy shipment info); Line items; Inbound traceability; Notes; Returns; side cards Order details + Pricing & COD (client shipping rate Edit, carrier quote, actual carrier cost, subtotal, COD)
- **Observed issues:** V-034

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA079.1 | Edit shipping fee (client-facing) writes through to invoice/finance | Updated everywhere | P0 |
| PA079.2 | Carrier cost correction (adjust-carrier-cost, internal) | Audit event; invoice margin updates | P1 |
| PA079.3 | Cancel Shipment vs Cancel order semantics | Distinct, confirmed | P1 |
| PA079.4 | Inbound traceability links to INB orders | Correct | P1 |
| PA079.5 | Title "OMS OMS-…" and raw "waiting_for_shipping_details" | Fixed (V-034) | P1 |
| PA079.6 | Super-admin edit after delivery shows local-only warning | EN+AR warning (B9/B14) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA080 — `/orders/oms/:id/waybill` — OMS waybill (print)

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `080_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Tabs; Back; label size chip 10×15 cm; English toggle; PDF download; Print; label with 2 QR codes, sender, recipient, notes, payment/COD/fee, contents
- **Observed issues:** V-034

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA080.1 | Print to PDF at 10×15 cm | One page, QR scannable | P0 |
| PA080.2 | English toggle | Label switches language | P1 |
| PA080.3 | Batch waybills PDF/Excel from batch page | All orders included | P1 |
| PA080.4 | Sender block source | Warehouse pickup address (A-16) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA081 — `/oms/batches/:id` — OMS batch detail

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `081_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Title BATCH-n; KPI rows; stage chips; Shipping companies analysis; Batch shipping cost (SYP/USD quotes, totals, exchange rate); bulk bar (Confirm shipping, Out for delivery, Cancel, Cancel Shipments, Download Picking/Packing list, Waybills PDF, Print waybills); orders table with status cards
- **Observed issues:** V-034

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA081.1 | Bulk actions apply to selection or all eligible; counts in button label correct | Equal | P0 |
| PA081.2 | Cost block: USD inside, SYP only for carrier; exchange-rate unit | Consistent with settings (A-03) | P1 |
| PA081.3 | Picking list vs Packing list PDFs | Separate, per order (B17) | P1 |
| PA081.4 | Issues counter definition | Documented | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA082 — `/oms/returns/:id` — OMS return detail

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `082_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Tabs; Back; OR-number; status; Rollback buttons; Return details; Line items (return qty/received/put away)
- **Observed issues:** V-034

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA082.1 | Approve → receive → putaway stages separately; stock restock to planned location | Received/Put away numbers filled (V-034) | P0 |
| PA082.2 | Rollback buttons | State returns, finance reversed | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA083 — `/clients/:id` — Client detail

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `083_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Back; company card; information (email, phone, city, country, billing, address); summary; created/updated
- **Observed issues:** V-035

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA083.1 | Edit company data from here or list | Reachable | P0 |
| PA083.2 | Billing text "monthly · 30 days" | Matches on-demand model (V-035) | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA084 — `/billing/invoices/:id` — Invoice detail

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, finance, viewer  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `084_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Tabs; Back; header; Download PDF; Invoice info; Orders on this invoice (Edit invoice; Inbound / OMS tables with fulfillment, EMDAD shipping, carrier cost, margin); (storage, incentive, totals below)
- **Observed issues:** V-035

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA084.1 | Draft: all editable cells auto-save on blur; finalise locks | Spec acceptance 2,3,6 | P0 |
| PA084.2 | Edit invoice on finalised: logged in audit | Spec 7 | P1 |
| PA084.3 | Cancelled invoice still offers Edit invoice | Rule decided (A-17) | P1 |
| PA084.4 | Client view of same invoice hides carrier cost and margin | Spec 8 | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA085 — `/inventory/adjustments/:id` — Adjustment detail

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `085_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Tabs; Back; information (movement type, SKU, adjustment id, client, status, reason, warehouse); lines (before/after, lot id)
- **Observed issues:** V-035

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA085.1 | Approve/reject pending adjustment | Ledger on approve | P0 |
| PA085.2 | Lot shown as code not UUID | V-035 | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA086 — `/tasks/:id` — Task detail

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `086_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Only: Assigned worker, Assign worker select, Assign, Start
- **Observed issues:** V-036

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA086.1 | Task detail shows task type, order, lines, location, status, timestamps | Content present — currently page is blank apart from assignment (S2 candidate V-036) | P0 |
| PA086.2 | Assign worker then Start; worker sees task in /tasks/:id/execute | State machine | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA087 — `/locations/:warehouseId` — Warehouse locations (hierarchy)

- **Kind:** list → standard battery **LB-01…LB-24**
- **Roles allowed (rbac.ts):** super_admin, wh_manager, wh_operator, viewer, inventory_controller  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `087_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Header + counts; Warehouses Overview; + New location; Hierarchy Tree / Drill-down Table toggle; filters; Expand/Collapse all; tree table (Location, Type, Path, Barcode, Status, Capacity, row ⋯); pagination
- **Observed issues:** V-037

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA087.1 | Create aisle → rack → shelf → bin; types Storage/Packing/Receiving dock/Shipping dock | Path & barcode generated | P0 |
| PA087.2 | Deactivate location with stock | Blocked | P1 |
| PA087.3 | Header "10 location(s)" vs table "8 locations" | Counts consistent (V-037) | P1 |
| PA087.4 | Capacity column "—" | Editable or hidden | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

## PA088 — `/users/warehouse_users/:id` — User detail (negative: client user id on warehouse path)

- **Kind:** detail → standard battery **DB-01…DB-12**
- **Roles allowed (rbac.ts):** super_admin, wh_manager  · all other roles/anonymous must be refused (see `09`)
- **Screenshots:** `088_*.png` in desktop/laptop/tablet/mobile
- **Interactive elements seen:** Name/email header + red banner "This user does not belong on this list."
- **Observed issues:** V-038

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PA088.1 | Client user id opened under warehouse path | Generic error without exposing name/email (V-038) | P0 |
| PA088.2 | Valid warehouse user id | Detail with role, status, worker profile, activity; edit/deactivate | P1 |

Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).

---

## Pending states / dynamic routes (capture during execution, same battery rules)

| Route / state | Kind | Description | Battery |
|---|---|---|---|
| `/orders/inbound/:id/edit` | form | Edit inbound (draft/pending only) | FB-01…FB-25 |
| `/orders/outbound/:id/edit` | form | Edit outbound | FB-01…FB-25 |
| `/oms/cod/:id` | detail | COD detail | DB-01…DB-12 |
| `/oms/returns/:id/edit` | form | Return plan edit | FB-01…FB-25 |
| `/tasks/:id/execute` | form | Worker execution (pick/pack/putaway/receive) | FB-01…FB-25 |
| `/cycle-count/:id` | detail | Count detail | DB-01…DB-12 |
| `/cycle-count/:id/execute` | form | Count execution | FB-01…FB-25 |
| `/returns/:id` | detail | WMS return detail | DB-01…DB-12 |
| `/returns/:id/process` | form | WMS return processing | FB-01…FB-25 |
| `/inventory/product/:productId` | detail | Inventory product detail | DB-01…DB-12 |
| `/inventory/ledger/line/:ledgerId/:createdAt` | detail | Ledger entry | DB-01…DB-12 |
| `/inventory/ledger/:referenceType/:referenceId` | detail | Ledger by reference | DB-01…DB-12 |
| `/billing/plans/:clientId` | detail | Plan detail | DB-01…DB-12 |
| `/billing/plans/:clientId/edit` | form | Plan edit | FB-01…FB-25 |
| `/users/client_users/:id` | detail | Client user detail | DB-01…DB-12 |
| `/login` | auth | Admin login (+ forgot/reset) | AUTH-01…AUTH-20 |
| `/oms/batches (create)` | modal | Create batch modal | FB-01…FB-25 |
| `Bulk shipping modal` | modal | Bulk shipping processing | FB-01…FB-25 |
| `Create warehouse / location / adjustment / internal transfer / user / company / plan / template / schedule modals` | modal | All create/edit modals | FB-01…FB-25 |
| `Scan QR modals (OMS list/COD/Returns)` | modal | Camera/manual scan | FB-01…FB-25 |
| `Delete/cancel confirm dialogs (everywhere)` | modal | Confirm dialogs | FB-01…FB-25 |

## Redirect-only routes (RD-01 lands on target keeping query/state; RD-02 unknown role cannot use redirect to bypass RBAC)

- `/dashboard`
- `/inventory`
- `/adjustments`
- `/inbound`
- `/inbound/create`
- `/outbound`
- `/outbound/create`
- `/orders`
- `/orders/directed-outbound`
- `/directed-outbound`
- `/oms`
- `/contracts`
- `/reports (index)`
- `/reports/cod-report`
- `/reports/returns-report`
- `/reports/oms/cod`
- `/reports/oms/returns`
- `/billing`
- `/billing/invoices/new`
- `/users`
- `/finance`
- `/shipping`
- `/settings`
- `/settings/*`
- `/backups/upload`
- `/backups/restore`
- `/backups/factory-reset`
- `/backups/storage-policy`
- `/oms/orders/:id`
- `/oms/orders/:id/waybill`
- `*`
