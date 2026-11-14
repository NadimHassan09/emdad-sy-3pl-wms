#!/usr/bin/env python3
"""Generates docs/testing/04a-e2e-page-catalogue-admin.md and the admin half of 14-coverage-matrix data.
Run from repo root: python3 docs/testing/generated/gen_pages_admin.py
Data = what was SEEN in the screenshots (docs/testing/screenshots/staging-admin-frontend-screenshots) plus router.tsx / rbac.ts."""
import json, os, re

ALL = 'super_admin, wh_manager, wh_operator, finance, viewer, inventory_controller'
NOFIN = 'super_admin, wh_manager, wh_operator, viewer, inventory_controller'
ADM = 'super_admin, wh_manager'
FIN = 'super_admin, wh_manager, finance, viewer'
SA = 'super_admin'

# (seq, route, title, kind, roles, elements, specific cases [(title, expected)], issue refs)
P = []
def page(seq, route, title, kind, roles, elements, cases, issues=''):
    P.append(dict(seq=seq, route=route, title=title, kind=kind, roles=roles, el=elements, cases=cases, issues=issues))

page(1, '/dashboard/overview', 'Operations Overview (dashboard)', 'dashboard', ALL,
     'Greeting; Refresh; Export; filters (3 selects: warehouse/client/period 7D·30D·90D); cards Needs Attention (Resolve), Quick Actions (Orders, Tasks, Inbound, Outbound), Outbound Pipeline, Warehouse Tasks, Storage Utilization, Billing & Clients (links to plans), Recent Activity, Top Products by Movement; Restore (widget)',
     [('Every KPI equals the API/DB value (outbound pipeline per status, task counts, storage %, billing summary)', 'Numbers match `GET /dashboard/*` and SQL counts; no NaN/undefined'),
      ('7D/30D/90D switch re-queries and updates all widgets', 'Network call per switch; values change consistently; selected pill highlighted'),
      ('Needs-Attention "Resolve" opens the right target and the item disappears once resolved', 'Deep link goes to filtered list; item count decrements after fix'),
      ('Quick Actions open pre-filled create pages', 'Inbound/Outbound new pages load; Orders/Tasks open lists'),
      ('Realtime refresh: create an order in another session', 'Dashboard counters update without reload (realtime module)'),
      ('Per-role content: wh_operator, finance, viewer see only widgets allowed', 'Hidden widgets absent, not just empty'),
      ('Export button', 'File downloads with the displayed numbers'),
      ('Skeleton/loading and error state (API 500)', 'Friendly message, no raw JSON; retry button works')], 'V-001')
page(2, '/products', 'Products list', 'list', NOFIN,
     'Export Excel/CSV; New product; status cards (All 51/Active/Suspended/Archived); Search (product, client, SKU, barcode); Filter by client (searchable dropdown); Scan barcode; row actions; pagination',
     [('Create → edit → archive → restore a product (QA- prefix)', 'Status card counts move; ledger untouched'),
      ('Scan barcode control (camera + manual entry)', 'Opens scanner modal / accepts manual barcode and jumps to product'),
      ('Filter by client then search by SKU (AND semantics)', 'Intersection only'),
      ('Client dropdown search box resets after selection', 'No leftover text (UX-02)'),
      ('Product image column: missing image placeholder', 'Placeholder, no broken-image icon'),
      ('Export respects filters and includes Arabic names', 'Row count = filtered total')], 'V-002')
page(3, '/locations', 'Warehouse Locations (overview)', 'list', NOFIN,
     'Manage Warehouses; Reset; Apply filters; Advanced Filtering; search (code, name, city); status select; per-warehouse "Manage locations"; pagination',
     [('Manage locations opens `/locations/:warehouseId`', 'Correct warehouse'),
      ('Location counts column = locations in warehouse', 'Equals hierarchy count (see PA087)'), ('Reset button colour/semantics', 'Not red (V-003)')], 'V-003')
page(4, '/warehouses', 'Warehouses', 'list', NOFIN,
     '+ New warehouse (modal); Reset filters; Apply filters; Advanced Filtering; row actions Locations / Edit / Deactivate; pagination',
     [('Create warehouse (code unique, name, city, country) → appears → add first location immediately', 'Matches client request B5: auto-open locations'),
      ('Edit warehouse; Deactivate with stock inside', 'Blocked or warns when stock/locations exist'),
      ('Duplicate code', 'Field-level error'), ('Country shows full name not "Syr"/"EG"/"SA" codes', 'Consistent format (V-004)'),
      ('Status badge casing', 'Same casing as other pages')], 'V-004')
page(5, '/inventory/stock', 'Inventory — stock', 'list', ALL,
     'Tabs Stock/Ledger/Adjustments; Export Excel/CSV; status cards (All/In stock/Low/Out); filters; Show barcode; pagination',
     [('Available stock = on-hand − reserved − allocated for sampled products', 'Matches `GET /inventory/availability`'),
      ('Low-stock threshold card uses product min threshold', 'Counts equal filter results'),
      ('Show barcode toggles column / opens modal', 'Barcode printable'), ('Long Arabic product names wrap sensibly on mobile', 'No 5-line cells (V-005)')], 'V-005')
page(6, '/inventory/ledger', 'Inventory ledger', 'list', ALL,
     'Export; Reset/Apply filters; Advanced Filtering; movement type; date; pagination; row → ledger entry / reference pages',
     [('Append-only: no edit/delete affordance', 'None visible; API PUT/DELETE rejected'),
      ('Row click opens `/inventory/ledger/line/:id/:createdAt` and reference page', 'Correct entry; back keeps filters'),
      ('Ledger sum per product equals stock balance', 'Equal (SYS-INV)')], 'V-006')
page(7, '/inventory/adjustments', 'Stock adjustments', 'list', ALL,
     '+ New adjustment; filters; row actions; pagination; search = adjustment UUID',
     [('Create adjustment (increase/decrease) with reason, approve, check ledger + stock', 'Ledger row created once; stock changed once'),
      ('Decrease below zero', 'Rejected (stock never negative)'),
      ('Adjustment id is a human code, not raw UUID', 'Display code (V-007)'), ('Roles: only allowed roles see New adjustment', 'viewer cannot create')], 'V-007')
page(8, '/orders/inbound', 'Inbound orders', 'list', ALL,
     'Import; Export; + New inbound; status cards (All/Draft/Pending approval/Confirmed/In progress/Partially received/Completed/Cancelled); search; client + status selects; row checkbox; row actions; pagination',
     [('Status card counts equal list totals; sum = All', 'Equal'), ('Import template → import valid/invalid file', 'Row errors shown; valid rows created'),
      ('Order number never wraps (nowrap)', 'Single line on mobile (V-008)'), ('Expected arrival far-future date (2999) is rejected at create', 'Validation message'),
      ('Open row → detail; Cancel from row menu with confirm', 'Status Cancelled; no stock effect')], 'V-008')
page(9, '/orders/inbound/new', 'New inbound order', 'form', ALL,
     'General information (client select, expected date, notes); Products lines (search product, qty, remove, + Add line); Receiving dock; Putaway plan; Execution mode (Execute by Admin / Execute by Workers); Cancel; Save plan',
     [('Create with 1 line, Execute by Admin → detail shows plan', 'Order INB-… draft/pending per rules'),
      ('Execute by Workers → tasks generated after approval', 'Receiving tasks visible in /tasks'),
      ('Line qty 0/negative/decimal/1e9', 'Validation'), ('Same product twice', 'Merged or rejected consistently'),
      ('Client change clears product lines', 'Products belong to chosen client only'), ('Putaway plan only allows Storage-type locations of the chosen warehouse', 'Dropdown filtered'),
      ('Save plan twice quickly', 'One order')], 'V-009')
page(10, '/orders/outbound', 'Outbound orders', 'list', ALL,
     'Bulk Shipping Processing; Import; Export; + New outbound; status cards (All/Draft/Pending/Confirmed/Allocated/Picking/Packing/Shipped/Cancelled); checkboxes (eligible only); search; filters; pagination',
     [('Bulk Shipping Processing enabled only with eligible selection; opens modal', 'Disabled state explains why (V-010)'),
      ('Select-all selects eligible rows only', 'Counter = eligible count'), ('3,608 rows: pagination + chunk paging performance', 'List < 2 s, no N+1 (PERF)'),
      ('Row height on tablet/mobile', 'Compact rows (V-010)')], 'V-010')
page(11, '/orders/outbound/new', 'New outbound order', 'form', ALL,
     'General information; Products lines; Packing & dispatch (packing required checkbox, packing location, dispatch dock); Execute by Admin/Workers; Cancel; Save plan',
     [('Create with stock → allocation preview', 'Reservation created only on confirm'), ('Insufficient stock', 'Clear message with available qty'),
      ('Packing not required → packing location hidden', 'Conditional field'), ('Shipping method Shipping Company vs own delivery', 'Fields switch')], '')
page(12, '/orders/oms', 'OMS orders', 'list', ALL,
     'Import; Export CSV; Create OMS Order; Scan QR (Confirm/Approve/Ready to ship/Handover/Delivered/Failed delivery by QR); status cards (All 4,320 / Waiting for confirmation / Waiting for admin / Processing / Ready to ship / Out for delivery / Delivered / "Field Delivery" / Return pending receipt / Return received / Cancelled); filters + Advanced Filtering; group-by; checkboxes; row actions; copy buttons; contents column; pagination',
     [('Each status card filters correctly and totals = 4,320', 'Equal'), ('Card label "Field Delivery" is "Failed Delivery"', 'Correct wording (V-011)'),
      ('Scan QR accumulates many orders then bulk-transitions', 'Only valid transitions applied; invalid listed'),
      ('Group-by city/client/product/carrier/status (page-scoped)', 'Groups correct; documented limitation'),
      ('Copy buttons: address, name, phone, order number', 'Each copies exactly that value (client B19)'),
      ('Contents column shows items', 'Product × qty'), ('Import messy file (phones, Arabic letters, dates)', 'Tolerant parsing; row errors listed (B16/B22)'),
      ('Export CSV/Excel with analytics block', 'Branded Excel (owner #19)'), ('Row actions per status (confirm, approve, ship, cancel, edit)', 'Matrix in `05`')], 'V-011')
page(13, '/orders/oms/new', 'New OMS order (admin)', 'form', ALL,
     'Client select (starts empty, not Acme); recipient name; phone with country code 🇸🇾+963 and +/−; governorate/city/town selects (type-or-select); street address; map; payment type COD/prepaid; COD amount; required ship date; notes; products lines; Cancel; Submit for approval',
     [('Client select starts empty and does not auto-reset to "Acme Import" on mobile (B18)', 'Stays on chosen client'),
      ('Governorate → city → town dependent dropdowns; unknown neighbourhood typed by hand', 'Tolerant matching "Did you mean" (B11)'),
      ('Raqqa/Deir ez-Zor/Hasakah/Suwayda orders', 'Accepted; routed to non-Babel carriers or Manual (B10)'),
      ('Phone +963 / 09 / 00963 / Arabic digits', 'Normalised'), ('COD amount vs prepaid', 'COD field only when COD'),
      ('Map pin', 'Lat/long saved; tile seams not visible (V-012)'), ('Shipping fee group coverage missing for destination', 'Warning before confirm (owner #24)'),
      ('Double asterisk in "Street / Detailed Address **"', 'Single required marker (V-012)')], 'V-012')
page(14, '/oms/dashboard', 'OMS dashboard', 'dashboard', ALL,
     'Refresh dashboard; date filter; selects (2); Orders by status; Order summary; Orders trend; Recent orders table (links); Live activity',
     [('Totals equal `/orders/oms` counts for the same range', 'Equal'), ('Live activity updates via websocket', 'New event appears < 3 s'), ('Recent order link opens detail', 'Correct id')], '')
page(15, '/oms/batches', 'OMS batches', 'list', ALL,
     'KPI chips (All 14 / Active / With issues / Completed); Search; Open; pagination',
     [('Create batch from OMS list selection; batch appears here', 'Batch number BATCH-nnnn'), ('Issues chip = batches with ≥1 failing order', 'Definition documented (A-11)')], '')
page(16, '/oms/cod', 'OMS COD', 'list', ALL,
     'Status chips (All 806 / Pending / Available / Paid out / Returned) — values "—"; Client select; Export Excel/CSV/PDF; Pending/Available/Paid out/Returned by QR; "Set (n selected)"; filters; pagination',
     [('Status chips show counts, not "—"', 'Counts equal list (V-013)'), ('Mark Available/Paid out for selection', 'Only valid transitions; finance rows created'),
      ('Export PDF', 'Opens/downloads PDF with filtered rows'), ('COD amount currency', 'Per policy (A-03)')], 'V-013')
page(17, '/oms/returns', 'OMS returns', 'list', ALL,
     'Export; Confirm by Scan (QR); Create Return; Express Return; status chips (All 477 / Pending / Received / Rejected / Cancelled) — "—"; date from/to; filters; Rollback; Confirm; pagination',
     [('Create return for delivered order (qty ≤ delivered)', 'OR-… created'), ('Express return', 'Skips plan stages per rule (A-12)'), ('Rollback / Confirm per row', 'State machine respected'),
      ('Chips show counts', 'See V-013')], 'V-013')
page(18, '/contracts/grn', 'Goods receipt notes', 'list', ALL,
     'Reset/Apply filters; search; row Open PDF (EN/AR); Create PDF; pagination',
     [('Create PDF for completed inbound; open EN + AR', 'Both render, numbers match order'), ('Status Partial/Pending/Not generated meaning', 'Documented (A-13)')], 'V-014')
page(19, '/contracts/dn', 'Delivery notes', 'list', ALL, 'Same as GRN for outbound', [('Create/open DN PDFs EN+AR', 'Match shipped quantities')], 'V-014')
page(20, '/contracts/final-contract', 'Final contracts', 'list', ALL,
     '+ Create final contract; filters; Open PDF; Create PDF; actions',
     [('Create final contract for client; edit; PDF EN+AR', 'Issue date and client company shown'), ('Duplicate/overlap', 'Rule (A-14)')], '')
page(21, '/tasks', 'Warehouse tasks', 'list', NOFIN,
     'Filters (order number / task id, type, status); pagination; row → task detail',
     [('Tasks created after Execute-by-Workers approval', 'Pick/Pack/Receive/Putaway rows'), ('Assigned worker / start / end / duration columns', 'Duration = end − start')], '')
page(22, '/cycle-count', 'Cycle count', 'list', NOFIN, 'Tabs Count sessions/Product schedule; filters; table', [('Create session, assign, count, approve variance', 'Ledger adjustments only on approval')], 'V-015')
page(23, '/cycle-count/my-tasks', 'My cycle counts', 'list', NOFIN, 'Dashboard link; Manage warehouse users link', [('Admin without worker profile sees instruction text', 'No developer wording ("/auth/me includes workerId") (V-015)'), ('Worker sees own tasks only', 'Tenant/user scope')], 'V-015')
page(24, '/returns', 'WMS returns', 'list', NOFIN,
     '+ New return; status chips (All/Draft/Confirmed/Receiving/Inspecting/Completed/Cancelled); filters',
     [('Banner "Select a tenant company…" yet no selector → how does a super admin pick the tenant?', 'Selector present or list loads all (defect candidate V-016)'), ('Create return from outbound', 'Return lines ≤ shipped qty')], 'V-016')
page(25, '/internal', 'Internal transfer', 'list', NOFIN, 'Create Internal Transfer; table When/Client/Product/Lot/Qty/From→To/Ref',
     [('Transfer qty between two locations', 'Two ledger rows (out/in) same ref'), ('Same source/destination', 'Rejected'), ('FROM→TO shows location codes', 'Not "— → —" (V-017)')], 'V-017')
for i, (slug, name, extra) in enumerate([
    ('warehouse-analysis', 'Warehouse Analysis', 'List/Graph/Pivot; Bar/Line/Pie; date; client'),
    ('inventory', 'Inventory', 'List/Graph/Pivot; columns SKU, Product, Client, Location, Lot, Expiry, On hand, Reserved, Available, Status'),
    ('product-moves', 'Product Moves', 'columns Date, Product, SKU, Client, Movement, Status, Qty, Reference, Operator, Lot, From, To'),
    ('stock-aging', 'Stock Aging', 'Days idle, Aging bucket, Stagnant'), ('lot-expiry', 'Lot Expiry', 'Days until, Expiry bucket'),
    ('capacity-utilization', 'Capacity Utilization', 'Used/Reserved CBM, Utilization %'), ('return-rate', 'Return Rate', 'chart views'),
    ('revenue-by-client', 'Revenue by Client', 'chart views, currency'), ('receivables-aging', 'Receivables Aging', 'Invoice #, Days past due, Aging bucket'),
    ('worker-productivity', 'Worker Productivity', 'Worker, Completed, Avg cycle (h), Pick/pack'), ('order-cycle-time', 'Order Cycle Time', 'Cycle (h), Start, End'),
    ('inbound-accuracy', 'Inbound Accuracy', 'Discrepancies, Accuracy %'), ('outbound-fill-rate', 'Outbound Fill Rate', 'Requested, Picked, Fill rate, Short ship'),
    ('sla-compliance', 'SLA Compliance', 'chart views'), ('merchant-orders', 'Merchant Orders', 'Recipient, City, Payment, Allocation, Lines'),
    ('sales-report', 'Sales Report', 'Subtotal, Shipping, Total, Currency, Payment, Delivered'), ('delivery-report', 'Delivery Report', 'Carrier, Tracking, City, Out for delivery, Delivered'),
    ('allocation-report', 'Allocation Report', 'Reservations, Allocated'), ('inventory-reserved', 'Inventory Reserved', 'Order #, SKU, Location, Lot, Qty, Status')]):
    page(26 + i, f'/reports/{slug}', f'Report — {name}', 'report', ALL,
         f'Reporting Center tabs (19 reports, wrap on small screens); Filters; List/Graph/Pivot toggles; Export CSV / Export Excel (enabled after Generate); Generate; Reset/Apply filters; Advanced Filtering; sortable headers (↕); pagination. Specific: {extra}',
         [(f'{name}: Generate with default filters equals SQL for the same filter', 'Totals/rows identical to source query'), (f'{name}: Export CSV/Excel matches on-screen rows and filters', 'Same row count; UTF-8 Arabic ok')], 'V-018')
page(45, '/clients', 'Clients', 'list', ADM, '+ New company; search; row actions; pagination; Billing column',
     [('Create company → billing plan prompt', 'Validation of required fields (name, email, phone, country)'), ('Suspend client → client login refused', 'Client portal returns account-inactive page'),
      ('Row opens detail', 'Detail has edit shortcuts (V-019)')], 'V-019')
page(46, '/forms', 'Contact forms', 'list', ADM, 'Reset/Apply filters; search; Delete; pagination',
     [('Public form submission (`POST /forms/submit`) appears here', 'Fields saved; HTML escaped'), ('Delete with confirm', 'Row removed, audit row'), ('Long Arabic message truncation (RTL ellipsis)', 'Ellipsis on correct side (V-020)')], 'V-020')
page(47, '/finance/overview', 'Finance — overview', 'dashboard', FIN, 'Tabs: Overview/Client Accounts/Transactions/COD Management/Payouts/Carrier Costs/Float & Recon/Policies/Legacy Billing; Refresh; Recent Client Accounts; Recent Payout Requests; totals',
     [('Totals = sum of account balances / pending COD', 'Equal; currency label correct (A-03)'), ('Legacy Billing tab wording', 'Understandable to users (V-021)'), ('Finance title icon present', 'Icon rendered (V-021)')], 'V-021')
page(48, '/finance/accounts', 'Client current accounts', 'list', FIN, '+ Manual Adjustment; search by client; table (Current/Available balance, Pending COD, Payout locked, Status); Adjust; Statement',
     [('Manual adjustment credit then debit with reason', 'Append-only: two transactions, balance correct'), ('Statement opens/exports', 'Opening + movements = closing'), ('Available = Current − Pending COD − Payout locked', 'Formula holds (SYS-FIN)'),
      ('"$" prefix on SYP-origin amounts', 'Currency label correct (V-021)')], 'V-021')
page(49, '/finance/transactions', 'Financial transactions', 'list', FIN, 'Export Excel/CSV; filters (search, client, type, category, from, to); table TXN #, Date, Client, Type, Category, Amount, Reference, Description',
     [('No edit/delete', 'Append-only'), ('Filters combine', 'AND'), ('Raw category/reference keys displayed', 'Human labels (V-022)'), ('Export equals filtered rows', 'Equal')], 'V-022')
page(50, '/finance/cod', 'COD financial management', 'list', FIN, 'Search; status select; Confirm Collect; Confirm Remit; table Order, Client, COD amount, Status, Carrier collection, Carrier remittance, Client account',
     [('Confirm Collect then Confirm Remit on test order (Sena/Madino-Acme only, owner approved)', 'Client available balance increases per COD policy'), ('Remit twice', 'Idempotent, second rejected')], 'V-021')
page(51, '/finance/payouts', 'Payout management', 'list', FIN, 'Status select; table Payout #, Date, Client, Amount, Status, Bank details, Reference, Actions',
     [('Client requests payout (client portal) → appears → approve/reject/disburse', 'Ledger debit on disburse only; minimum payout 10 USD enforced'), ('Bank details masked', 'Not shown fully in logs')], 'V-021')
page(52, '/finance/carrier-costs', 'Carrier internal costs', 'list', FIN, 'Search AWB/order/tracking; provider select; payment status select; Mark Paid; table 337 rows; "Confidential" banner',
     [('Carrier cost column shows quote vs actual and "Pending Quote" meaning', 'Defined (A-04)'), ('Mark Paid changes status once', 'Idempotent'), ('Never reachable by client roles', 'RBAC 403')], 'V-023')
page(53, '/finance/float', 'Float & carrier reconciliation (B12)', 'settings', FIN, 'Provider code (free text), Float alert limit (5000), Refresh float; reconciliation textarea (AWB, amount, currency); Run reconciliation; disabled banner when module off',
     [('Module disabled by default → banner; enable in Policies → float shows in-transit cost', 'Equals Σ carrier cost of shipments not final'), ('Reconciliation: paste statement with match/mismatch/missing/duplicate AWB', 'Four categories reported'),
      ('Provider free text → dropdown', 'Only valid providers (V-024)')], 'V-024')
page(54, '/finance/policies', 'Financial policies & settings', 'settings', FIN, 'Cutover Active/Deactivate; COD availability policy (3 radio cards); Shipping fee recognition timing (At Dispatch / On Delivery); Minimum payout (auto-save on blur); B12 toggles (float, reconciliation, client shield); B15 liquidity (None/Float/Prep fee) + prep fee % + enable',
     [('Each policy persists after reload and writes an audit row', 'Yes'), ('Change COD policy affects only future events', 'Posted history unchanged (page banner)'), ('Deactivate Cutover asks confirmation', 'Confirm dialog (danger)'),
      ('Prep fee mode debits client when COD outstanding', 'Matches % × order value (A-05)'), ('Client shield ON hides gaps from client portal', 'Verify in client portal')], 'V-024')
page(55, '/users/custom-roles', 'Custom roles (O-11)', 'form', SA, 'Name, Description; 12 permission chips (oms/inbound/outbound/finance/inventory/users × read/write) toggling Denied/Allowed; Create custom role; roles list',
     [('Create role with some permissions → assign to a user → login → only allowed routes/actions', 'RBAC follows role'), ('Edit/delete role in use', 'Warn / block'), ('Duplicate name', 'Error'), ('Modules missing (billing, reports, shipping, returns, cycle count, settings)', 'Intentional? (A-06)')], 'V-024')
page(56, '/billing/dashboard', 'Billing dashboard', 'dashboard', FIN, 'Tabs Dashboard/Plans/Invoices; widgets Expiring in 30/14/7/3 days; Billing cycles expiring soon (Renew); Overdue clients; Recent invoices; Suspended accounts',
     [('Legacy cycle widgets vs on-demand model', 'Hidden or explained (A-07)'), ('Renew action', 'Works or removed'), ('Overdue clients list equals unpaid invoices past due', 'Equal')], 'V-025')
page(57, '/billing/plans', 'Billing plans', 'list', FIN, 'Create plan template; + Create plan; search client; filters; table Client, Remaining days, Reserved volume, Price, Billing cycle, Current cycle, Status, Auto renewal; actions',
     [('Plan per client; edit; detail', 'Charge rules link'), ('Remaining days for retired cycles', 'Meaningful'), ('Disable auto-renewal restricts client', 'Per text')], 'V-025')
page(58, '/billing/plans/new', 'Create billing plan', 'form', FIN, 'Client (clients without plan), Plan mode (Custom/Template), Reserved volume m³*, Fixed plan price USD*, Inbound order price, Outbound order price, Billing cycle days*, Auto-renewal checkbox; Cancel (red); Create plan',
     [('Create custom plan; template plan', 'Plan appears; values stored in USD'), ('Numeric fields prefilled "0" — type directly', 'Select-all on focus (UX-04)'), ('Negative price / 0 cycle / huge volume', 'Validation'), ('Client without plan only', 'Dropdown excludes clients with plan')], 'V-025')
page(59, '/billing/templates', 'Plan templates', 'list', FIN, '+ Create template; search; Reset (red)/Apply; empty state "No plan templates yet."',
     [('Create/edit/disable template; use in plan', 'Template price flows to plan'), ('Empty state', 'Has call-to-action')], 'V-025')
page(60, '/billing/invoices', 'Invoices', 'list', FIN, 'Export Excel/CSV; Charge rules; New on-demand invoice; search; Advanced filtering; table Invoice number, Client, Period, Amount ("205 USD"), Issue, Due, Status; row menu; "Click a row to view"',
     [('Status filter: Draft/Unpaid/Paid/Cancelled', 'Correct'), ('Amount format consistent with finance ("$")', 'Same formatting (V-026)'), ('Row actions: finalise, mark paid, settle from balance, cancel', 'Each writes finance rows once (see 05)'), ('Export', 'Equals filtered rows')], 'V-026')
page(61, '/billing/invoices/on-demand', 'New on-demand invoice', 'form', FIN, 'Client select; From/To dates; checkboxes (Inbound, Outbound, Online (OMS), Shipping fees, Storage); link "charge rules"; Preview; Calculate storage; Check incentive',
     [('Preview for client/period: orders table (inbound/outbound/OMS) with editable fulfillment, EMDAD shipping fee, carrier cost', 'Spec `INVOICE_REDESIGN_SPEC.md` acceptance 1–8'), ('Calculate storage: CBM × $10/m³; missing dimensions warning', 'Spec `BILLING_AUTOMATION_SPEC.md` §1'),
      ('Check incentive: 499 no / 500 yes / 501 yes → −20 % of fulfillment', 'Spec §2'), ('Orders already on another invoice are skipped', 'Not double billed'), ('OMS outbound counted once', 'Owner #7'),
      ('Buttons disabled until client chosen — hint text', 'Tooltip/label (V-026)')], 'V-026')
page(62, '/billing/charge-rules', 'Charge rules', 'form', FIN, 'Client select; per-client optional charge toggles; save', [('Disable "storage" for a client → on-demand preview excludes storage', 'Excluded'), ('Rules persist and audit', 'Yes')], 'V-026')
page(63, '/users/warehouse_users', 'Warehouse users', 'list', ADM, 'Tabs Warehouse users/Client users/Custom roles; + New user; search; table Name, Phone, Role, Status, Worker profile, Last login, Activity; row actions',
     [('Create user each role (wh_manager, wh_operator, finance(accountant), viewer, inventory_controller)', 'Role-based nav differs'), ('Deactivate user → session ends, login refused', 'Even via Google sign-in'), ('Password reset by admin', 'Never displays password'), ('Worker profile creation', 'Appears in task assignment select')], 'V-027')
page(64, '/users/client_users', 'Client users', 'list', ADM, '+ New user; search; Company column; Worker profile column (irrelevant)',
     [('Create client_admin / client_staff; link company', 'Login to client portal works with correct scope'), ('Worker profile column removed for clients', 'Hidden (V-027)')], 'V-027')
page(65, '/audit-logs', 'Audit logs', 'list', FIN, 'Export CSV; search; Advanced Filtering; table Timestamp, Actor, Role, Company, Action, Resource, Summary, Status, Details(View); retention line',
     [('Perform 10 audited actions → rows appear with correct actor/resource/before-after', 'Yes'), ('"AUTH REFRESH REPLAY IDEMPOTENT" noise', 'Filtered/aggregated or explained (V-028)'), ('Export limits (500 rows / 90 d)', 'Message when truncated'), ('View → diff JSON', 'No secrets in before/after (SEC)')], 'V-028')
page(66, '/notifications', 'Notifications', 'list', ALL, 'All/Unread/Read tabs; Mark all read; list; pagination; bell badge (51)',
     [('Mark one read / all read', 'Badge decrements'), ('Billing-cycle notifications for retired cycles', 'Not generated (A-07)'), ('Click notification opens target', 'Deep link'), ('Realtime new notification', 'Badge increments')], 'V-028')
page(67, '/profile', 'Profile', 'form', ALL, 'Photo Change/Remove; Personal details (full name) Save; Change password (current/new/confirm) Update; cards Notifications/Backups; (Google link hidden)',
     [('Change name; change password (policy ≥ 8 chars, wrong current, mismatch)', 'Messages; old password stops working'), ('Photo upload type/size', 'jpeg/png ≤ limit; bad file rejected'), ('"Auth group" wording', 'Understandable (V-029)')], 'V-029')
page(68, '/backups', 'Backups overview', 'dashboard', ADM, 'Tabs Overview/Scheduled/Retention/Health; Restore; Factory Reset; Upload; Create Backup; health card; KPI cards; filters; table; Manual backup cooldown (minutes) Save; Activity; Storage overview donut',
     [('Create backup (cooldown honoured)', 'Completed; file size >0; listed'), ('Download with token (public route `GET /backups/:id/download?token=`)', 'Token expiry/one-use enforced (SEC)'), ('Restore on staging copy only with owner approval', 'N/A unless approved'),
      ('Factory Reset guard', 'Typed phrase + role + cooldown; never executed in tests'), ('Header buttons overlap tabs on tablet/mobile', 'No overlap (V-030)')], 'V-030')
page(69, '/backups/schedules', 'Backup schedules', 'list', ADM, 'Create schedule; table Frequency, Time, Retention days, Storage policy, Enabled, Last run, Next run; Edit; Disable', [('Create daily schedule; next run correct; disable', 'Cron registered/unregistered')], 'V-030')
page(70, '/backups/retention', 'Backup retention', 'settings', ADM, 'Policy cards Daily 7 / Weekly 4 / Monthly 12 / Pre-snapshot 7; cleanup preview; Run local retention cleanup (danger)', [('Preview numbers = what cleanup would delete', 'Equal'), ('Run cleanup (on QA backups only)', 'Confirm; deletes exactly preview candidates')], 'V-030')
page(71, '/backups/health', 'Backup health', 'dashboard', ADM, 'Health status; last success/failure; count; storage; next scheduled; metrics; Evaluate alerts now; events table', [('Health status vs critical event contradiction', 'Consistent (V-030)'), ('Evaluate alerts now', 'Creates/clears events')], 'V-030')
page(72, '/backups/google-drive', 'Backup — Google Drive (hidden UI)', 'redirect', ADM, 'Renders backups overview (UI hidden by owner until OAuth publish)', [('Direct URL', 'No Drive controls visible; no error')], 'V-030')
page(73, '/backups/google-oauth-settings', 'Google OAuth settings (hidden UI)', 'redirect', SA, 'Renders backups overview (hidden)', [('Direct URL', 'Hidden by default; documented in GOOGLE_AUTH_UI_HIDDEN.md')], 'V-030')
page(74, '/shipping/companies', 'Shipping companies & exchange rates', 'settings', ADM, 'Sections: Exchange rates (manual rate, hours, stale limit, min change %, built-in vs custom HTTPS JSON API, Test source), Pickup address (contact, phone, city, district, street, lat/long, Save), per-carrier cards (Babel, Delivery Joud, Sila, Fatih, Sena): Test connection, Disconnect, Register webhook, Configure Webhook Secret',
     [('Manual rate save → active rate/cache changes; invalid (0, negative, text)', 'Rejected'), ('Custom API: http rejected, https test OK', 'As documented (I-12)'), ('Pickup address save → used on waybills/carrier create', 'Reflected'), ('Test connection per carrier (read-only)', 'Pass/fail message; no data created'),
      ('Register webhook (Sila) idempotent', 'Registered id shown'), ('Secrets never displayed (masked)', 'Masked after save'), ('Page has no H1 title; breadcrumb label wrong', 'Title present (V-031)'), ('Manual rate 120 vs active 130.01', 'UI states which one is used (A-08)')], 'V-031')
page(75, '/shipping/fee-rates', 'Shipping fee rates', 'list', ADM, 'Client select; summary cards (rate groups, governorates covered, cities); Rate groups table (edit ✎, pause/play); Add rate group; Test a delivery price; Global weight & currency settings',
     [('Create group (governorates/cities), weight policy; most specific location wins', 'Test price tool returns correct group'), ('Empty groups (no destinations) active', 'Warning or block (A-09)'), ('Uncovered governorates warning', 'Listed before confirm'), ('Icon-only action buttons have tooltips', 'Yes (a11y)')], 'V-031')
# detail pages
page(76, '/products/:sku', 'Product detail', 'detail', NOFIN, 'Back; product card (name, SKU, status, client); information grid (client, SKU, barcode, UoM, tracking, on-hand/reserved, min stock threshold, stock health, dimensions, weight); summary', [('Edit/archive from detail', 'Controls exist for allowed roles (V-032)'), ('Dimensions missing → warns that storage fee cannot be computed', 'Visible hint (A-10)'), ('Unknown SKU', '404 page')], 'V-032')
page(77, '/orders/inbound/:id', 'Inbound order detail', 'detail', ALL, 'Back; status; Print instructions; Order details; Line items (expected/received); Warehouse plan; GRN card (PDF EN/AR)', [('Receive/putaway/complete actions per status (draft…completed)', 'Matrix in 05'), ('Link to OMS order that consumed this inbound (B3 traceability)', 'Reverse link present (A-15)'), ('GRN PDF EN/AR open', 'Numbers = lines')], 'V-033')
page(78, '/orders/outbound/:id', 'Outbound order detail', 'detail', ALL, 'Back; status; Print instructions; Order details; Linked OMS; Shipping details (carrier shipment created banner + Mark Shipping Details as Complete); destination; lines; actions', [('Complete stages: approve → allocate → pick → pack → ship (admin execution)', 'Stock ledger −qty once'), ('Mark Shipping Details complete only after carrier shipment', 'Button logic'), ('Shipping company code shown as name', 'Human name (V-033)')], 'V-033')
page(79, '/orders/oms/:id', 'OMS order detail', 'detail', ALL, 'Back; title; status chip; header actions (Waybill, Cancel Shipment, Cancel order, Edit shipping fee, Open outbound); Recipient & shipping (Copy shipment info); Line items; Inbound traceability; Notes; Returns; side cards Order details + Pricing & COD (client shipping rate Edit, carrier quote, actual carrier cost, subtotal, COD)',
     [('Edit shipping fee (client-facing) writes through to invoice/finance', 'Updated everywhere'), ('Carrier cost correction (adjust-carrier-cost, internal)', 'Audit event; invoice margin updates'), ('Cancel Shipment vs Cancel order semantics', 'Distinct, confirmed'), ('Inbound traceability links to INB orders', 'Correct'),
      ('Title "OMS OMS-…" and raw "waiting_for_shipping_details"', 'Fixed (V-034)'), ('Super-admin edit after delivery shows local-only warning', 'EN+AR warning (B9/B14)')], 'V-034')
page(80, '/orders/oms/:id/waybill', 'OMS waybill (print)', 'detail', ALL, 'Tabs; Back; label size chip 10×15 cm; English toggle; PDF download; Print; label with 2 QR codes, sender, recipient, notes, payment/COD/fee, contents', [('Print to PDF at 10×15 cm', 'One page, QR scannable'), ('English toggle', 'Label switches language'), ('Batch waybills PDF/Excel from batch page', 'All orders included'), ('Sender block source', 'Warehouse pickup address (A-16)')], 'V-034')
page(81, '/oms/batches/:id', 'OMS batch detail', 'detail', ALL, 'Title BATCH-n; KPI rows; stage chips; Shipping companies analysis; Batch shipping cost (SYP/USD quotes, totals, exchange rate); bulk bar (Confirm shipping, Out for delivery, Cancel, Cancel Shipments, Download Picking/Packing list, Waybills PDF, Print waybills); orders table with status cards',
     [('Bulk actions apply to selection or all eligible; counts in button label correct', 'Equal'), ('Cost block: USD inside, SYP only for carrier; exchange-rate unit', 'Consistent with settings (A-03)'), ('Picking list vs Packing list PDFs', 'Separate, per order (B17)'), ('Issues counter definition', 'Documented')], 'V-034')
page(82, '/oms/returns/:id', 'OMS return detail', 'detail', ALL, 'Tabs; Back; OR-number; status; Rollback buttons; Return details; Line items (return qty/received/put away)', [('Approve → receive → putaway stages separately; stock restock to planned location', 'Received/Put away numbers filled (V-034)'), ('Rollback buttons', 'State returns, finance reversed')], 'V-034')
page(83, '/clients/:id', 'Client detail', 'detail', ADM, 'Back; company card; information (email, phone, city, country, billing, address); summary; created/updated', [('Edit company data from here or list', 'Reachable'), ('Billing text "monthly · 30 days"', 'Matches on-demand model (V-035)')], 'V-035')
page(84, '/billing/invoices/:id', 'Invoice detail', 'detail', FIN, 'Tabs; Back; header; Download PDF; Invoice info; Orders on this invoice (Edit invoice; Inbound / OMS tables with fulfillment, EMDAD shipping, carrier cost, margin); (storage, incentive, totals below)',
     [('Draft: all editable cells auto-save on blur; finalise locks', 'Spec acceptance 2,3,6'), ('Edit invoice on finalised: logged in audit', 'Spec 7'), ('Cancelled invoice still offers Edit invoice', 'Rule decided (A-17)'), ('Client view of same invoice hides carrier cost and margin', 'Spec 8')], 'V-035')
page(85, '/inventory/adjustments/:id', 'Adjustment detail', 'detail', ALL, 'Tabs; Back; information (movement type, SKU, adjustment id, client, status, reason, warehouse); lines (before/after, lot id)', [('Approve/reject pending adjustment', 'Ledger on approve'), ('Lot shown as code not UUID', 'V-035')], 'V-035')
page(86, '/tasks/:id', 'Task detail', 'detail', NOFIN, 'Only: Assigned worker, Assign worker select, Assign, Start', [('Task detail shows task type, order, lines, location, status, timestamps', 'Content present — currently page is blank apart from assignment (S2 candidate V-036)'), ('Assign worker then Start; worker sees task in /tasks/:id/execute', 'State machine')], 'V-036')
page(87, '/locations/:warehouseId', 'Warehouse locations (hierarchy)', 'list', NOFIN, 'Header + counts; Warehouses Overview; + New location; Hierarchy Tree / Drill-down Table toggle; filters; Expand/Collapse all; tree table (Location, Type, Path, Barcode, Status, Capacity, row ⋯); pagination',
     [('Create aisle → rack → shelf → bin; types Storage/Packing/Receiving dock/Shipping dock', 'Path & barcode generated'), ('Deactivate location with stock', 'Blocked'), ('Header "10 location(s)" vs table "8 locations"', 'Counts consistent (V-037)'), ('Capacity column "—"', 'Editable or hidden')], 'V-037')
page(88, '/users/warehouse_users/:id', 'User detail (negative: client user id on warehouse path)', 'detail', ADM, 'Name/email header + red banner "This user does not belong on this list."', [('Client user id opened under warehouse path', 'Generic error without exposing name/email (V-038)'), ('Valid warehouse user id', 'Detail with role, status, worker profile, activity; edit/deactivate')], 'V-038')

# routes with no screenshot yet (documented, to be captured when data/state exists)
PENDING = [
 ('/orders/inbound/:id/edit', 'form', 'Edit inbound (draft/pending only)'), ('/orders/outbound/:id/edit', 'form', 'Edit outbound'), ('/oms/cod/:id', 'detail', 'COD detail'),
 ('/oms/returns/:id/edit', 'form', 'Return plan edit'), ('/tasks/:id/execute', 'form', 'Worker execution (pick/pack/putaway/receive)'), ('/cycle-count/:id', 'detail', 'Count detail'),
 ('/cycle-count/:id/execute', 'form', 'Count execution'), ('/returns/:id', 'detail', 'WMS return detail'), ('/returns/:id/process', 'form', 'WMS return processing'),
 ('/inventory/product/:productId', 'detail', 'Inventory product detail'), ('/inventory/ledger/line/:ledgerId/:createdAt', 'detail', 'Ledger entry'), ('/inventory/ledger/:referenceType/:referenceId', 'detail', 'Ledger by reference'),
 ('/billing/plans/:clientId', 'detail', 'Plan detail'), ('/billing/plans/:clientId/edit', 'form', 'Plan edit'), ('/users/client_users/:id', 'detail', 'Client user detail'), ('/login', 'auth', 'Admin login (+ forgot/reset)'),
 ('/oms/batches (create)', 'modal', 'Create batch modal'), ('Bulk shipping modal', 'modal', 'Bulk shipping processing'), ('Create warehouse / location / adjustment / internal transfer / user / company / plan / template / schedule modals', 'modal', 'All create/edit modals'),
 ('Scan QR modals (OMS list/COD/Returns)', 'modal', 'Camera/manual scan'), ('Delete/cancel confirm dialogs (everywhere)', 'modal', 'Confirm dialogs'),
]
REDIRECTS = ['/dashboard', '/inventory', '/adjustments', '/inbound', '/inbound/create', '/outbound', '/outbound/create', '/orders', '/orders/directed-outbound', '/directed-outbound', '/oms', '/contracts', '/reports (index)', '/reports/cod-report', '/reports/returns-report', '/reports/oms/cod', '/reports/oms/returns', '/billing', '/billing/invoices/new', '/users', '/finance', '/shipping', '/settings', '/settings/*', '/backups/upload', '/backups/restore', '/backups/factory-reset', '/backups/storage-policy', '/oms/orders/:id', '/oms/orders/:id/waybill', '*']

BATT = {'list': 'LB-01…LB-24', 'form': 'FB-01…FB-25', 'detail': 'DB-01…DB-12', 'report': 'RB-01…RB-14', 'settings': 'SB-01…SB-10', 'dashboard': 'DASH-01…DASH-08', 'redirect': 'RD-01…RD-02', 'auth': 'AUTH-01…AUTH-20'}

def shot(seq):
    return f'`{seq:03d}_*.png` in desktop/laptop/tablet/mobile'

out = ['# 04a — Admin portal page catalogue', '',
       'One section per page. **Every page is tested with its standard battery (defined in `04-e2e-testing.md` §Batteries) on 4 devices + the page-specific cases below.**',
       'Screenshots: `docs/testing/screenshots/staging-admin-frontend-screenshots/<device>/<seq>_<route>.png` (index: `index.json`). `Vnnn` refers to `16-observed-issues-during-capture.md`.', '',
       f'Pages captured: **{len(P)}** · Pending states/modals: **{len(PENDING)}** · Redirect-only routes: **{len(REDIRECTS)}**', '',
       '| Seq | Route | Kind | Battery | Roles allowed | Cases |', '|---|---|---|---|---|---|']
for p in P:
    out.append(f"| {p['seq']:03d} | `{p['route']}` | {p['kind']} | {BATT[p['kind']]} | {p['roles'].replace('super_admin','SA').replace('wh_manager','WM').replace('wh_operator','WO').replace('finance','FIN').replace('viewer','VW').replace('inventory_controller','IC')} | {len(p['cases'])} |")
out += ['', '---', '']
for p in P:
    out += [f"## PA{p['seq']:03d} — `{p['route']}` — {p['title']}", '',
            f"- **Kind:** {p['kind']} → standard battery **{BATT[p['kind']]}**",
            f"- **Roles allowed (rbac.ts):** {p['roles']}  · all other roles/anonymous must be refused (see `09`)",
            f"- **Screenshots:** {shot(p['seq'])}",
            f"- **Interactive elements seen:** {p['el']}",
            f"- **Observed issues:** {p['issues'] or '—'}", '',
            '| ID | Page-specific case | Expected | Pri |', '|---|---|---|---|']
    for i, (t, e) in enumerate(p['cases'], 1):
        out.append(f"| PA{p['seq']:03d}.{i} | {t} | {e} | {'P0' if i == 1 else 'P1'} |")
    out += ['', 'Run on: desktop, laptop, tablet, mobile · EN + AR · light + dark. Evidence: screenshot per state (default, filled, error, success, empty).', '']
out += ['---', '', '## Pending states / dynamic routes (capture during execution, same battery rules)', '', '| Route / state | Kind | Description | Battery |', '|---|---|---|---|']
for r, k, d in PENDING:
    out.append(f'| `{r}` | {k} | {d} | {BATT.get(k, "FB-01…FB-25")} |')
out += ['', '## Redirect-only routes (RD-01 lands on target keeping query/state; RD-02 unknown role cannot use redirect to bypass RBAC)', '']
out += [f'- `{r}`' for r in REDIRECTS]
open('docs/testing/04a-e2e-page-catalogue-admin.md', 'w').write('\n'.join(out) + '\n')
json.dump([dict(seq=p['seq'], route=p['route'], kind=p['kind'], cases=len(p['cases'])) for p in P], open('docs/testing/generated/pages_admin.json', 'w'))
print(len(P), 'pages,', sum(len(p['cases']) for p in P), 'specific cases')
