# EMDAD QA Tracker

Status: ⬜ not started · 🔄 in progress · ✅ passed · ❌ defect open (see ID) · ⛔ blocked · ➖ n/a
One row per route. Defects are logged below with ID, severity (S1 blocker, S2 major, S3 minor, S4 cosmetic), evidence and fix commit.

## Admin portal (staging-admin.emdadsy.com) — roles: super_admin, wh_manager, wh_operator

| Route | Functional | Validation/edge | Roles | Consistency | Mobile | Notes |
|---|---|---|---|---|---|---|
| `//` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `//login` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/adjustments` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/allocation-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/audit-logs` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/factory-reset` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/google-drive` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/health` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/restore` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/retention` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/schedules` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/storage-policy` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/upload` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/dashboard` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/invoices` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/invoices/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/plans` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/plans/:clientId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/plans/:clientId/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/plans/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/templates` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/capacity-utilization` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/clients` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/clients/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cod-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/contracts` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/contracts/dn` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/contracts/final-contract` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/contracts/grn` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cycle-count` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cycle-count/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cycle-count/:id/execute` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cycle-count/my-tasks` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/dashboard` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/dashboard/overview` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/delivery-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/directed-outbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/factory-reset` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/accounts` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/carrier-costs` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/cod` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/overview` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/payouts` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/policies` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/transactions` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/forms` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/google-drive` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/health` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inbound-accuracy` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inbound/create` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/internal` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory-reserved` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/adjustments` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/adjustments/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/ledger` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/ledger/:referenceType/:referenceId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/ledger/line/:ledgerId/:createdAt` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/product/:productId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/stock` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/locations` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/locations/:warehouseId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/lot-expiry` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/merchant-orders` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/notifications` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/batches` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/batches/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/cod` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/cod/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/dashboard` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/orders/:id/waybill` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/returns/:id/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/order-cycle-time` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/directed-outbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/inbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/inbound/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/inbound/:id/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/inbound/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/oms` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/oms/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/oms/:id/waybill` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/oms/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/outbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/outbound/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/outbound/:id/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/outbound/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/outbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/outbound-fill-rate` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/outbound/create` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/product-moves` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/products` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/products/:sku` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/profile` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/receivables-aging` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/reports` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/reports/oms/cod` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/reports/oms/returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/restore` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/retention` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/return-rate` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/returns-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/returns/:id/process` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/revenue-by-client` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/sales-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/schedules` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/settings` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/shipping` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/shipping/companies` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/shipping/fee-rates` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/sla-compliance` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/stock-aging` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/storage-policy` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/tasks` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/tasks/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/tasks/:id/execute` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/upload` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users/client_users` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users/client_users/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users/warehouse_users` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users/warehouse_users/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/warehouse-analysis` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/warehouses` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/worker-productivity` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |

## Client portal (staging-client.emdadsy.com) — roles: client_admin, client_staff

| Route | Functional | Validation/edge | Roles/tenant | Consistency vs Admin | Mobile | Notes |
|---|---|---|---|---|---|---|
| `/account-inactive` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/login` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `apis` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `billing` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `billing/invoices/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `cod-reports` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `dashboard` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders/returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders/returns/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `finances` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `inbound-orders` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `inbound-orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `inbound-orders/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `invoices` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `invoices/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `my-profits` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `notifications` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders/returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders/returns/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `products` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `products/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `products/:id/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `products/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `profile` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `returns/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |

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
| D-003 | S3 | Data | Hierarchy has CRLF in a city key and 13 neighbourhoods with trailing spaces | JSON scan | Open | |
| D-005 | S3 | Products media | Two product images return 404 (`/api/client/media/products/f6fab62a…/a1cc3880…webp`, `…/3e2bbf4c…webp`): DB references files that are missing | Network log, staging admin Products page, 3 Nov | Open | |
| D-006 | S3 | Shipping rates UX | Babel rate error shown to staff is a technical message ("calculatePrice was not sent: the request has no neighbourhood id and no coordinates") when the address has no neighbourhood | API response 3 Nov | Fixed (message mapped), staging rebuilt | see git log |
| D-007 | S3 | Test data | ~100 PICKBENCH benchmark orders and Sena test orders mixed in the OMS list (5,811 orders) | OMS list 3 Nov | Open (hygiene) | |
| D-008 | S2 | Sena quotes | For any address (tested Idlib, Aleppo) Sena is offered with zone "المركز الرئيسي - الكسوة", price 0 SYP, and gets the BEST/recommended badge. Cause: `matchSenaZone` falls back to `zones[0]` when nothing matches (a unit test asserts this) and `createShipment` falls back to zone id 1; sandbox returns one zone with price 0 | Rates API + bulk modal, 3 Nov | Fixed per owner decision (hide Sena when no zone matches and several zones exist; single-zone merchants unchanged; create no longer falls back to zone 1). Sandbox has one zone so it still shows; multi-zone behaviour covered by unit tests, live zone list not yet inspected. Zero-price BEST badge still open | see git log |
| D-009 | S3 | Admin/OMS bulk shipping modal | (a) first open showed "Fetching rates…" for >14 s on one order, reopening worked (not reproduced); (b) opening the modal fires `PATCH /outbound-orders/:id/shipping-details` (a view that writes) | Network log 3 Nov | Open, investigate | |
| D-010 | S4 | Admin/Clients | New company form: Country defaults to "SA" (Saudi) in a Syrian system and is free text | UI 3 Nov | Open (polish) | |
| D-011 | S3 | Admin toasts | Error toasts (e.g. approve blocked) are small and vanish within seconds; message names no fix link | OMS approve 3 Nov | Open (polish) | |
| D-012 | S2 | Client pricing | Only one active client shipping-fee group exists on staging (Aleppo). Approving any order to another governorate fails: "No active shipping fee rate covers this destination" (Damascus tested) | OMS approve 3 Nov, `shipping_fee_groups` | Needs business decision (rates per governorate) | |
| D-013 | S1 | New vs old Syrian pound | Babel quotes show 400 SYP (140 SYP hub) beside $2.50 for Sila. The Babel portal banner states "the new Syrian pound has been adopted instead of the old one". If Babel prices are in new pounds (old / 100) while EMDAD FX (13,000 to 14,500 per USD) is in old pounds, Babel is compared and converted ~100x too cheap, always wins "BEST", and any SYP COD/fee conversion for it is wrong. Sena's SYP unit is also unconfirmed | Carrier cards + Babel portal banner 3 Nov | Needs business decision + carrier confirmation (which unit each carrier uses; one canonical unit in EMDAD) | |
| D-014 | S3 | Outbound Shipping Details | Failed-send banner printed the packed `[[se:{...}]]` JSON | UI 3 Nov | Fixed | 4a92816c |
| D-015 | S2 | FX source | COD conversion used rate 13000.418 from `fawazahmed0-currency-api` (free public API) | `carrier_shipments.raw_result_meta` | Needs business decision (official/admin-set rate) | |
| D-016 | S4 | Timeline | Carrier webhook events are attributed to the logged-in admin name ("carrier order_delivered · Nadim Hassan") | OMS timeline 3 Nov | Open | |
| D-017 | S1 | Outbound single-order carrier form | Rate request omitted the COD currency chip, so Sena (SYP-only) was offered for USD COD and failed at send ("Currency is not supported for this merchant account") | E2E 3 Nov | Fixed (sends COD amount + collection currency; Sena/Mersal rules) | see git log |
| D-018 | S4 | New order form | Mouse wheel over the map zooms the map and traps page scroll | UI 3 Nov | Open (polish) | |
| D-019 | S3 | Shipping form | Package dimensions default to 10x10x10 instead of the product's 100x50x50 | Shipping details 3 Nov | To confirm intent | |
| D-020 | S3 | Babel create | Babel portal shows package dimensions 0x0x0 although the form sent 10x10x10 | Babel live E2E 3 Nov | Open (check payload) | |
| D-021 | S3 | Cancel shipment (Babel) | Dialog promises an electronic cancel request, but Babel has no cancel API; after local unlink the banner reads "Carrier send failed - Cancelled by super_admin (uuid)" in red | Babel live E2E 3 Nov | Open (copy and wording) | |
| D-022 | S2 | Rates (Sena) | Sena listed a zero price with BEST PRICE for an Aleppo address (single sandbox zone) | Shipping details 3 Nov | Fixed: zero-priced quotes are never recommended and sort last | this commit |
| D-023 | S3 | Rates (Sila) | Fatih price moved 2.60 to 2.80 and back within minutes for the same shipment | Shipping details 3 Nov | Open (quote freshness) | |
| D-004 | S3 | Backend tests | Jest run OOM after 23/144 suites; 9 suites failing (stale specs/drift) | jest-baseline | Open | |

## Smoke pass log

- 3 Nov 2026 (staging admin, super admin): loaded Clients, Locations, Warehouses, Inbound, Outbound, Inventory (stock, ledger → redirects to stock, adjustments), Tasks, Cycle count, Returns, OMS Orders. All rendered with their headings; no API response ≥ 400 except the two image 404s above. This is a load check only; the per-control/field/status passes in each row remain ⬜.
- Observation: Outbound list triggers ~20 follow-up `GET /outbound-orders/:id` calls on load (N+1) — performance review item.
- 3 Nov (later): Clients list and New company form checked (validation messages appear for empty required fields; Cancel red / Create green). OMS list filter Ready to ship + Bulk Shipping modal opened on one Sena sandbox order (nothing sent): carriers shown = Sena, Babel hub, Karam, TARABUT, Fatih, Manual.
- 3 Nov (E2E, Sena sandbox): test order OMS-2026-03720 / OUT-2026-04463 (Test company, Nadim Hassan, TEST ORDER, Aleppo, COD 20 USD). Created -> confirmed -> approved (client fee 4 USD from Aleppo group) -> plan -> pick -> pack -> carrier Sena -> send. First send failed (D-017); after the fix COD was sent as 260,008 SYP (20 USD x 13000.418) and Sena returned AWB TEST-261103-4EADEF31. Dispatch complete -> shipped; sandbox status out_for_delivery and delivered reached EMDAD by webhook within ~8 s each; OMS Delivered, COD record generated (pending). Sena portal confirms store currency SYP and key last used at the creation time. Not yet done on Sena: cancel, return, failed delivery, label print, price/edit after shipment.
