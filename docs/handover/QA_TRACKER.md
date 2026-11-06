# EMDAD QA Tracker

Status: ⬜ not started · 🔄 in progress · ✅ passed · ❌ defect open (see ID) · ⛔ blocked · ➖ n/a
One row per route. Defects are logged below with ID, severity (S1 blocker, S2 major, S3 minor, S4 cosmetic), evidence and fix commit.

## Admin portal (staging-admin.emdadsy.com) — roles: super_admin, wh_manager, wh_operator

| Route | Functional | Validation/edge | Roles | Consistency | Mobile | Notes |
|---|---|---|---|---|---|---|
| `/audit-logs` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/backups` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/backups/health` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/backups/retention` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/backups/schedules` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/billing/dashboard` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/billing/invoices` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/billing/invoices/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/plans` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/billing/plans/:clientId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/plans/:clientId/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/plans/new` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/billing/templates` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/clients` | 🔄 | 🔄 | ⬜ | ⬜ | ⬜ | Load + New company required-field messages (3 Nov) |
| `/clients/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/contracts/dn` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/contracts/final-contract` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/contracts/grn` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/cycle-count` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load check only (3 Nov smoke pass) |
| `/cycle-count/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cycle-count/:id/execute` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cycle-count/my-tasks` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/dashboard/overview` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load check only (3 Nov smoke pass) |
| `/finance/accounts` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/finance/carrier-costs` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/finance/cod` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/finance/overview` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/finance/payouts` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/finance/policies` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/finance/transactions` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/forms` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/internal` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/inventory/adjustments` | ✅ | ✅ | ⬜ | ⬜ | ⬜ | Create draft, add lines (9 validation cases), reason gate, approve, approve twice; D-030 |
| `/inventory/adjustments/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/ledger/:referenceType/:referenceId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/ledger/line/:ledgerId/:createdAt` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/product/:productId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/stock` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Stock rows read through API after receive/transfer/adjust; ledger reconciles per product (49/49) |
| `/locations` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load check only (3 Nov smoke pass) |
| `/locations/:warehouseId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/notifications` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/oms/batches` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/oms/batches/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/cod` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/oms/cod/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/dashboard` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/oms/orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/orders/:id/waybill` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/returns` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/oms/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/returns/:id/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/inbound` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load + created orders appear |
| `/orders/inbound/:id` | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Approve, receive (auto from plan), putaway, GRN PDF; Change putaway locations during putaway (D-029) |
| `/orders/inbound/:id/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/inbound/new` | ✅ | ✅ | ⬜ | ⬜ | ⬜ | Created through the UI: client, product, dock, putaway split, required-field message; API field sweep (qty, dates, lot, duplicates); D-028, D-031 |
| `/orders/oms` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load check only (3 Nov smoke pass) |
| `/orders/oms/:id` | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Cancel order, Cancel shipment (API and manual), carrier switch |
| `/orders/oms/:id/waybill` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/oms/new` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Form opened; orders created through the API for E2E |
| `/orders/outbound` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/orders/outbound/:id` | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Execution flow end to end (approve, pick, pack, shipping method, carrier send, cancel/unlink); D-019, D-021 |
| `/orders/outbound/:id/edit` | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan saved (packing location + dock) |
| `/orders/outbound/new` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/products` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/products/:sku` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/profile` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/allocation-report` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/capacity-utilization` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/cod-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/reports/delivery-report` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/inbound-accuracy` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/inventory` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/inventory-reserved` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/lot-expiry` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/merchant-orders` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/oms/cod` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/reports/oms/returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/reports/order-cycle-time` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/outbound-fill-rate` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/product-moves` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/receivables-aging` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/return-rate` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/returns-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/reports/revenue-by-client` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/sales-report` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/sla-compliance` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/stock-aging` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/warehouse-analysis` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/reports/worker-productivity` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/returns` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load check only (3 Nov smoke pass) |
| `/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/returns/:id/process` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/shipping/companies` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/shipping/fee-rates` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/tasks` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load check only (3 Nov smoke pass) |
| `/tasks/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/tasks/:id/execute` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users/client_users` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/users/client_users/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users/warehouse_users` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov: no API error, no console error, no crash |
| `/users/warehouse_users/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/warehouses` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load check only (3 Nov smoke pass) |

Aliases (redirect-only routes such as `/dashboard`, `/outbound`, `/inventory`, `/settings/*`) are not listed; they are covered once by X16 in `QA_FLOWS.md`.

## Client portal (staging-client.emdadsy.com) — roles: client_admin, client_staff

| Route | Functional | Validation/edge | Roles/tenant | Consistency vs Admin | Mobile | Notes |
|---|---|---|---|---|---|---|
| `/login` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |  |
| `/account-inactive` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |  |
| `/dashboard` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/products` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/products/new` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/products/:id/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |  |
| `/products/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |  |
| `/inbound-orders` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/inbound-orders/new` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/inbound-orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |  |
| `/outbound-orders` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/outbound-orders/new` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/outbound-orders/returns` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/outbound-orders/returns/new` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/outbound-orders/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |  |
| `/outbound-orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |  |
| `/ecommerce-orders` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/ecommerce-orders/new` | 🔄 | 🔄 | 🔄 | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/ecommerce-orders/returns` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/ecommerce-orders/returns/new` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/ecommerce-orders/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |  |
| `/ecommerce-orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |  |
| `/my-profits` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/finances` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/billing` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/invoices` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/invoices/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |  |
| `/apis` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/notifications` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |
| `/profile` | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | Load sweep 3 Nov (Acme client_admin): no API error, no console error |

Aliases (`/cod-reports`, `/returns`, `/returns/new`, `/returns/:id`, `/billing/invoices/:id`) redirect and are covered by X16.

## Carrier end-to-end matrix

| Scenario | Sena (sandbox) | Babel (live) | Sila (live) | Delivery Joud |
|---|---|---|---|---|
| Quote vs create price | ⚠ quote 0 (sandbox, now never BEST) | ✅ 300 SYP = portal 300 SYP | ✅ $2.50 = portal 2.5 $ | ⬜ |
| Create payload accepted (name, phone, address, COD, weight) | ✅ SYP COD only | ⚠ accepted; portal shows dimensions 0x0x0 (D-020) | ✅ name, phone, address, 0 COD, weight | ⬜ |
| Coverage: offered only if address supported | ⬜ | ⬜ | ⬜ | ⬜ |
| Currency / COD min-max rules | ✅ SYP only | ⬜ min 1000 SYP not applied | ⬜ | ⬜ |
| Tracking updates reach EMDAD (poll) | ✅ | ⬜ | ⬜ | ⬜ |
| Webhook update (valid / invalid signature / duplicate) | ✅ valid (~8 s) | ⬜ | ⬜ | ⬜ |
| Client sees same tracking | ⬜ | ⬜ | ⬜ | ⬜ |
| Cancel from EMDAD reflected at carrier | ⬜ | ⚠ API cancel unsupported; EMDAD says so and offers local unlink; portal delete done by hand | ✅ API cancel; portal shows ملغي | ⬜ |
| Cancel at carrier reflected in EMDAD | ⬜ | ⚠ detected as "not found, cancellation unconfirmed"; admin confirms locally (D-021) | ⬜ | ⬜ |
| Change carrier (supersede) and replacement shipment | ⬜ | ✅ Babel to Sila on the same order (3 Nov) | ✅ | ⬜ |
| Edit order info / price after shipment | ⬜ | ⬜ | ⬜ | ⬜ |
| Waybill / barcode print | ⬜ | ⬜ | ⬜ | ⬜ |
| Failure and timeout handling | ⬜ | ⬜ | ⬜ | ⬜ |
| Return flow | ⬜ | ⬜ | ⬜ | ⬜ |

## Defect log

| ID | Sev | Area | Summary | Evidence | Status | Fix commit |
|---|---|---|---|---|---|---|
| D-001 | S2 | Admin/Products,Inbound,Outbound | First client auto-selected after field cleared (Acme) | Staging UI check 2 Nov | Fixed, desktop verified | fe1cfc87 |
| D-002 | S2 | Admin/Bulk shipping | Carrier with no quote selectable per order | Code review 2 Nov | Fixed, UI not yet verified | a7999e3d |
| D-003 | S3 | Data | Hierarchy has CRLF in a city key and 13 neighbourhoods with trailing spaces | JSON scan | Fixed (trailing spaces in 725c65b67; no CRLF found on 6 Nov re-scan) | 725c65b67 |
| D-005 | S3 | Products media | Two product images return 404 (`/api/client/media/products/f6fab62a…/a1cc3880…webp`, `…/3e2bbf4c…webp`): DB references files that are missing | Network log, staging admin Products page, 3 Nov | Fixed: image_path cleared in staging DB for the two products (Compressed Cotton Quilt Bag, Circulating Fan); files are unrecoverable | staging DB 6 Nov |
| D-006 | S3 | Shipping rates UX | Babel rate error shown to staff is a technical message ("calculatePrice was not sent: the request has no neighbourhood id and no coordinates") when the address has no neighbourhood | API response 3 Nov | Fixed (message mapped), staging rebuilt | see git log |
| D-007 | S3 | Test data | ~100 PICKBENCH benchmark orders and Sena test orders mixed in the OMS list (5,811 orders) | OMS list 3 Nov | Open (hygiene) | |
| D-008 | S2 | Sena quotes | For any address (tested Idlib, Aleppo) Sena is offered with zone "المركز الرئيسي - الكسوة", price 0 SYP, and gets the BEST/recommended badge. Cause: `matchSenaZone` falls back to `zones[0]` when nothing matches (a unit test asserts this) and `createShipment` falls back to zone id 1; sandbox returns one zone with price 0 | Rates API + bulk modal, 3 Nov | Fixed per owner decision (hide Sena when no zone matches and several zones exist; single-zone merchants unchanged; create no longer falls back to zone 1). Sandbox has one zone so it still shows; multi-zone behaviour covered by unit tests, live zone list not yet inspected. Zero-price BEST badge still open | see git log |
| D-009 | S3 | Admin/OMS bulk shipping modal | (a) first open showed "Fetching rates…" for >14 s on one order, reopening worked (not reproduced); (b) opening the modal fires `PATCH /outbound-orders/:id/shipping-details` (a view that writes) | Network log 3 Nov | Fixed: auto-soft-save now only fires for USER_MODIFIED rows | f750e4b29 |
| D-010 | S4 | Admin/Clients | New company form: Country defaults to "SA" (Saudi) in a Syrian system and is free text | UI 3 Nov | Fixed: default country changed to SY on Clients and Warehouses forms | f750e4b29 |
| D-011 | S3 | Admin toasts | Error toasts (e.g. approve blocked) are small and vanish within seconds; message names no fix link | OMS approve 3 Nov | Fixed: error toasts stay 9 s, have ✕ dismiss button, width w-96 | f750e4b29 |
| D-012 | S2 | Client pricing | Only one active client shipping-fee group exists on staging (Aleppo). Approving any order to another governorate fails: "No active shipping fee rate covers this destination" (Damascus tested) | OMS approve 3 Nov, `shipping_fee_groups` | Needs business decision (rates per governorate) | |
| D-013 | S1 | New vs old Syrian pound | Babel quotes show 400 SYP (140 SYP hub) beside $2.50 for Sila. The Babel portal banner states "the new Syrian pound has been adopted instead of the old one". If Babel prices are in new pounds (old / 100) while EMDAD FX (13,000 to 14,500 per USD) is in old pounds, Babel is compared and converted ~100x too cheap, always wins "BEST", and any SYP COD/fee conversion for it is wrong. Sena's SYP unit is also unconfirmed | Carrier cards + Babel portal banner 3 Nov | Fixed for Babel; Sena unit unconfirmed | commit c173d0c0; evidence in DECISIONS 1.12 |
| D-014 | S3 | Outbound Shipping Details | Failed-send banner printed the packed `[[se:{...}]]` JSON | UI 3 Nov | Fixed | 4a92816c |
| D-015 | S2 | FX source | COD conversion used rate 13000.418 from `fawazahmed0-currency-api` (free public API) | `carrier_shipments.raw_result_meta` | Needs business decision (official/admin-set rate) | |
| D-016 | S4 | Timeline | Carrier webhook events are attributed to the logged-in admin name ("carrier order_delivered · Nadim Hassan") | OMS timeline 3 Nov | Fixed: events with no creator (createdBy=null) now show "Carrier webhook" in live-activity feed | f750e4b29 |
| D-017 | S1 | Outbound single-order carrier form | Rate request omitted the COD currency chip, so Sena (SYP-only) was offered for USD COD and failed at send ("Currency is not supported for this merchant account") | E2E 3 Nov | Fixed (sends COD amount + collection currency; Sena/Mersal rules) | see git log |
| D-018 | S4 | New order form | Mouse wheel over the map zooms the map and traps page scroll | UI 3 Nov | Fixed: scrollWheelZoom disabled on MapContainer | f750e4b29 |
| D-019 | S3 | Shipping form | Package dimensions default to 10x10x10 instead of the product's 100x50x50 | Shipping details 3 Nov | Fixed: buildCarrierShippingFormFromOrder now uses product dimensions when available, falls back to 10×10×10 | f750e4b29 |
| D-020 | S3 | Babel create | Babel portal shows package dimensions 0x0x0 although the form sent 10x10x10 | Babel live E2E 3 Nov | Open (check payload) | |
| D-021 | S3 | Cancel shipment (Babel) | Dialog promises an electronic cancel request, but Babel has no cancel API; after local unlink the banner reads "Carrier send failed - Cancelled by super_admin (uuid)" in red | Babel live E2E 3 Nov | Fixed: OmsSingleShippingModal and AdminOutboundOrderSummary now show a yellow "Cancelled locally" notice instead of red "Carrier send failed" when lastErrorSafe starts with "Manually cancelled by admin" | 8a195e572 |
| D-022 | S2 | Rates (Sena) | Sena listed a zero price with BEST PRICE for an Aleppo address (single sandbox zone) | Shipping details 3 Nov | Fixed: zero-priced quotes are never recommended and sort last | this commit |
| D-023 | S3 | Rates (Sila) | Fatih price moved 2.60 to 2.80 and back within minutes for the same shipment | Shipping details 3 Nov | Fixed: ShippingCarrierCards now shows "Quoted X min ago · Refresh" chip; admin can manually refresh prices before sending | this commit |
| D-024 | S2 | Waybill label | Client-controlled text (address, notes, delivery instructions, product name/SKU, city) was placed into the label HTML unescaped, and the PDF is rendered by a headless browser: HTML/script injection into the label | Client API validation sweep 3 Nov | Fixed: every user value goes through `esc`; unit test added | this commit |
| D-025 | S3 | Order notes | Notes had no maximum (5,000 characters accepted; the admin plan form limits notes to 500) | Client API validation sweep 3 Nov | Fixed: notes limited to 500 on create and update | this commit |
| D-026 | S3 | Other PDFs | Other server-rendered PDFs (GRN, DN, final contract, invoices, instruction sheets, return slips) were not yet checked for the same unescaped-HTML pattern | Follow-up of D-024 | Checked 3 Nov: GRN/DN/contract/invoice use Handlebars auto-escape (raw output only for the layout shell), COD export and instruction sheet escape explicitly; no further issue | |
| D-027 | S3 | Test baseline | 6 unit suites fail on the base commit (OMS waybill-layout page count, line-numeric decimals, csv service, same-workflow-path, return rollback; warehouse-tasks-list constructor) | OMS jest run 3 Nov | Fixed: all 6 suites pass (updated specs for constructor changes, decimal validation, stale assertion removal) | 8a195e572 |
| D-028 | S2 | Inbound plan | The putaway picker offered Packing locations and the plan accepted them; the order was approved, receiving completed, then putaway failed and the order was stuck | Inbound UI/API test 3 Nov | Fixed: picker and backend accept only storage, fridge, quarantine, scrap bins of the plan's warehouse; checked on save and at approve | this commit |
| D-029 | S2 | Inbound putaway | After receiving, the plan was locked, so a wrong putaway destination could not be corrected | Same test | Fixed: while putaway is open, only the putaway destinations can be changed (backend plus a "Change putaway locations" link on the order) | this commit |
| D-030 | S2 | Stock adjustments | Two lines for the same product/location/lot were accepted; each was applied against the original quantity (5 set to 4 then 3 left 2) | Adjustments test 3 Nov | Fixed: duplicate line rejected on add and at approve | this commit |
| D-031 | S3 | Inbound fields | Inbound notes (5,000 characters), client reference (500), arrival date 2999, and an expected expiry date in the past were accepted | Inbound API sweep 3 Nov | Fixed: notes 500, reference 100, planning dates at most 2 years ahead (also OMS/outbound dates), expected expiry cannot be in the past | this commit |
| D-032 | S4 | Master data | Receiving dock is named "منظقة استلام" (typo for منطقة) | Inbound form 3 Nov | Fixed: corrected via SQL UPDATE in staging DB (6 Nov) | staging DB |
| D-033 | S3 | Ledger | Putaway (dock to bin) is not written to the inventory ledger; location-level history cannot be rebuilt (product-level totals reconcile) | Ledger audit 3 Nov | Open (design question) | |
| D-034 | S1 | Finance (COD) | COD in SYP was added to the USD client account without conversion (Madino: 170,000 SYP counted as 170,000 USD pending); credit used the same raw amount | Finance audit 3 Nov | Fixed in code (USD amount stored per record, refused without a rate); needs the migration and a reconcile run | this commit |
| D-035 | S2 | Finance (pending) | Pending balance was decreased by original plus adjustments although only the original was added | Finance audit 3 Nov | Fixed in code | this commit |
| D-036 | S2 | Finance (shipping fee) | Shipping fee debits and adjustments posted the order-currency amount as USD | Finance audit 3 Nov | Fixed in code | this commit |
| D-037 | S3 | Test baseline | Two more client-portal unit suites fail on the base commit (external-oms lifecycle, public-order serialize) | Test run 3 Nov | Fixed: included in D-027 fix (8a195e572) | 8a195e572 |
| D-038 | S3 | Reports KPI | "Storage capacity" card showed a percentage with "0 / 0 locations": the location counts were hard-coded to 0 | Reports pass 3 Nov | Fixed (uses the real counts) | this commit |
| D-039 | S3 | Report charts | Charts are hand-drawn SVG lines without axes, labels or legend; mandatory filters (warehouse, group by) surface as raw API errors | Reports pass 3 Nov | Fixed: bar chart has value+category labels; pie chart has legend; inline line chart now shows x-axis date labels; warehouse validation shows human-readable toast+alert | 8b007513f |
| D-040 | S3 | Sila webhooks | No webhook is registered on the Sila account, so Sila status changes reach EMDAD only by polling | Carrier check 3 Nov | Open (register `cargo.status_changed`, `cargo.delivered`, `cargo.returned`, `cargo.cancelled`) | |
| D-004 | S3 | Backend tests | Jest run OOM after 23/144 suites; 9 suites failing (stale specs/drift) | jest-baseline | Open | |

## Smoke pass log

- 3 Nov 2026 (staging admin, super admin): loaded Clients, Locations, Warehouses, Inbound, Outbound, Inventory (stock, ledger → redirects to stock, adjustments), Tasks, Cycle count, Returns, OMS Orders. All rendered with their headings; no API response ≥ 400 except the two image 404s above. This is a load check only; the per-control/field/status passes in each row remain ⬜.
- Observation: Outbound list triggers ~20 follow-up `GET /outbound-orders/:id` calls on load (N+1) — performance review item.
- 3 Nov (later): Clients list and New company form checked (validation messages appear for empty required fields; Cancel red / Create green). OMS list filter Ready to ship + Bulk Shipping modal opened on one Sena sandbox order (nothing sent): carriers shown = Sena, Babel hub, Karam, TARABUT, Fatih, Manual.
- 3 Nov (E2E, Sena sandbox): test order OMS-2026-03720 / OUT-2026-04463 (Test company, Nadim Hassan, TEST ORDER, Aleppo, COD 20 USD). Created -> confirmed -> approved (client fee 4 USD from Aleppo group) -> plan -> pick -> pack -> carrier Sena -> send. First send failed (D-017); after the fix COD was sent as 260,008 SYP (20 USD x 13000.418) and Sena returned AWB TEST-261103-4EADEF31. Dispatch complete -> shipped; sandbox status out_for_delivery and delivered reached EMDAD by webhook within ~8 s each; OMS Delivered, COD record generated (pending). Sena portal confirms store currency SYP and key last used at the creation time. Not yet done on Sena: cancel, return, failed delivery, label print, price/edit after shipment.
